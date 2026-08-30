/* Prospect list generator — Netlify Function.
   GET /.netlify/functions/prospect?zip=75790&max=150&limit=150
   Searches Google Places (New) for small businesses near a ZIP (categories in
   parallel, paginated), keeps only places at or under the review cap, and
   best-effort reads each business's public website for a contact email /
   owner name. Requires the GOOGLE_PLACES_API_KEY environment variable
   (Netlify site settings -> Environment variables). */

const CATEGORIES = [
  "auto repair shop",
  "tire shop",
  "family restaurant",
  "barber shop",
  "hair salon",
  "pet grooming",
  "boutique",
  "bakery",
  "coffee shop",
  "nail salon",
  "florist",
  "dry cleaner",
  "convenience store",
  "auto parts store",
  "gift shop",
  "gym",
];

/* second sweep when the category pass comes up short of the limit */
const FALLBACK_QUERIES = [
  "small business",
  "family owned business",
  "local shop",
  "local services",
];

const FIELD_MASK = [
  "places.id", "places.displayName", "places.formattedAddress",
  "places.nationalPhoneNumber", "places.websiteUri",
  "places.userRatingCount", "places.businessStatus",
  "places.primaryTypeDisplayName", "nextPageToken",
].join(",");

/* warm-instance memo so a retry / double click doesn't re-bill ~50 Places
   calls; entries live 10 minutes */
const CACHE = new Map();
const CACHE_MS = 10 * 60 * 1000;

const json = (o, status = 200) =>
  new Response(JSON.stringify(o), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

/* `claim` is shared across every query in the request: a place only counts
   toward `want` (and toward pagination stopping) the first time any query
   collects it, so overlapping queries keep paginating until they find places
   that are actually new. `trouble.v` flips when a query errors or times out,
   so the client can tell "sparse area" from "searches failed". */
async function searchCategory(key, cat, zip, max, want, pages, claim, t0, trouble) {
  const found = [];
  let pageToken = null;
  for (let page = 0; page < pages && found.length < want; page++) {
    if (Date.now() - t0 > 7000) break;
    let data;
    try {
      const body = { textQuery: cat + " in " + zip, maxResultCount: 20 };
      if (pageToken) body.pageToken = pageToken;
      const r = await fetch("https://places.googleapis.com/v1/places:searchText", {
        method: "POST",
        signal: AbortSignal.timeout(2600),
        headers: {
          "content-type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask": FIELD_MASK,
        },
        body: JSON.stringify(body),
      });
      if (!r.ok) { trouble.v = true; break; }
      data = await r.json();
    } catch (e) { trouble.v = true; break; }
    for (const pl of data.places || []) {
      if ((pl.userRatingCount || 0) > max) continue;
      if (pl.businessStatus && pl.businessStatus !== "OPERATIONAL") continue;
      if (!pl.id || claim.has(pl.id)) continue;
      claim.add(pl.id);
      found.push({
        id: pl.id,
        name: (pl.displayName && pl.displayName.text) || "",
        cat: cat.split(" ")[0].toUpperCase(),
        type: (pl.primaryTypeDisplayName && pl.primaryTypeDisplayName.text) || cat,
        phone: pl.nationalPhoneNumber || "",
        addr: pl.formattedAddress || "",
        website: pl.websiteUri || "",
        reviews: pl.userRatingCount || 0,
      });
    }
    pageToken = data.nextPageToken || null;
    if (!pageToken) break;
  }
  return found;
}

/* interleave result lists so every day gets a mix (ids are already unique
   request-wide via `claim`) */
function interleave(results, out, limit) {
  const depth = Math.max(...results.map(r => r.length), 0);
  for (let i = 0; i < depth && out.length < limit; i++) {
    for (const r of results) {
      if (out.length >= limit) break;
      if (r[i]) out.push(r[i]);
    }
  }
}

export default async (req) => {
  const t0 = Date.now();
  const url = new URL(req.url);
  const zip = (url.searchParams.get("zip") || "").trim();
  const max = Math.min(100000, parseInt(url.searchParams.get("max") || "150", 10) || 150);
  const limit = Math.min(160, parseInt(url.searchParams.get("limit") || "150", 10) || 150);
  const cats = (url.searchParams.get("cats") || "")
    .split(",").map(s => s.trim()).filter(Boolean).slice(0, 16);
  const categories = cats.length ? cats : CATEGORIES;

  const key = process.env.GOOGLE_PLACES_API_KEY || (url.searchParams.get("key") || "").trim();
  if (!key) return json({ error: "missing_key", hint: "Add your Google Places API key in the app (saved in this browser), or set GOOGLE_PLACES_API_KEY in Netlify environment variables." }, 500);
  if (!/^\d{5}$/.test(zip)) return json({ error: "bad_zip", hint: "zip must be a 5-digit ZIP code" }, 400);

  const ck = zip + "|" + max + "|" + limit + "|" + categories.join(",") + "|" + key.slice(-6);
  const hit = CACHE.get(ck);
  if (hit && Date.now() - hit.at < CACHE_MS) return json(hit.body);

  const claim = new Set();
  const trouble = { v: false };
  const perCat = Math.ceil(limit / categories.length) + 10;
  const results = await Promise.all(
    categories.map(cat => searchCategory(key, cat, zip, max, perCat, 3, claim, t0, trouble).catch(() => []))
  );

  const out = [];
  interleave(results, out, limit);

  /* still short of a full week? sweep generic queries for whatever's left
     (skipped when the category wave already used most of the time budget) */
  if (out.length < limit && Date.now() - t0 < 5500) {
    const wantMore = limit - out.length;
    const fallback = await Promise.all(
      FALLBACK_QUERIES.map(q => searchCategory(key, q, zip, max, wantMore, 3, claim, t0, trouble).catch(() => []))
    );
    interleave(fallback, out, limit);
  }

  /* best-effort owner info from public websites — sampled evenly across the
     whole list so every day's stops get a share, and never at the cost of
     the response (the function has a 10s budget) */
  const msLeft = 9200 - (Date.now() - t0);
  if (msLeft > 1500) {
    const withSite = out.filter(b => b.website);
    const stride = Math.max(1, Math.ceil(withSite.length / 60));
    const picks = withSite.filter((_, i) => i % stride === 0).slice(0, 60);
    const perSite = Math.min(3500, msLeft - 700);
    await Promise.allSettled(
      picks.map(async b => {
        const info = await ownerFromSite(b.website, perSite);
        if (info.email) b.oemail = info.email;
        if (info.owner) b.owner = info.owner;
      })
    );
  }

  const businesses = out.map(({ id, ...rest }) => rest);
  const body = { zip, max, count: businesses.length, businesses, partial: trouble.v };
  if (CACHE.size > 50) CACHE.clear();
  CACHE.set(ck, { at: Date.now(), body });
  return json(body);
};

async function ownerFromSite(site, budgetMs) {
  const res = { email: "", owner: "" };
  let html = "";
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), budgetMs || 3500);
  try {
    const r = await fetch(site, {
      signal: ctrl.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; RoutePlanner/1.0)" },
      redirect: "follow",
    });
    if (!r.ok) return res;
    /* the abort timer stays armed through the body read, so a slow-drip or
       huge response can't hold the whole request hostage */
    html = (await r.text()).slice(0, 400000);
  } catch (e) { return res; }
  finally { clearTimeout(t); }

  const text = html.replace(/<script[\s\S]*?<\/script>/gi, " ")
                   .replace(/<style[\s\S]*?<\/style>/gi, " ")
                   .replace(/<[^>]+>/g, " ");
  const emails = (text.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || [])
    .filter(e => !/(example\.|sentry|wixpress|godaddy|@[0-9]|\.png$|\.jpg$)/i.test(e));
  if (emails.length) res.email = emails[0];
  const m =
    text.match(/(?:owner|proprietor|founder)[^A-Za-z]{0,5}[:,-]?\s*([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,20})/) ||
    text.match(/([A-Z][a-z]{2,15}\s+[A-Z][a-z]{2,20})\s*[,–-]\s*(?:owner|proprietor|founder)/i);
  if (m) res.owner = m[1];
  return res;
}
