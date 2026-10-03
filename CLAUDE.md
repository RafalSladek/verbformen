# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

German irregular-verb flashcard trainer for a 3rd-grade class (UI text is German). Static site, no build step, no dependencies, no package manager, no tests, no linter. Served via GitHub Pages at `verbformen.rafal-sladek.com` (see `CNAME`). Pushing to `main` deploys.

To run: open `index.html` in a browser, or serve the directory (e.g. `python -m http.server`). Manifest `start_url` is `/`, so home-screen install only works when served from the domain root.

## Architecture

Everything lives in one file, `index.html` (inline `<style>` + inline `<script>`). Other files are only icons (`img/`, `favicon.ico`) and `site.webmanifest`; all are wired up via `<link>`/`<meta>` tags in the `<head>`.

Script structure:
- `VERBS` array: `{ g: Grundform, p: Präsens (first/third person with pronoun), pt: Präteritum }`. Strings include the pronoun (`"ich backe"`, `"es fließt"`); alternates use ` / `. Keep alphabetical order. The "Verb 1 von 103" text in the HTML is a placeholder overwritten by `renderNow()`, so no manual count update is needed when adding verbs.
- Global state: `mode` (1 Kennen, 2 Lernen, 3 Testen), `deck` (copy of `VERBS`; shuffled in mode 3), `idx`, `state` (0/1/2 = which form is revealed in modes 2/3), `busy` (blocks input during flip animation).
- `setMode` rebuilds the deck and resets; `renderNow` is the single render function (rewrites `#card-content` via `innerHTML`, updates progress, dots, button disabled state, card colour class via `cardBg`).
- `withFlip(fn)` wraps state mutations in a CSS flip-out/flip-in animation (timings in JS `setTimeout` 185/190ms must match the 0.18s CSS transitions).
- Mode 1 shows all three forms at once; modes 2/3 reveal one form per tap (`handleCardClick`), advancing with `navigate`. Finish banner appears on the last card in modes 2/3 only.
- Keyboard: ArrowLeft/Right/Space navigate, Enter reveals.

Theming: CSS custom properties on `:root`/`[data-theme="dark"]` and `[data-theme="light"]`; `applyTheme` sets `data-theme` on `<html>` and persists to `localStorage` key `vf-theme` (wrapped in try/catch). Add new colours as variables in both themes.
