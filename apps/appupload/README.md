# AppUpload — Handwritten merchant applications → typed forms

An automated photo-upload site for merchant-services sales agents. Photograph a
**handwritten merchant application** plus its supporting documents, and the site:

1. **Auto-detects** which application it is — **Citizens** (Priority / Citizens Bank)
   or **Merrick** (Merrick Bank).
2. **Reads** the handwriting with Claude's vision model and pulls each value from the
   most authoritative source:
   - **owner identity** (name, address, DOB, driver's-license #, state, expiration) from the **driver's license**,
   - **bank name, routing # and account #** from the **voided check** (MICR line),
   - everything else (SSN, ownership %, fees, volumes…) from the **application**.
3. **Transposes** the data cleanly onto the correct typed application PDF.
4. **Generates a pre-filled coversheet** (the "Required Set Up Form") from that same data.
5. Lets you **review and edit every field** — and fill in anything that was blank or
   unreadable — before generating.

There's also a second workflow: **Menu → Clover**. Upload a photo of a restaurant
menu and get the Clover inventory-import spreadsheet (`.xlsx`) filled in with items,
prices and categories.

Documents are processed **in memory** and are **not stored**.

## How the form-filling works

The source application/coversheet PDFs are encrypted (so they can't be edited
directly). At build time each template page is rendered to a high-resolution image
and its label coordinates are extracted (`npm run build:templates`). At runtime the
filled form is composited as: **rendered page image + crisp text overlay** drawn at
the right coordinates with `pdf-lib`. The overlay values are real, selectable text;
numbers are anchored to the preprinted `$`/`%` symbols so they land cleanly inside
each box.

## Quick start

```bash
npm install

# Live (recommended)
export ANTHROPIC_API_KEY=sk-ant-...     # or use a .env file (see .env.example)
npm start

# Demo (no API key; returns sample data so you can preview the whole flow)
TRANSCRIBE_MOCK=1 npm start
```

Open http://localhost:3000.

> The rendered template backgrounds and label coordinates are committed under
> `assets/rendered/` and `assets/anchors/`, so the app runs without a build step.
> If you replace a template PDF in `assets/templates/`, re-run `npm run build:templates`.

## Configuration

| Variable            | Default              | Purpose                                                       |
| ------------------- | -------------------- | ------------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | _(none)_             | Required for live extraction.                                 |
| `ANTHROPIC_MODEL`   | `claude-sonnet-4-6`  | Vision model. Use `claude-opus-4-8` for the hardest handwriting. |
| `PORT`              | `3000`               | HTTP port.                                                    |
| `TRANSCRIBE_MOCK`   | _(unset)_            | Set to `1` to return sample data without calling the API.     |

## API

- `GET  /api/health` → `{ ok, ready, mock, model }`
- `POST /api/extract` — multipart `images` (application pages + check + license) → `{ record }`
- `POST /api/packet` — JSON `{ record, form?, date?, kind: 'combined'|'application'|'coversheet' }` → streams a PDF
- `POST /api/menu/extract` — multipart `images` (menu photos) → `{ menu }`
- `POST /api/menu/xlsx` — JSON `{ menu }` → streams the Clover `.xlsx`

## Project layout

```
server.js                 Express app + routes
lib/extract.js            Claude vision: classify images, detect form, extract a structured record
lib/anchors.js            Loads prebuilt label coordinates + page backgrounds
lib/formMaps.js           Where each value is placed on each form (Citizens / Merrick / coversheet)
lib/fillForm.js           Composites background + text overlay (pdf-lib); merges the packet
lib/menu.js               Menu extraction + fills the Clover inventory template (exceljs)
assets/templates/         Source PDFs + Clover xlsx template
assets/rendered/          Prebuilt page-background images (per form/page)
assets/anchors/           Prebuilt label coordinates (per form)
public/                   Upload UI, review form, menu table
scripts/                  build-templates + dev/verification tooling
```

## Maintenance scripts (dev only)

These use `devDependencies` (`pdfjs-dist`, `@napi-rs/canvas`, `playwright-core`):

```bash
npm run build:templates                              # regenerate backgrounds + anchors
node scripts/inspect-template.mjs <pdf> [page]       # dump a template's text positions
node scripts/verify-overlay.mjs <form> <outPrefix>   # draw real placements onto the bg for visual QA
node scripts/smoke-ui.mjs <outPrefix>                # headless UI smoke test (server must be running, demo mode)
```

## Notes & limits

- Up to **15 images** per submission; each up to **15 MB**. Images are downscaled in
  the browser (max 1568px long edge) before upload.
- Accuracy depends on photo quality — good lighting, a flat page, the whole document
  in frame. **Always review the extracted fields before relying on the output.**
- The tool transposes data for legibility and pre-fills forms; it does not submit
  anything to any third-party system.
```
