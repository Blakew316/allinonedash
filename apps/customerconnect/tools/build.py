#!/usr/bin/env python3
"""Static site generator for the redesigned Customer Connect site.

Usage:  python3 tools/build.py [--src DIR] [--out DIR]

Long-form copy (blog articles, privacy policy, merchant terms, kiosk
troubleshooting) is lifted from the original WordPress export in `--src` so the
redesign never paraphrases legal or editorial text. Everything else is composed
from `content.py` and rendered through the shared chrome in `layout.py`.
"""

import argparse
import html as htmllib
import os
import re
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from icons import icon, solid_star                                    # noqa: E402
import layout as L                                                    # noqa: E402
from content import POSTS, CATEGORIES, TAGS, PAGES                    # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(ROOT, "tools", "source")
CACHE = os.path.join(ROOT, "tools", "longform")


# ==========================================================================
# Source extraction helpers
# ==========================================================================

def read_source(src, name):
    path = os.path.join(src, name)
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8", errors="ignore") as fh:
        return fh.read()


def inner_div(doc, marker):
    """Return the inner HTML of the first <div> whose opening tag matches `marker`."""
    i = doc.find(marker)
    if i < 0:
        return None
    start = doc.index(">", i) + 1
    depth, pos = 1, start
    pat = re.compile(r"</?div\b", re.I)
    while True:
        m = pat.search(doc, pos)
        if not m:
            return doc[start:]
        depth += -1 if m.group(0).startswith("</") else 1
        pos = m.end()
        if depth == 0:
            return doc[start:m.start()]


def all_widget_html(doc, widget='data-widget_type="text-editor.default"'):
    """Concatenate the inner HTML of every Elementor text-editor widget."""
    out, pos = [], 0
    while True:
        i = doc.find(widget, pos)
        if i < 0:
            break
        # walk back to the opening "<div" of this widget
        j = doc.rfind("<div", 0, i)
        chunk = inner_div(doc[j:], "<div")
        if chunk:
            out.append(chunk)
        pos = doc.index(">", i) + 1
    return "\n".join(out)


def load_longform(src, slug, extractor):
    """Return cleaned long-form HTML for `slug`.

    Prefers the cached fragment in tools/longform/ so the site rebuilds without the
    original 4.6 MB WordPress export. When the export *is* available the fragment is
    re-extracted and the cache refreshed, keeping the two in sync.
    """
    cached = os.path.join(CACHE, slug + ".html")
    doc = read_source(src, slug + ".html")
    if doc:
        body = clean_prose(extractor(doc))
        if body:
            os.makedirs(CACHE, exist_ok=True)
            with open(cached, "w", encoding="utf-8") as fh:
                fh.write(body)
            return body
    if os.path.exists(cached):
        with open(cached, encoding="utf-8") as fh:
            return fh.read()
    return ""


def extract_article(doc):
    raw = inner_div(doc, '<div class="prose')
    if raw is None:
        raw = inner_div(doc, '<div class="entry-content')
    return raw or ""


def extract_widgets(doc):
    raw = all_widget_html(doc)
    if not raw.strip():
        raw = inner_div(doc, '<div class="entry-content') or ""
    return raw


SLUG_MAP = {
    "": "index.html", "blog": "blog.html", "pricing": "pricing.html",
    "book-demo": "book-demo.html", "sign-in": "sign-in.html",
    "privacy": "privacy.html", "merchant-terms": "merchant-terms.html",
    "compliance": "compliance.html", "troubleshooting": "troubleshooting.html",
    "products": "products.html", "solutions": "solutions.html",
    "resource-center": "resource-center.html", "connect-grow": "connect-grow.html",
    "growth-conversion": "growth-conversion-turn-customer-interactions-into-revenue.html",
    "data-tracking": "data-tracking-real-time-data-tracking-and-insights.html",
    "employee-engagement": "employee-engagement-employee-engagement-and-performance-tracking.html",
}

_KNOWN_SLUGS = {p["slug"] for p in POSTS} | set(PAGES.keys())


def rewrite_link(match):
    """Map absolute WordPress URLs onto the flat-file layout."""
    slug = match.group(1).strip("/")
    if slug in SLUG_MAP:
        return 'href="%s"' % SLUG_MAP[slug]
    if slug in _KNOWN_SLUGS:
        return 'href="%s.html"' % slug
    tail = slug.split("/")[-1]
    if tail in _KNOWN_SLUGS:
        return 'href="%s.html"' % tail
    return 'href="index.html"'


_BLOCK_RE = re.compile(r"<(?:p|h[1-6]|ul|ol|li|table|blockquote|pre|figure)\b", re.I)
_LEAF_DIV_RE = re.compile(r"<div\b[^>]*>((?:(?!<div\b|</div>)[\s\S])*)</div>", re.I)


def _divs_to_blocks(s):
    """Promote WordPress's bare <div> paragraphs to real block elements.

    Works innermost-first: a div holding only inline content becomes a <p>, a div
    holding nothing but a bold run becomes an <h3>, an empty one is dropped, and a
    div that already wraps block elements is simply unwrapped.
    """
    def one(m):
        inner = m.group(1)
        text = re.sub(r"<[^>]+>", "", inner)
        text = text.replace("&nbsp;", " ").replace("\xa0", " ").strip()
        if not text:
            return ""
        if _BLOCK_RE.search(inner):
            return inner
        bold = re.fullmatch(r"\s*<(strong|b)>([\s\S]*?)</\1>\s*", inner, flags=re.I)
        if bold and len(text) < 80:
            # a lone bold run is a sub-heading, one level below the real headings
            return "<h4>%s</h4>" % bold.group(2).strip()
        return "<p>%s</p>" % inner.strip()

    for _ in range(12):
        new = _LEAF_DIV_RE.sub(one, s)
        if new == s:
            break
        s = new
    return s


def _promote_headings(s):
    """If a document's top level is H3 (Elementor habit), lift it to H2."""
    first_h2 = re.search(r"<h2\b", s, re.I)
    if first_h2:
        # an H3 sitting above the first H2 is really a section heading too
        head, tail = s[:first_h2.start()], s[first_h2.start():]
        head = re.sub(r"<(/?)h3\b", r"<\1h2", head, flags=re.I)
        return head + tail
    if not re.search(r"<h3\b", s, re.I):
        return s
    s = re.sub(r"<(/?)h4\b", r"<\1h3TMP", s, flags=re.I)
    s = re.sub(r"<(/?)h3\b", r"<\1h2", s, flags=re.I)
    return s.replace("<h3TMP", "<h3").replace("</h3TMP", "</h3")


def clean_prose(raw):
    """Turn WordPress/Elementor markup into clean prose HTML."""
    if not raw:
        return ""
    s = raw
    # drop scripts, styles, forms (comment forms trail the article body)
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S | re.I)
    s = re.sub(r"<style.*?</style>", "", s, flags=re.S | re.I)
    s = re.sub(r"<form.*?</form>", "", s, flags=re.S | re.I)
    s = re.sub(r"<!--.*?-->", "", s, flags=re.S)
    # Cloudflare email obfuscation -> real address
    s = re.sub(r'<a[^>]*class="__cf_email__"[^>]*>.*?</a>', L.EMAIL, s, flags=re.S | re.I)
    s = re.sub(r'<a[^>]*href="/cdn-cgi/l/email-protection[^"]*"[^>]*>.*?</a>',
               '<a href="mailto:%s">%s</a>' % (L.EMAIL, L.EMAIL), s, flags=re.S | re.I)
    s = s.replace("[email&#160;protected]", L.EMAIL).replace("[email protected]", L.EMAIL)
    # remote images can't be served from this bundle
    s = re.sub(r"<figure.*?</figure>", "", s, flags=re.S | re.I)
    s = re.sub(r"<img[^>]*>", "", s, flags=re.I)
    # the legal/support pages use bare <div>s as paragraphs and
    # <div><strong>Label</strong></div> as sub-headings — recover both before the
    # structural unwrap, or every block collapses into one run of text
    s = _divs_to_blocks(s)
    # unwrap remaining layout containers
    s = re.sub(r"</?(?:div|section|span|article|header|footer|main)\b[^>]*>", "", s, flags=re.I)
    # normalise internal links, harden external ones
    s = re.sub(r'href="https?://(?:www\.)?customerconnectwp\.com/([^"]*)"', rewrite_link, s)
    s = re.sub(r'href="/([^":]*)"', rewrite_link, s)
    s = re.sub(r'href="(https?://(?!(?:www\.)?customerconnectwp\.com)[^"]*)"',
               r'href="\1" target="_blank" rel="noopener"', s)
    # strip presentational attributes WordPress leaves behind
    s = re.sub(r'\s(?:class|style|id|type|data-[\w-]+|aria-\w+|loading|decoding|width|height)="[^"]*"',
               "", s, flags=re.I)
    s = re.sub(r"<p>\s*(?:&nbsp;)?\s*</p>", "", s, flags=re.I)
    s = re.sub(r"<(h[1-6])>\s*</\1>", "", s, flags=re.I)
    s = re.sub(r"\n{3,}", "\n\n", s)
    # demote a stray H1 inside body copy so each page keeps one H1
    s = re.sub(r"<h1>(.*?)</h1>", r"<h2>\1</h2>", s, flags=re.S | re.I)
    s = _promote_headings(s)
    return s.strip()


def headings(prose):
    """Anchor every H2–H4 and return the level best suited to a table of contents.

    Legal pages differ in shape: the privacy policy is a flat run of H2s while the
    merchant terms nest sixteen H4 clauses under one H2, so the TOC level is chosen
    from whichever level actually enumerates the document.
    """
    seen, by_level = set(), {2: [], 3: [], 4: []}

    def sub(m):
        level = int(m.group(1)[1])
        body = m.group(2)
        text = re.sub(r"<[^>]+>", "", body).strip()
        slug = re.sub(r"[^a-z0-9]+", "-", htmllib.unescape(text).lower()).strip("-")[:60]
        if not slug:
            return m.group(0)
        base, n = slug, 2
        while slug in seen:
            slug = "%s-%d" % (base, n)
            n += 1
        seen.add(slug)
        by_level[level].append((slug, text.rstrip(".")))
        return '<h%d id="%s">%s</h%d>' % (level, slug, body, level)

    prose = re.sub(r"<(h[234])>(.*?)</\1>", sub, prose, flags=re.S | re.I)
    best = max((lvl for lvl in (2, 3, 4) if len(by_level[lvl]) >= 3),
               key=lambda lvl: len(by_level[lvl]), default=None)
    return prose, (by_level[best] if best else [])


# ==========================================================================
# Reusable page fragments
# ==========================================================================

def crumbs(items):
    out = []
    for i, (label, href) in enumerate(items):
        if i:
            out.append(icon("chevron-right"))
        out.append('<a href="%s">%s</a>' % (href, label) if href
                   else '<span>%s</span>' % label)
    return '<nav class="crumbs" aria-label="Breadcrumb">%s</nav>' % "".join(out)


def panel_chart(rows, bars, caption="Last 30 days"):
    row_html = "".join(
        '<div class="panel-row"><span class="pl"><i>{ico}</i>'
        '<span><b>{title}</b><span>{sub}</span></span></span>'
        '<span class="pv">{val}</span></div>'.format(ico=icon(ic), title=t, sub=s, val=v)
        for ic, t, s, v in rows)
    bar_html = "".join(
        '<i class="%s" style="--d:%dms;height:%d%%"></i>'
        % ("tall" if tall else "", i * 70, h)
        for i, (h, tall) in enumerate(bars))
    return """<div class="panel-mock" data-reveal="scale">
  <div class="panel-bar"><i></i><i></i><i></i><span>{cap}</span></div>
  <div class="panel-body">
    {rows}
    <div class="chart">{bars}</div>
  </div>
</div>""".format(cap=caption, rows=row_html, bars=bar_html)


def phone_mock():
    return """<div class="hero-visual">
  <div class="phone anim-up d3">
    <div class="phone-screen">
      <div class="phone-notch" aria-hidden="true"></div>
      <div class="phone-bar">
        <span class="pav">CC</span>
        <span><b>Carl’s Catfish</b><span>Text line · active now</span></span>
      </div>
      <div class="phone-thread">
        <div class="bubble them">Welcome to the rewards club! You’re <b>1 visit</b> from a free appetizer 🎣</div>
        <div class="bubble me">Nice — see you Friday</div>
        <div class="bubble them">Friday only: <b>$5 off $25</b>. Show this text at the counter.</div>
        <div class="bubble me">Redeem</div>
        <div class="bubble them">Claimed at 6:42 PM. Reward unlocked for your next visit ✅</div>
        <div class="typing" aria-hidden="true"><i></i><i></i><i></i></div>
      </div>
    </div>
  </div>
  <div class="chip chip-1" aria-hidden="true">
    <span class="chip-ico">{up}</span><span><b>+38%</b><span>Repeat visits</span></span>
  </div>
  <div class="chip chip-2" aria-hidden="true">
    <span class="chip-ico">{star}</span><span><b>4.9</b><span>Average rating</span></span>
  </div>
  <div class="chip chip-3" aria-hidden="true">
    <span class="chip-ico">{users}</span><span><b>1,512</b><span>New sign-ups / yr</span></span>
  </div>
</div>""".format(up=icon("trending-up"), star=icon("star"), users=icon("user-plus"))


def related_posts(current_slug, n=3):
    pool = [p for p in POSTS if p["slug"] != current_slug]
    same = [p for p in pool if p["category"] ==
            next((q["category"] for q in POSTS if q["slug"] == current_slug), None)]
    picks = same[:n]
    for p in pool:
        if len(picks) >= n:
            break
        if p not in picks:
            picks.append(p)
    return picks


def blog_sidebar(active_cat=None):
    recent = "".join('<li><a href="%s.html">%s</a></li>' % (p["slug"], p["title"])
                     for p in POSTS[:5])
    cats = "".join(
        '<li><a href="blog.html#%s"%s>%s</a></li>'
        % (re.sub(r"[^a-z]+", "-", c.lower()),
           ' class="active"' if c == active_cat else "", c)
        for c in CATEGORIES)
    tags = "".join('<a href="blog.html">%s</a>' % t for t in TAGS)
    return """<aside class="side">
  <div class="side-card">
    <h4>Search</h4>
    <label class="search-field">
      <span class="sr-only">Search resources</span>
      {search}<input type="search" placeholder="Search the resource center…">
    </label>
  </div>
  <div class="side-card">
    <h4>Recent posts</h4>
    <ul class="side-list">{recent}</ul>
  </div>
  <div class="side-card">
    <h4>Categories</h4>
    <ul class="side-list">{cats}</ul>
  </div>
  <div class="side-card">
    <h4>Tags</h4>
    <div class="side-tags">{tags}</div>
  </div>
  <div class="side-cta">
    <h4>Ready when you are</h4>
    <strong>See the platform in action</strong>
    <p>20 minutes with a Growth Specialist. Bring your customer list — we’ll show you what
    it’s worth.</p>
    <a class="btn btn-solid-light btn-block btn-sm" href="book-demo.html">Book a Demo</a>
  </div>
</aside>""".format(search=icon("search"), recent=recent, cats=cats, tags=tags)


# ==========================================================================
# Page builders — marketing
# ==========================================================================

def build_solution_page(slug, d):
    parts = [L.head(d["title"].replace("&amp;", "&"), d["meta"], active=None,
                    body_class="page-%s" % re.sub(r"[^a-z0-9]+", "-", slug))]

    parts.append("""<section class="page-hero left">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    {crumbs}
    <div class="split tilt" style="margin-top:28px">
      <div>
        <span class="pill anim-up d1"><span class="dot"></span>{eyebrow}</span>
        <h1 class="t-h1 anim-up d2" style="margin-top:20px">{h1}</h1>
        <p class="lede anim-up d3">{lede}</p>
        <div class="page-hero-cta anim-up d4">
          <a class="btn btn-primary btn-lg" href="book-demo.html">Book a Demo {ar}</a>
          <a class="btn btn-ghost btn-lg" href="pricing.html">See pricing</a>
        </div>
        <div class="trust-row anim-up d5">
          <span class="avatars" aria-hidden="true"><i>AS</i><i>DS</i><i>PR</i><i>+</i></span>
          <span class="trust-copy"><strong>10,000+ merchants served.</strong><br>
          {stars} 4.9 average merchant rating</span>
        </div>
      </div>
      <div class="anim-up d4">{panel}</div>
    </div>
  </div>
</section>""".format(
        crumbs=crumbs([("Home", "index.html"), (d["nav"], None), (d["title"], None)]),
        eyebrow=d["eyebrow"], h1=d["h1"], lede=d["lede"],
        ar=icon("arrow-right", cls="ico ico-arrow"),
        stars='<span class="stars">%s</span>' % (solid_star() * 5),
        panel=panel_chart(
            [("users", "Contacts added", "This month", "+1,284"),
             ("ticket", "Offers redeemed", "This month", "937"),
             ("dollar", "Attributed revenue", "This month", "$21,480")],
            [(34, False), (48, False), (42, False), (63, True), (57, False),
             (78, True), (71, False), (94, True)])))

    # features
    parts.append("""<section class="section">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head(d["features_eyebrow"], d["features_title"], d.get("features_lede")),
        grid=L.feature_grid(d["features"], cols=d.get("features_cols", 3))))

    # pillars
    parts.append("""<section class="section section-tint">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head(d["pillars_eyebrow"], d["pillars_title"], d.get("pillars_lede")),
        grid=L.pillars(d["pillars"])))

    if d.get("steps"):
        parts.append("""<section class="section">
  <div class="shell">
    {head}
    {steps}
  </div>
</section>""".format(
            head=L.section_head(d["steps_eyebrow"], d["steps_title"], d.get("steps_lede")),
            steps=L.steps(d["steps"])))

    if d.get("stats"):
        parts.append("""<section class="section section-dark">
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    {head}
    {band}
  </div>
</section>""".format(
            head=L.section_head(d["stats_eyebrow"], d["stats_title"], d.get("stats_lede")),
            band=L.stat_band(d["stats"])))

    if d.get("industries"):
        parts.append("""<section class="section section-tint">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
            head=L.section_head(d["industries_eyebrow"], d["industries_title"],
                                d.get("industries_lede")),
            grid=L.industries(d["industries"])))

    if d.get("testimonials"):
        parts.append(L.testimonials(title=d.get("testimonials_title",
                                                "What Our Customers Are Saying")))
    if d.get("resources"):
        parts.append(L.resources_section(POSTS[:3]))
    if d.get("faq"):
        parts.append(L.faq_section())

    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_index():
    tabs = [
        ("send", "Marketing",
         "Build text marketing campaigns to increase Google reviews, automatically re-engage "
         "lost customers, or boost sales on slow days.",
         ["Bulk SMS and MMS", "Trackable offers", "Slow-day promos"],
         "text-marketing.html"),
        ("target", "Lead Engagement",
         "Engage sales leads by using text messaging to follow up, schedule appointments "
         "instantly, and handle Q&amp;A effortlessly.",
         ["Instant follow-up", "Appointment scheduling", "Two-way Q&amp;A"],
         "growth-conversion-turn-customer-interactions-into-revenue.html"),
        ("headset", "Customer Support",
         "Provide fast, efficient customer support by answering questions, resolving issues, "
         "and sending updates — all through text messaging.",
         ["Shared inbox", "Quick replies", "Status updates"],
         "1-to-1-conversations.html"),
        ("user-plus", "Recruiting",
         "Streamline recruiting by using text to schedule interviews, send job updates, and "
         "maintain communication with top candidates.",
         ["Interview reminders", "Pipeline visibility", "Candidate re-engagement"],
         "recruiting-simplified.html"),
        ("team", "Employee Engagement",
         "Enhance onboarding and employee engagement by sending training reminders, company "
         "updates, and motivational messages via text.",
         ["Onboarding workflows", "Shift updates", "Recognition"],
         "employee-engagement-employee-engagement-and-performance-tracking.html"),
        ("gift", "Customer Loyalty",
         "Strengthen customer loyalty with automatic reminders on offers, personalized rewards, "
         "and campaigns that re-engage lost customers effortlessly.",
         ["Digital loyalty", "Birthday automation", "Win-back offers"],
         "customer-loyalty.html"),
    ]
    rail = "".join(
        '<button class="tab-btn" type="button" role="tab" aria-selected="{sel}" '
        'aria-controls="panel-{i}" id="tab-{i}"><span class="t-ico">{ico}</span>{name}</button>'
        .format(sel="true" if i == 0 else "false", i=i, ico=icon(ic), name=name)
        for i, (ic, name, _b, _m, _h) in enumerate(tabs))
    panels = "".join(
        """<div class="tab-panel{act}" id="panel-{i}" role="tabpanel" aria-labelledby="tab-{i}">
  <span class="micro">Use case {num} / {total}</span>
  <h3 style="margin-top:12px">{name}</h3>
  <p>{body}</p>
  <div class="tab-meta">{meta}</div>
  <a class="link-arrow mt-3" href="{href}">Explore {name} {ar}</a>
</div>""".format(act=" active" if i == 0 else "", i=i, name=name, body=body,
                 num="%02d" % (i + 1), total="%02d" % len(tabs),
                 meta="".join('<span class="pill">%s</span>' % m for m in metas),
                 href=href, ar=icon("arrow-right", cls="ico"))
        for i, (_ic, name, body, metas, href) in enumerate(tabs))

    showcases = [
        ("Reputation Management", "star",
         "You can’t afford to ignore what customers say online. Customer Connect helps you "
         "manage reviews before they manage you.",
         "reputation-management.html"),
        ("Growth Conversion", "trending-up",
         "You can’t afford slow growth. Customer Connect helps you turn every message into "
         "measurable results.",
         "growth-conversion-turn-customer-interactions-into-revenue.html"),
        ("Loyalty &amp; Personalization", "gift",
         "You can’t afford one-time customers. Customer Connect helps you turn first visits "
         "into lasting loyalty.",
         "customer-loyalty.html"),
    ]
    show_cards = "".join(
        """<a class="card card-hover card-glow feature-card" href="{href}" data-reveal>
  <div class="feature-ico">{ico}</div>
  <h3>{title}</h3><p>{body}</p>
  <span class="link-arrow mt-3">Explore {ar}</span>
</a>""".format(href=href, ico=icon(ic), title=title, body=body,
               ar=icon("arrow-right", cls="ico"))
        for title, ic, body, href in showcases)

    tools = [
        ("bar-chart", "Decisions Backed by Data",
         "Access real-time insights to measure, optimize, and scale."),
        ("user-plus", "Turn Traffic Into Loyalty",
         "Convert contacts into engaged subscribers and long-term fans."),
        ("message-dots", "Engage Customers at Scale",
         "Deliver text, image, and GIF messages that drive immediate action."),
        ("shield", "Stay Compliant, Stay Protected",
         "Meet text regulations with built-in safeguards and oversight."),
        ("smartphone", "Your Brand, Mobile-Ready",
         "Provide a branded, on-the-go experience for every customer."),
        ("kiosk", "Sign-Ups on Autopilot",
         "Cellular kiosks and QR codes grow your list while your team serves customers."),
    ]

    parts = [L.head(
        "Text Marketing, Loyalty &amp; Reviews for Local Business",
        "Customer Connect by Wholesale Payments helps 10,000+ merchants drive repeat visits "
        "with text marketing, digital loyalty, kiosks, reviews, and real-time insights.",
        body_class="page-home")]

    parts.append("""<section class="hero">
  <div class="bg-orbs" aria-hidden="true">
    <span class="orb orb-a"></span><span class="orb orb-b"></span><span class="orb orb-c"></span>
  </div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell hero-inner">
    <div class="hero-copy">
      <span class="pill anim-up d1"><span class="dot"></span>Over 10,000 merchants served for SMS success</span>
      <h1 class="t-display hero-title anim-up d2">
        Instantly ignite<br>
        <span class="rotator" data-interval="2600">
          <span>Revenue Growth</span>
          <span>Deeper Engagement</span>
          <span>Customer Retention</span>
          <span>Repeat Visits</span>
        </span>
      </h1>
      <p class="lede anim-up d3">Sure, we do text marketing and loyalty — but that’s just the
      start. We help you build stronger relationships with customers, employees, and prospects.</p>
      <div class="hero-cta anim-up d4">
        <a class="btn btn-primary btn-lg" href="book-demo.html">Book a Demo {ar}</a>
        <a class="btn btn-ghost btn-lg" href="connect-grow.html">{play} Watch the Video</a>
      </div>
      <div class="trust-row anim-up d5">
        <span class="avatars" aria-hidden="true"><i>AS</i><i>DS</i><i>PR</i><i>+</i></span>
        <span class="trust-copy"><strong>+750M contact interactions</strong> and
        <strong>+$200M</strong> in additional merchant revenue.<br>
        {stars} 4.9 average merchant rating</span>
      </div>
    </div>
    {phone}
  </div>
</section>""".format(ar=icon("arrow-right", cls="ico ico-arrow"), play=icon("play", cls="ico"),
                     stars='<span class="stars">%s</span>' % (solid_star() * 5),
                     phone=phone_mock()))

    parts.append(L.marquee("Over 10,000 merchants served for SMS success"))

    parts.append("""<section class="section section-dark">
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <div class="split tilt">
      <div data-reveal="left">
        <span class="micro">By the numbers</span>
        <h2 class="t-h2" style="margin-top:14px">Ignite Growth With Clear Customer Insights</h2>
        <p class="lede">You can’t afford to guess when it comes to revenue and retention.
        Customer Connect helps thousands of merchants spark instant growth and deeper
        engagement with powerful tools and real-time insights.</p>
        <a class="btn btn-on-dark mt-4" href="data-analytics.html">Explore data analytics {ar}</a>
      </div>
      <div class="stat-band grid g-2" data-stagger="110">
        {c1}{c2}{c3}{c4}
      </div>
    </div>
  </div>
</section>""".format(
        ar=icon("arrow-right", cls="ico ico-arrow"),
        c1=L.counter_stat(750, "M", "Contact Interactions", prefix="+"),
        c2=L.counter_stat(200, "M", "Additional Revenue", prefix="+$"),
        c3=L.counter_stat(10000, "+", "Merchants Served"),
        c4=L.counter_stat(98, "%", "Average Open Rate")))

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    <div class="tabs" data-tabs data-autoplay="5600">
      <div class="tab-rail" role="tablist" aria-label="Ways to use Customer Connect">
        <span class="tab-ind" aria-hidden="true"></span>
        {rail}
      </div>
      <div class="tab-panels">{panels}</div>
    </div>
  </div>
</section>""".format(
        head=L.section_head("Use cases",
                            "Every Text Brings Infinite Possibilities to "
                            "<span class=\"grad-text\">Connect, Engage and Grow</span>",
                            "One platform, six jobs — pick where you need results first."),
        rail=rail, panels=panels))

    parts.append("""<section class="section section-tint">
  <div class="shell">
    {head}
    <div class="grid g-3" data-stagger="90">{cards}</div>
  </div>
</section>""".format(
        head=L.section_head("Where merchants start",
                            "Three Problems We Solve First",
                            "Most merchants arrive with one of these. All three compound."),
        cards=show_cards))

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head("Platform",
                            "Tools That Ignite Growth, Retention &amp; Engagement",
                            "Powerful features that help you sell more, retain more, and build "
                            "deeper customer loyalty."),
        grid=L.feature_grid(tools, cols=3, numbered=True)))

    parts.append("""<section class="section section-tint">
  <div class="shell">
    <div class="split">
      <div data-reveal="left">
        <span class="micro">In the wild</span>
        <h2 class="t-h2" style="margin-top:14px">From First Scan to Fifth Visit</h2>
        <p class="lede">A customer scans a QR code or taps the kiosk, opts in, and gets a
        reward. From there, automations handle the follow-up — and you watch the return visits
        land in your dashboard.</p>
        <div class="contact-cards mt-4" data-stagger="70">
          <div class="contact-card" data-reveal><i>{qr}</i>
            <span><b>Opt in</b><span>QR code, keyword, web form, or kiosk</span></span></div>
          <div class="contact-card" data-reveal><i>{send}</i>
            <span><b>Engage</b><span>Offers, reminders, and 1-to-1 replies</span></span></div>
          <div class="contact-card" data-reveal><i>{chart}</i>
            <span><b>Measure</b><span>Redemptions and revenue, attributed</span></span></div>
        </div>
      </div>
      <div data-reveal="right">{panel}</div>
    </div>
  </div>
</section>""".format(
        qr=icon("qr"), send=icon("send"), chart=icon("bar-chart"),
        panel=panel_chart(
            [("user-plus", "New sign-ups", "Kiosk + QR", "1,512 / yr"),
             ("repeat", "Repeat visit rate", "Rolling 90 days", "+38%"),
             ("star", "New Google reviews", "This quarter", "212")],
            [(28, False), (41, False), (52, True), (46, False), (68, True),
             (61, False), (83, True), (97, True)],
            caption="Merchant dashboard")))

    parts.append(L.testimonials())
    parts.append(L.faq_section())
    parts.append(L.resources_section(POSTS[:3], title="Fresh From the Resource Center"))
    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_connect_grow():
    build = [
        ("Build Customer Database", "users",
         ["In-store kiosk", "Mobile web app", "In-store QR codes", "Online web forms"]),
        ("Track Customers", "activity",
         ["Digital loyalty", "Trackable text offers", "Mini-URLs", "Contact notes"]),
        ("Text Customers", "send",
         ["SMS marketing", "MMS marketing", "Automated texts", "1:1 conversations"]),
    ]
    build_cards = "".join(
        """<article class="card card-hover pillar" data-reveal>
  <div class="pillar-badge">{ico}</div><h3>{title}</h3>
  <ul class="check-list">{lis}</ul>
</article>""".format(ico=icon(ic), title=title,
                     lis="".join('<li>%s<span>%s</span></li>' % (icon("check"), b)
                                 for b in items))
        for title, ic, items in build)

    help_items = [
        ("dollar", "Boost Revenue",
         "Trackable text offers let you see which messages convert, which customers redeem, "
         "and what’s actually working."),
        ("repeat", "Win Back Lost Customers Automatically",
         "Recover up to 25% of lost customers each month without manual follow-ups."),
        ("gift", "Effortless Loyalty That Drives Repeat Visits",
         "Reward customers through a custom loyalty kiosk and mobile web app."),
        ("bar-chart", "See What’s Actually Driving Revenue",
         "Track performance across social, local ads, email, and your growing text list."),
        ("star", "More 5-Star Reviews, Fewer Headaches",
         "Increase positive reviews automatically while reducing negative feedback."),
        ("shield", "Compliance Handled For You",
         "TCPA and CTIA safeguards are built into every campaign you send."),
    ]

    parts = [L.head("Why Customer Connect",
                    "Drive more visits, more positive reviews, and more revenue with the "
                    "Customer Connect engagement platform.",
                    body_class="page-connect-grow")]

    parts.append(L.page_hero(
        "Connect &amp; grow",
        "Revenue Growth. Customer Retention. <span class=\"grad-text\">Deeper Engagement.</span>",
        "Drive more visits, more positive reviews, and more revenue with the Customer Connect "
        "engagement platform.",
        primary=("Book Now", "book-demo.html"),
        secondary=("See pricing", "pricing.html"),
        title_class="t-display"))

    parts.append(L.marquee())

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    <div class="grid g-3" data-stagger="90">{cards}</div>
  </div>
</section>""".format(
        head=L.section_head("Our services", "Three Systems, One Platform",
                            "Build the list, track the behaviour, and message the right people "
                            "at the right time."),
        cards=build_cards))

    parts.append("""<section class="section section-tint">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head("Outcomes", "We Help You Where You Need It Most",
                            "Pick the outcome you need first — the platform handles the rest."),
        grid=L.feature_grid(help_items, cols=3)))

    parts.append("""<section class="section section-dark">
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <div class="split">
      <div data-reveal="left">
        <span class="micro">Case study</span>
        <h2 class="t-h2" style="margin-top:14px">Real Growth, Real Numbers</h2>
        <div class="stack" style="margin-top:20px">
          <p class="lede">A local restaurant chain in Indiana with two locations ignited their
          growth starting in 2017. The owner wanted a simple way to bring customers back and
          reward them for doing so. SMS was the obvious choice — the open rate is more than
          double email marketing, and building a custom mobile app was out of the question due
          to the expense.</p>
          <p class="lede">Within the first year on the platform, the business had
          <strong style="color:#fff">3,701 contacts</strong> sign up. In that same year the
          merchant sent <strong style="color:#fff">58,576 texts</strong>, saw customers check in
          <strong style="color:#fff">11,029 times</strong>, and added
          <strong style="color:#fff">$48,328</strong> in additional revenue.</p>
          <p class="lede">Today the chain has <strong style="color:#fff">9 locations</strong>, a
          total of <strong style="color:#fff">137,470 contacts</strong>, and an increase of
          <strong style="color:#fff">$7,015,255</strong> in estimated revenue.</p>
        </div>
      </div>
      <div>
        <div class="stat-band grid g-1" data-stagger="110">{stats}</div>
      </div>
    </div>
  </div>
</section>""".format(stats="".join([
        L.counter_stat(27056, "", "New Contacts",
                       note="The total number of contacts added in the last 12 months."),
        L.counter_stat(11235, "", "Loyalty Redemptions",
                       note="Using an offer of $10 off $30, redeemed every 7 check-ins."),
        L.counter_stat(1.45, "M", "Estimated Revenue", prefix="$", decimals=2,
                       note="Using automated text: 44,784 redemptions. 15.3% of text offers "
                            "were redeemed."),
    ])))

    parts.append(L.testimonials(title="What Our Merchants Say About Us"))
    parts.append(L.faq_section())
    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_book_demo():
    benefits = [
        ("dollar", "Boost Revenue",
         "Trackable text offers show which messages convert, which customers redeem, and "
         "what’s actually working."),
        ("repeat", "Win Back Lost Customers Automatically",
         "Recover up to 25% of lost customers each month without manual follow-ups."),
        ("gift", "Effortlessly Drive Repeat Visits",
         "Reward customers through a custom loyalty kiosk and mobile web app."),
        ("bar-chart", "See What’s Actually Driving Revenue",
         "Track performance across social, local ads, email, and your growing text list."),
        ("star", "More 5-Star Reviews, Fewer Headaches",
         "Increase positive reviews automatically while reducing negative feedback."),
    ]
    industries = ["Restaurant / Bar", "Retail", "Salon / Spa", "Fitness", "Auto services",
                  "Healthcare / Dental", "Entertainment", "Franchise / Multi-location", "Other"]
    sizes = ["1 location", "2–5 locations", "6–20 locations", "21+ locations"]

    form = """<form class="form-card" data-demo-form novalidate>
  <h2 class="t-h3">Book your walkthrough</h2>
  <p class="body-sm" style="margin:10px 0 26px">Takes about 20 minutes. We’ll tailor it to your
  business before we get on the call.</p>
  <div class="field-row">
    <div class="field">
      <label for="fn">First name <span class="req">*</span></label>
      <input id="fn" name="first" type="text" autocomplete="given-name" required>
    </div>
    <div class="field">
      <label for="ln">Last name <span class="req">*</span></label>
      <input id="ln" name="last" type="text" autocomplete="family-name" required>
    </div>
  </div>
  <div class="field">
    <label for="biz">Business name <span class="req">*</span></label>
    <input id="biz" name="business" type="text" autocomplete="organization" required>
  </div>
  <div class="field-row">
    <div class="field">
      <label for="em">Work email <span class="req">*</span></label>
      <input id="em" name="email" type="email" autocomplete="email" required>
    </div>
    <div class="field">
      <label for="ph">Mobile number <span class="req">*</span></label>
      <input id="ph" name="phone" type="tel" inputmode="tel" placeholder="(806) 606-6500"
             autocomplete="tel" required>
    </div>
  </div>
  <div class="field-row">
    <div class="field">
      <label for="ind">Industry</label>
      <select id="ind" name="industry">{industries}</select>
    </div>
    <div class="field">
      <label for="loc">Locations</label>
      <select id="loc" name="locations">{sizes}</select>
    </div>
  </div>
  <div class="field">
    <label for="goal">What would you like to fix first?</label>
    <textarea id="goal" name="goal" placeholder="e.g. slow Tuesdays, not enough Google reviews, no way to reach past customers…"></textarea>
  </div>
  <div class="check-row">
    <input id="consent" type="checkbox" required>
    <label for="consent">I agree to receive SMS text messages from Customer Connect about my
    demo. Message frequency varies. Message and data rates may apply. Reply STOP to opt out,
    HELP for help. See our <a href="privacy.html">Privacy Policy</a> and
    <a href="merchant-terms.html">Terms</a>.</label>
  </div>
  <div class="form-foot">
    <button class="btn btn-primary btn-lg btn-block" type="submit">Book my demo</button>
  </div>
  <div class="form-status" role="status" aria-live="polite"></div>
  <p class="form-note">Prefer to talk now? Call or text
  <a href="tel:{tel}">{phone}</a>.</p>
</form>""".format(
        industries="".join("<option>%s</option>" % i for i in industries),
        sizes="".join("<option>%s</option>" % s for s in sizes),
        tel=L.PHONE_TEL, phone=L.PHONE_DISPLAY)

    parts = [L.head("Book a Demo",
                    "Book a one-on-one demo with a Growth Specialist and see how Customer "
                    "Connect turns your customer list into real revenue.",
                    body_class="page-book-demo")]

    parts.append("""<section class="page-hero left">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <div class="split tilt">
      <div>
        <span class="pill anim-up d1"><span class="dot"></span>Over 10,000 merchants served</span>
        <h1 class="t-h1 anim-up d2" style="margin-top:20px">See the Platform in Action</h1>
        <p class="lede anim-up d3">Book a one-on-one demo with a Growth Specialist to walk
        through your business, your goals, and how to turn this into real revenue.</p>
        <div class="contact-cards mt-4 anim-up d4" data-stagger="70">
          <div class="contact-card"><i>{clock}</i>
            <span><b>20 minutes</b><span>Focused on your business, not a slide deck</span></span></div>
          <div class="contact-card"><i>{list}</i>
            <span><b>A real plan</b><span>Leave with a launch plan for your first campaign</span></span></div>
          <div class="contact-card"><i>{shield}</i>
            <span><b>No pressure</b><span>No contracts to review on the call</span></span></div>
        </div>
        <div class="trust-row anim-up d5">
          <span class="avatars" aria-hidden="true"><i>AS</i><i>DS</i><i>PR</i><i>+</i></span>
          <span class="trust-copy"><strong>4.9 average merchant rating</strong><br>
          {stars} from restaurants, retail, salons, and auto shops</span>
        </div>
      </div>
      <div class="anim-up d3">{form}</div>
    </div>
  </div>
</section>""".format(clock=icon("clock"), list=icon("list-checks"), shield=icon("shield"),
                     stars='<span class="stars">%s</span>' % (solid_star() * 5), form=form))

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head("On the call", "We Help You Where You Need It Most",
                            "Tell us which of these matters most and we’ll spend the time there."),
        grid=L.feature_grid(benefits, cols=3)))

    parts.append(L.testimonials())
    parts.append(L.faq_section())
    parts.append(L.footer())
    return "".join(parts)


PLANS = [
    ("Growth", "99", "79", "1,000", ".04", False),
    ("Premium", "159", "127", "3,500", ".03", True),
    ("Elite", "299", "239", "10,000", ".025", False),
    ("Pro Elite", "625", "500", "25,000", ".02", False),
    ("Platinum", "1,250", "1,000", "50,000", ".015", False),
]

COMPARE = [
    ("Plan basics", [
        ("Contacts", "Unlimited", "Unlimited"),
        ("Users", "Unlimited", "Unlimited"),
        ("Locations", "1 included", "1 included"),
        ("Dedicated toll-free text number",
         "1 included<span class='cell-note'>$5/mo per add’l user number</span>",
         "1 included<span class='cell-note'>$5/mo per add’l user number</span>"),
        ("Enable current business phone for SMS",
         "$40 one-time<span class='cell-note'>$15/mo per number</span>",
         "$40 one-time<span class='cell-note'>$15/mo per number</span>"),
    ]),
    ("Messaging", [
        ("Bulk texting with pictures &amp; GIFs", True, True),
        ("One-to-one text messages", True, True),
        ("Custom automated text workflows", True, True),
        ("Group segmentation", True, True),
        ("Trackable offers", True, True),
        ("Digital loyalty program", True, True),
        ("URL shortener", True, True),
        ("Built-in TCPA compliance", True, True),
    ]),
    ("List growth tools", [
        ("Auto QR code generator", True, True),
        ("Embeddable web forms", True, True),
        ("Shareable web forms", True, True),
        ("Cellular-enabled kiosk",
         "$300 per kiosk<span class='cell-note'>+ $15/mo per kiosk</span>",
         "$300 per kiosk<span class='cell-note'>+ $15/mo per kiosk</span>"),
        ("Mobile web app", True, True),
        ("Keyword marketing", True, True),
        ("List upload tool", True, True),
    ]),
    ("Automated text tools", [
        ("Automated “missed call” text back", True, True),
        ("Reputation management", True, True),
        ("Google reviews automation", True, True),
        ("Bounce-back automated offer", True, True),
        ("Lapsed &amp; lost customer automated offer", True, True),
        ("Birthday automation", True, True),
        ("Anniversary automation", True, True),
        ("Lead engagement workflow automation", True, True),
        ("Employee onboarding workflow automation", True, True),
        ("Recruiting workflow automation", True, True),
    ]),
    ("Onboarding and support", [
        ("Step-by-step onboarding", True, True),
        ("Phone &amp; chat support", True, True),
        ("Training resource center", True, True),
        ("Dedicated customer success manager", True, True),
        ("Custom set-up", True, True),
    ]),
]


def plan_card(name, monthly, annual, credits, rate, featured):
    return """<article class="plan{feat}" data-reveal>
  <span class="plan-name">{name}</span>
  <div class="plan-price">
    <span class="amt">$<span data-price-monthly="{monthly}"
      data-price-annual="{annual}">{monthly}</span></span>
    <span class="per">/ mo</span>
  </div>
  <p class="plan-was" data-bill-note data-note-monthly="Billed monthly"
     data-note-annual="Billed annually — save up to 20%">Billed monthly</p>
  <div class="plan-credits">
    <b>{credits}</b><span>Credits per month</span>
    <div class="rate"><strong>${rate}</strong> per additional credit ·
    SMS = 1 credit, MMS = 3 credits</div>
  </div>
  <a class="btn {btn} btn-block" href="book-demo.html">Get started now</a>
  <p class="plan-note">Unlimited contacts and users on every plan.</p>
</article>""".format(feat=" featured" if featured else "", name=name.upper(),
                     monthly=monthly, annual=annual, credits=credits, rate=rate,
                     btn="btn-primary" if featured else "btn-ghost")


def build_pricing():
    def cell(v):
        if v is True:
            return '<span class="tick">%s</span>' % icon("check")
        if v is False:
            return '<span class="dash">—</span>'
        return v

    rows = []
    for group, items in COMPARE:
        rows.append('<tr class="group"><td colspan="3">%s</td></tr>' % group)
        for label, a, b in items:
            rows.append("<tr><td>%s</td><td>%s</td><td>%s</td></tr>"
                        % (label, cell(a), cell(b)))

    parts = [L.head("Pricing",
                    "Simple pricing built to drive results. Unlimited contacts and users on "
                    "every plan — choose the monthly credit volume that fits your business.",
                    active="pricing", body_class="page-pricing")]

    parts.append("""<section class="page-hero">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <span class="pill anim-up d1"><span class="dot"></span>Pricing</span>
    <h1 class="t-h1 anim-up d2" style="margin-top:22px">Simple Pricing Built to Drive Results</h1>
    <p class="lede anim-up d3">Unlimited contacts. Unlimited users. Every feature on every plan.
    The only thing that changes is how many message credits you need each month.</p>
    <div class="center anim-up d4" style="margin-top:30px">
      <div class="bill-toggle">
        <span class="knob" aria-hidden="true"></span>
        <button type="button" data-bill="monthly" aria-pressed="true">Monthly</button>
        <button type="button" data-bill="annual" aria-pressed="false">Annual
          <span class="save-badge">Save 20%</span></button>
      </div>
    </div>
  </div>
</section>""")

    parts.append("""<section class="section-sm">
  <div class="shell">
    <div class="plans grid g-2" data-stagger="90">{a}{b}</div>
    <p class="center body-sm mt-4" data-reveal>Need more volume? High-usage plans start below.</p>
  </div>
</section>""".format(a=plan_card(*PLANS[0]), b=plan_card(*PLANS[1])))

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    <div class="compare-wrap" data-reveal>
      <table class="compare">
        <thead><tr><th>Feature</th><th>Growth</th><th>Premium</th></tr></thead>
        <tbody>{rows}</tbody>
      </table>
    </div>
    <p class="center body-sm mt-4" data-reveal>Every feature is included on both plans — plans
    differ by monthly message credits.</p>
  </div>
</section>""".format(
        head=L.section_head("Plan comparison", "Choose the Option That Fits Your Business",
                            "Same platform, same support. Pick your credit volume."),
        rows="".join(rows)))

    parts.append("""<section class="section section-tint">
  <div class="shell">
    {head}
    <div class="plans grid g-3" data-stagger="90">{cards}</div>
  </div>
</section>""".format(
        head=L.section_head("High volume", "High-Usage Plan Options",
                            "For multi-location merchants and heavy senders — the per-credit "
                            "rate drops as volume grows."),
        cards="".join(plan_card(*p) for p in PLANS[2:])))

    parts.append("""<section class="section">
  <div class="shell">
    {head}
    {grid}
  </div>
</section>""".format(
        head=L.section_head("Add-ons", "Hardware and Extras",
                            "Only pay for what your locations actually use."),
        grid=L.feature_grid([
            ("kiosk", "Cellular-Enabled Kiosk",
             "$300 per kiosk plus $15/mo per kiosk. Tamper-proof case, runs on cellular data — "
             "just plug it in."),
            ("phone", "Business Phone to SMS",
             "$40 one-time setup, then $15/mo per number to text-enable the number customers "
             "already know."),
            ("message-dots", "Additional User Numbers",
             "$5/mo per additional user number so each team member can hold their own "
             "conversations."),
        ], cols=3)))

    parts.append(L.faq_section(items=[
        ("What is a credit?",
         "<p>A credit is one message segment. <strong>SMS costs 1 credit</strong> and "
         "<strong>MMS costs 3 credits</strong>. Unused credits do not roll over, and additional "
         "credits are billed at your plan’s per-credit rate.</p>"),
        ("Are contacts or users limited?",
         "<p>No. Every plan includes <strong>unlimited contacts and unlimited users</strong>. "
         "Plans differ only by the number of monthly message credits.</p>"),
        ("What does the annual price include?",
         "<p>Paying annually lowers the effective monthly rate by up to 20% — for example "
         "Growth moves from $99/mo to $79/mo. Everything else about the plan is identical.</p>"),
    ] + L.FAQS[:3]))

    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_sign_in():
    parts = [L.head("Sign In", "Log in to your Customer Connect merchant dashboard.",
                    body_class="page-sign-in")]
    parts.append("""<section class="auth-wrap">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="shell" style="position:relative;z-index:1;display:grid;place-items:center">
    <div class="auth-card anim-up d1">
      <div class="auth-head">
        <img class="brand-mark" src="assets/img/mark.png" alt="" width="143" height="217">
        <h1 class="t-h3">Merchant sign-in</h1>
        <p class="body-sm" style="margin-top:10px">Welcome back. Log in to manage campaigns,
        contacts, and loyalty.</p>
      </div>
      <form class="form-card">
        <div class="field">
          <label for="user">Email or mobile number</label>
          <input id="user" name="user" type="text" autocomplete="username" required>
        </div>
        <div class="field">
          <label for="pw">Password</label>
          <input id="pw" name="password" type="password" autocomplete="current-password" required>
        </div>
        <div class="check-row">
          <input id="remember" type="checkbox">
          <label for="remember">Keep me signed in on this device</label>
        </div>
        <div class="form-foot">
          <button class="btn btn-primary btn-lg btn-block" type="submit">Sign in</button>
        </div>
        <div class="auth-divider">or</div>
        <a class="btn btn-ghost btn-block" href="book-demo.html">Don’t have an account? Book a demo</a>
        <p class="form-note">Trouble signing in? Call or text
        <a href="tel:{tel}">{phone}</a> or email
        <a href="mailto:{email}">{email}</a>.</p>
      </form>
      <p class="auth-alt">Kiosk not working? See
      <a href="troubleshooting.html">kiosk troubleshooting</a>.</p>
    </div>
  </div>
</section>""".format(tel=L.PHONE_TEL, phone=L.PHONE_DISPLAY, email=L.EMAIL))
    parts.append(L.footer())
    return "".join(parts)


def build_blog():
    featured = POSTS[0]
    rest = POSTS[1:10]
    parts = [L.head("Resource Center",
                    "Playbooks, benchmarks, and field notes on loyalty, text marketing, "
                    "reviews, and retention for local business.",
                    active="blog", body_class="page-blog")]

    parts.append("""<section class="page-hero">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span><span class="orb orb-b"></span></div>
  <div class="bg-grid" aria-hidden="true"></div>
  <div class="shell">
    <span class="pill anim-up d1"><span class="dot"></span>Resource center</span>
    <h1 class="t-h1 anim-up d2" style="margin-top:22px">Ideas That Turn Visits Into Revenue</h1>
    <p class="lede anim-up d3">Playbooks, benchmarks, and field notes from merchants growing
    revenue with loyalty, text marketing, and reviews.</p>
  </div>
</section>""")

    parts.append("""<section class="section-sm">
  <div class="shell">
    <div class="article-layout">
      <div>
        <a class="post-card post-feature" href="{fslug}.html" data-reveal>
          <div class="post-thumb"><span class="post-cat">{fcat}</span>{fico}</div>
          <div class="post-body">
            <time datetime="{fiso}">{fdate} · {fread}</time>
            <h3>{ftitle}</h3>
            <p>{fexcerpt}</p>
            <span class="link-arrow">Read article {ar}</span>
          </div>
        </a>
        <div class="grid g-2 mt-4" data-stagger="70">{cards}</div>
        <nav class="pager" aria-label="Pagination">
          <span class="current" aria-current="page">1</span>
          <a href="blog.html">2</a>
          <a href="blog.html" aria-label="Next page">{next}</a>
        </nav>
      </div>
      {side}
    </div>
  </div>
</section>""".format(
        fslug=featured["slug"], fcat=featured["category"], fico=icon(featured["icon"]),
        fiso=featured["iso"], fdate=featured["date"], fread=featured["read"],
        ftitle=featured["title"], fexcerpt=featured["excerpt"],
        ar=icon("arrow-right", cls="ico"),
        cards="".join(L.post_card(p) for p in rest),
        next=icon("chevron-right"), side=blog_sidebar()))

    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_post(src, post, prev_post, next_post):
    body = load_longform(src, post["slug"], extract_article)
    if not body:
        body = "<p>%s</p>" % post["excerpt"]

    nav_items = []
    if prev_post:
        nav_items.append('<a class="prev" href="%s.html"><small>← Previous</small>'
                         '<b>%s</b></a>' % (prev_post["slug"], prev_post["title"]))
    if next_post:
        nav_items.append('<a class="next" href="%s.html"><small>Next →</small>'
                         '<b>%s</b></a>' % (next_post["slug"], next_post["title"]))

    share = "".join(
        '<a href="#" aria-label="Share on %s">%s</a>' % (n, icon(i))
        for i, n in [("x-social", "X"), ("facebook", "Facebook"),
                     ("linkedin", "LinkedIn"), ("mail", "Email"), ("link", "Copy link")])

    parts = [L.head(post["title"], post["excerpt"], active="blog",
                    body_class="page-article")]

    parts.append("""<article>
<section class="article-hero">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span></div>
  <div class="shell shell-narrow">
    {crumbs}
    <span class="tag" style="margin-top:20px;display:inline-flex">{cat}</span>
    <h1 class="t-h1" style="margin-top:16px">{title}</h1>
    <div class="article-meta">
      <span>{cal} <time datetime="{iso}">{date}</time></span>
      <span class="sep" aria-hidden="true"></span>
      <span>{clock} {read}</span>
      <span class="sep" aria-hidden="true"></span>
      <span>Customer Connect</span>
    </div>
  </div>
</section>

<section class="section-sm">
  <div class="shell">
    <div class="article-layout">
      <div>
        <div class="prose" data-reveal>{body}</div>
        <div class="share"><span>Share</span>{share}</div>
        {nav}
      </div>
      {side}
    </div>
  </div>
</section>
</article>""".format(
        crumbs=crumbs([("Home", "index.html"), ("Resource Center", "blog.html"),
                       (post["category"], None)]),
        cat=post["category"], title=post["title"], iso=post["iso"], date=post["date"],
        read=post["read"], cal=icon("calendar"), clock=icon("clock"),
        body=body, share=share,
        nav='<nav class="article-nav">%s</nav>' % "".join(nav_items) if nav_items else "",
        side=blog_sidebar(post["category"])))

    parts.append(L.resources_section(related_posts(post["slug"]),
                                     title="Keep Reading",
                                     eyebrow="Related",
                                     lede="More on loyalty, retention, and text that converts."))
    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_hub(kind):
    """Hub pages: products, solutions, resource-center."""
    if kind == "solutions":
        title, eyebrow = "Solutions", "Solutions"
        h1 = "Solutions Built Around the Outcome You Need"
        lede = ("Growth and retention, reputation, team engagement, and insight — start with "
                "the problem, not the feature list.")
        groups = L.SOLUTIONS
        meta = ("Explore Customer Connect solutions: customer loyalty, retention, text "
                "marketing, reputation management, employee engagement, recruiting, and data "
                "tracking.")
    elif kind == "products":
        title, eyebrow = "Products", "Products"
        h1 = "Every Tool in the Platform"
        lede = ("Loyalty, SMS and MMS, mobile web app, 1-to-1 conversations, reviews, kiosks, "
                "and the analytics that tie it all to revenue.")
        groups = L.PRODUCTS
        meta = ("Explore the Customer Connect platform: loyalty program, SMS and MMS, custom "
                "mobile web app, 1-to-1 conversations, online reviews, kiosks, and analytics.")
    else:
        title, eyebrow = "Resource Center", "Resource center"
        h1 = "Everything You Need to Get More From the Platform"
        lede = ("Guides, playbooks, and support docs — plus every article we publish for "
                "merchants growing with loyalty and text.")
        groups = None
        meta = ("Guides, playbooks, and support resources for Customer Connect merchants.")

    parts = [L.head(title, meta, body_class="page-hub")]
    parts.append(L.page_hero(eyebrow, h1, lede,
                             primary=("Book a Demo", "book-demo.html"),
                             secondary=("See pricing", "pricing.html")))

    if groups:
        for heading, links in groups:
            items = [(ic, name, desc, href) for href, ic, name, desc in links]
            cards = "".join(
                """<a class="card card-hover card-glow feature-card" href="{href}" data-reveal>
  <div class="feature-ico">{ico}</div><h3>{name}</h3><p>{desc}</p>
  <span class="link-arrow mt-3">Explore {ar}</span>
</a>""".format(href=href, ico=icon(ic), name=name, desc=desc,
               ar=icon("arrow-right", cls="ico"))
                for ic, name, desc, href in items)
            parts.append("""<section class="section-sm">
  <div class="shell">
    <div class="section-head left" data-reveal><span class="micro">{heading}</span></div>
    <div class="grid g-3" data-stagger="70">{cards}</div>
  </div>
</section>""".format(heading=heading, cards=cards))
        parts.append(L.marquee())
    else:
        docs = [
            ("book", "Kiosk Troubleshooting",
             "Black screen, white screen, app crashes — fix the most common kiosk issues in "
             "minutes.", "troubleshooting.html"),
            ("shield", "Compliance Guide",
             "How opt-in, opt-out, and record keeping work on the platform, and what TCPA and "
             "CTIA require.", "compliance.html"),
            ("handshake", "Customer Success",
             "Onboarding, strategy support, and the team that helps you launch and grow.",
             "customer-success.html"),
            ("bar-chart", "Analytics Basics",
             "What to measure, what to ignore, and how to prove ROI on every campaign.",
             "data-analytics.html"),
            ("list-checks", "Pricing &amp; Plans",
             "Credits, add-ons, and what’s included on every plan.", "pricing.html"),
            ("message-dots", "Talk to a Specialist",
             "20 minutes, tailored to your business, with a real launch plan at the end.",
             "book-demo.html"),
        ]
        cards = "".join(
            """<a class="card card-hover card-glow feature-card" href="{href}" data-reveal>
  <div class="feature-ico">{ico}</div><h3>{name}</h3><p>{desc}</p>
  <span class="link-arrow mt-3">Open {ar}</span>
</a>""".format(href=href, ico=icon(ic), name=name, desc=desc,
               ar=icon("arrow-right", cls="ico"))
            for ic, name, desc, href in docs)
        parts.append("""<section class="section">
  <div class="shell">
    {head}
    <div class="grid g-3" data-stagger="70">{cards}</div>
  </div>
</section>""".format(head=L.section_head("Guides &amp; support", "Start Here",
                                         "The docs merchants reach for most."),
                     cards=cards))
        parts.append(L.resources_section(POSTS[:6], title="Latest Articles",
                                         eyebrow="From the blog",
                                         lede="Fresh thinking on loyalty, retention, and text."))

    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


def build_doc(src, slug, title, eyebrow, h1, lede, meta):
    """Legal / support pages that reuse the original long-form copy."""
    body, toc = headings(load_longform(src, slug, extract_widgets))
    if not body:
        body = "<p>%s</p>" % lede

    toc_html = ""
    if len(toc) >= 3:
        items = "".join('<li><a href="#%s">%s</a></li>' % (s, t) for s, t in toc)
        toc_html = """<aside class="side">
  <div class="side-card toc-card">
    <h4>On this page</h4>
    <ul class="toc-list">{items}</ul>
  </div>
  <div class="side-cta">
    <h4>Need a human?</h4>
    <strong>We’re one text away</strong>
    <p>Call or text {phone}, or email {email}.</p>
    <a class="btn btn-solid-light btn-block btn-sm" href="tel:{tel}">Call or text us</a>
  </div>
</aside>""".format(items=items, phone=L.PHONE_DISPLAY, email=L.EMAIL, tel=L.PHONE_TEL)

    parts = [L.head(title, meta, body_class="page-doc")]
    parts.append("""<section class="article-hero">
  <div class="bg-orbs" aria-hidden="true"><span class="orb orb-a"></span></div>
  <div class="shell">
    {crumbs}
    <span class="pill" style="margin-top:20px"><span class="dot"></span>{eyebrow}</span>
    <h1 class="t-h1" style="margin-top:18px">{h1}</h1>
    <p class="lede" style="max-width:680px">{lede}</p>
  </div>
</section>

<section class="section-sm">
  <div class="shell">
    <div class="article-layout">
      <div class="prose" data-reveal>{body}</div>
      {toc}
    </div>
  </div>
</section>""".format(
        crumbs=crumbs([("Home", "index.html"), (title, None)]),
        eyebrow=eyebrow, h1=h1, lede=lede, body=body, toc=toc_html))

    parts.append(L.cta_band())
    parts.append(L.footer())
    return "".join(parts)


# ==========================================================================
# Orchestration
# ==========================================================================

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC,
                    help="directory holding the original WordPress HTML export")
    ap.add_argument("--out", default=ROOT, help="output directory")
    args = ap.parse_args()

    src, out = args.src, args.out
    os.makedirs(out, exist_ok=True)
    written = []

    def write(name, markup):
        with open(os.path.join(out, name), "w", encoding="utf-8") as fh:
            fh.write(markup)
        written.append(name)

    write("index.html", build_index())
    write("connect-grow.html", build_connect_grow())
    write("book-demo.html", build_book_demo())
    write("pricing.html", build_pricing())
    write("sign-in.html", build_sign_in())
    write("blog.html", build_blog())

    for kind in ("solutions", "products", "resource-center"):
        write("%s.html" % kind, build_hub(kind))

    for slug, data in PAGES.items():
        write("%s.html" % slug, build_solution_page(slug, data))

    for i, post in enumerate(POSTS):
        prev_post = POSTS[i + 1] if i + 1 < len(POSTS) else None
        next_post = POSTS[i - 1] if i > 0 else None
        write("%s.html" % post["slug"], build_post(src, post, prev_post, next_post))

    write("privacy.html", build_doc(
        src, "privacy", "Privacy Policy", "Legal",
        "Privacy Policy",
        "How Wholesale Payments dba Customer Connect collects, uses, and protects information "
        "from our sites and kiosks — including SMS consent data.",
        "Privacy Policy for Wholesale Payments dba Customer Connect, covering data collection, "
        "SMS consent, cookies, and your choices."))

    write("merchant-terms.html", build_doc(
        src, "merchant-terms", "Terms &amp; Conditions", "Legal",
        "Merchant Terms &amp; Conditions",
        "The agreement between Wholesale Payments, Corp. d/b/a Customer Connect and merchants "
        "using the platform, equipment, and SMS program.",
        "Merchant terms and conditions for the Customer Connect platform, equipment, billing, "
        "and SMS program."))

    write("troubleshooting.html", build_doc(
        src, "troubleshooting", "Kiosk Troubleshooting", "Support",
        "Kiosk Troubleshooting",
        "Black screen, white screen, or app crash? Work through these steps before calling — "
        "most kiosk issues clear in under two minutes.",
        "Step-by-step troubleshooting for the Customer Connect loyalty kiosk: black screen, "
        "white screen, connectivity, and app crashes."))

    # --- sitemap + robots -------------------------------------------------
    base = "https://customerconnectwp.com/"
    priority = {"index.html": "1.0", "pricing.html": "0.9", "book-demo.html": "0.9",
                "blog.html": "0.8", "connect-grow.html": "0.8"}
    urls = []
    for name in sorted(written):
        loc = base if name == "index.html" else base + name
        urls.append("  <url>\n    <loc>%s</loc>\n    <priority>%s</priority>\n  </url>"
                    % (loc, priority.get(name, "0.7")))
    write("sitemap.xml",
          '<?xml version="1.0" encoding="UTF-8"?>\n'
          '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
          + "\n".join(urls) + "\n</urlset>\n")
    write("robots.txt",
          "User-agent: *\nAllow: /\n\nSitemap: %ssitemap.xml\n" % base)

    # --- web app manifest -------------------------------------------------
    # short_name matches the wordmark baked into the icon, so the home-screen
    # label reads "WPI CC" under it rather than the full product name.
    write("site.webmanifest", """{
  "name": "Customer Connect by Wholesale Payments",
  "short_name": "WPI CC",
  "description": "Text marketing, digital loyalty, reviews and real-time insights for local business.",
  "start_url": "./",
  "scope": "./",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#00115b",
  "theme_color": "#00115b",
  "icons": [
    {
      "src": "assets/img/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "assets/img/icon-512.png",
      "sizes": "512x512",
      "type": "image/png",
      "purpose": "any maskable"
    }
  ]
}
""")

    print("Wrote %d files to %s" % (len(written), out))
    missing = [n for n in written if not os.path.getsize(os.path.join(out, n))]
    if missing:
        print("WARNING: empty output for %s" % ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
