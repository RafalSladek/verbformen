# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Static site served via GitHub Pages at `verbformen.rafal-sladek.com` (see `CNAME`). No build step, no package manager, no linter. Pushing to `main` deploys everything in the repo, so anything committed is public.

Three separate pieces share the repo:

| Path | What |
|---|---|
| `index.html` (+ `img/`, `favicon.ico`, `site.webmanifest`) | German irregular-verb flashcard trainer for a 3rd-grade class (UI is German). |
| `fea-fbb/` | Polish/German/English form for the FEA-FBB adult-ADHD questionnaire (rated by a relative), published at `/fea-fbb/`. Produces a German PDF / e-mail for the doctor. |
| `fea-translate/` | Cloudflare Worker that proxies DeepL for the notes field of `fea-fbb`. Not part of the Pages site's functionality; deployed separately with wrangler. |

To run either page: open the `index.html` in a browser, or serve the repo root (`python -m http.server 8766`). The Worker only allows the production origin, so translation fails on localhost (the page then falls back to sending the original notes only); test it against the live site.

## Verb trainer (`index.html`)

Everything lives in one file (inline `<style>` + inline `<script>`).

- `VERBS` array: `{ g: Grundform, p: Präsens (with pronoun), pt: Präteritum }`. Strings include the pronoun (`"ich backe"`, `"es fließt"`); alternates use ` / `. Keep alphabetical. The "Verb 1 von 103" text in the HTML is a placeholder overwritten by `renderNow()`.
- Global state: `mode` (1 Kennen, 2 Lernen, 3 Testen), `deck` (shuffled in mode 3), `idx`, `state` (0/1/2 = revealed form), `busy` (blocks input during flip animation).
- `renderNow` is the single render function (rewrites `#card-content` via `innerHTML`). `withFlip(fn)` wraps state changes in a flip animation; the JS `setTimeout` values (185/190 ms) must match the 0.18 s CSS transitions.
- Theming: CSS variables on `[data-theme="dark"|"light"]`, persisted in `localStorage` key `vf-theme`. Add colours to both themes.

## FEA-FBB form (`fea-fbb/index.html`)

Single file again, plus `favicon.svg`. jsPDF is loaded from cdnjs (`defer`), so PDF export needs internet.

- Content model: `QUESTIONS` (20 items + A1–A5, each with `pl`, `en`, `de`), `SCALE` (0–3 with labels per language), `UI` (all interface strings per language, including function-valued ones like `stQ(n, t)`). **`de` is the verbatim original wording of the official form** and is what goes into the PDF and e-mail; do not paraphrase it. Screens in PL/EN deliberately show no German; the German UI shows only German.
- Steps: 0 intro, 1..`NQ` questions, `NQ+1` notes, `NQ+2` summary/send. `data.step` is persisted; `go()`/`answer()` save and call `render()`, the single render function.
- State `data` is saved to `localStorage` key `fea-fbb-v1` (`step`, `lang`, `answers` keyed by question id, `meta`, `notes`, cached `notesDe`/`notesDeKey`). `load()` deliberately resets `lang` to `pl` and `meta.date` to today on every visit. `meta.rel` is stored as the key `mother`/`father` and localised at display time (PDF prints `Mutter`/`Vater` via `REL_DE`).
- Everything sent to the doctor is German regardless of UI language: `buildPdf()` (between the `// ==PDF-START==`/`// ==PDF-END==` markers; reproduces the original two-page form layout in millimetres, circles the chosen digit) and `germanText()` (mail body, `Antwort: 2 (weitgehend)`). jsPDF's built-in Helvetica is WinAnsi-only, so short fields go through `pdfSafe()` (Polish letters transliterated) while the free-text notes are rendered on a canvas (`notesImage`) and embedded as images to keep Polish letters.
- Notes translation: when the UI language is not German, entering the summary step calls `ensureTranslation()`, which posts the notes to `TRANSLATE_URL` (the Worker); the send buttons are disabled while `trState === 'busy'`. Result is cached by `notesKey()` (language + text). PDF/mail then contain the original plus the German translation; on failure only the original is sent and a retry link is shown. Share/mail/PDF handlers must stay synchronous after the click (`navigator.share` needs the user gesture), which is why translation happens before, not inside, the click.
- Sending: `sharePdf()` uses Web Share with a `File` (WhatsApp attachment); falls back to download. `mailPdf()` downloads the PDF and opens a `mailto:` whose body is the full German text (mailto cannot attach files; body is ~5.5k chars after encoding).
- Colours are colour-blind safe by design: one-hue blue lightness ramp plus orange accent; every answer also has a digit, text label and bar icon. Keep colour from being the only cue.
- Testing: there is no test suite. To verify PDF fidelity, drive the page with real clicks, export `makePdf().doc.output('datauristring')`, then read the circles back from the PDF (e.g. PyMuPDF `page.get_drawings()`, circles ≈5 mm wide, column centres at x = 167/175/183/191 mm) and compare with the stored answers.

## Translation Worker (`fea-translate/`)

`src/index.js` accepts `POST {text, source: 'pl'|'en'}` from origins listed in `ALLOWED_ORIGINS` (`wrangler.jsonc`, currently only the production origin; everything else gets 403), calls DeepL (`api-free.deepl.com` when the key ends in `:fx`) and returns `{text}`. Max 4000 chars. It stores and logs nothing.

- Tests: `node fea-translate/test.mjs` (stubs `fetch`, no network or key needed).
- Deploy: `cd fea-translate && npx wrangler deploy` (live at `https://fea-translate.rafal-sladek.workers.dev`, which is hard-coded as `TRANSLATE_URL` in `fea-fbb/index.html`).
- Secret `DEEPL_KEY` must be set with `npx wrangler secret put DEEPL_KEY` **in a real interactive terminal**: in a non-interactive shell wrangler silently uploads an empty secret and the Worker answers 500 "not configured". Never paste the key into chat or a command argument.
- To test against localhost temporarily, add `http://localhost:<port>` to `ALLOWED_ORIGINS`, redeploy, and remove it again afterwards.
