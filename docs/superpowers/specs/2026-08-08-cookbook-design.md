# Cody's Cookbook — Design Spec

**Date:** 2026-08-08
**Status:** Approved pending user review

## Overview

A personal recipe website, used almost entirely on Cody's iPhone, optimized for one moment: cooking with the phone propped up in the kitchen. No logins, no security, no backend. The site is static; Claude Code is the content management system and the chef.

Two halves:

1. **The site** — a zero-build static PWA on Cloudflare Pages that renders recipes from JSON files.
2. **The repo skills** — a `chef` skill (the persona Cody talks to) and an `add-recipe` skill (the librarian that converts finished recipes into site content and deploys).

## Goals

- Perfect iPhone cooking-mode UI: wake lock, checkable ingredients/steps, inline step timers, serving scaler.
- Home screen with search + tag filters.
- "Give Claude a chat about a recipe → the site updates" with no manual editing.
- "Give Claude a recipe link or YouTube video → the chef reviews it, adapts it to Cody's taste, and the site updates."
- A chef persona with Michelin-level instincts that knows Cody's people, kitchen, and pantry, and learns over time.
- Codebase small and legible enough that any future Claude session understands it instantly.

## Non-goals

- No authentication or user accounts.
- No web backend or Claude API integration. Recipe generation happens in Claude Code sessions, not on the website. (This deliberately replaces the original "prompt box on the website" stretch goal.)
- No live pantry inventory tracking (staples only; the chef asks about perishables).

## 1. Recipe data model

Each recipe is one JSON file: `recipes/<id>.json`. Structured data (not Markdown) because the serving scaler and step timers need numeric quantities and explicit durations.

```json
{
  "id": "pan-seared-ribeye",
  "title": "Pan-Seared Ribeye",
  "description": "Butter-basted, dry-brined the night before.",
  "tags": ["beef", "stovetop", "weeknight"],
  "servings": 2,
  "activeMinutes": 20,
  "totalMinutes": 45,
  "difficulty": "easy",
  "photo": null,
  "source": "Claude chat, Jan 2026",
  "ingredientGroups": [
    {
      "name": null,
      "items": [
        { "qty": 1, "unit": "lb", "item": "ribeye", "note": "about 1.5 in thick" },
        { "qty": null, "unit": null, "item": "flaky salt", "note": "to finish" }
      ]
    }
  ],
  "steps": [
    { "text": "Sear undisturbed until deeply browned, 3 minutes per side.", "minutes": 6,
      "why": "A hard, undisturbed sear builds the crust; moving the steak early tears it off." }
  ],
  "notes": [
    { "title": "Why dry brine", "body": "Salt overnight pulls moisture out, then back in..." }
  ],
  "plating": "Slice against the grain, fan on a warm plate, spoon over butter, finish with flaky salt.",
  "elevations": ["Scrape fresh horseradish over the resting butter."],
  "pairings": ["Charred broccolini", "A big Zinfandel"],
  "pairsWith": ["garlic-bread"],
  "variations": []
}
```

Field rules:

- `id`: kebab-case, matches filename, used in the URL hash.
- `qty`: number or `null`. Numeric quantities scale with the serving scaler; `null` ("to taste") renders as-is and never scales.
- `unit`: string (e.g., `"oz"`, `"lb"`, `"cup"`, `"tbsp"`) or `null` for count items — "2 eggs" is `{ "qty": 2, "unit": null, "item": "eggs" }`. **Imperial units only** (oz, lb, cups, tbsp, tsp) and temperatures in °F — metric sources get converted on import, never stored.
- `steps[].minutes`: number or absent. Present → that step renders a tap-to-start countdown timer.
- `steps[].why`: string or absent. The teaching layer — any step whose technique isn't self-evident explains its reason in one or two sentences (why char instead of crush, why rest instead of slice). Rendered as a highlighted callout inside the step card. Deeper cross-step technique still lives in `notes`.
- `difficulty`: `"easy" | "medium" | "project"`.
- `photo`: path under `photos/` or `null`.
- `plating`, `variations`, `source`, `notes`: optional; `ingredientGroups[].name` is `null` for ungrouped recipes.
- `elevations` (string array, optional): stored upgrade ideas — the chef's "extras" made permanent on the page.
- `pairings` (string array, optional): free-text accompaniments (sides, wine).
- `pairsWith` (string array of recipe ids, optional): cross-links to other recipes on the site that make a meal together (lasagna ↔ garlic bread ↔ italian salad). Validated: every id must exist, no self-reference. Rendered as tappable link cards. When adding a recipe, the librarian scans the index for natural pairings and proposes links in both directions.

`index.json` is the home-screen index: an array of `{ id, title, description, tags, totalMinutes, difficulty, photo, ingredients }`, where `ingredients` is a flat array of item-name strings so home-screen search can match on them ("what can I make with leeks"). It is maintained by the `add-recipe` skill, always in sync with `recipes/`.

## 2. Site architecture

Plain HTML/CSS/JS. No framework, no build step, no dependencies.

```
site/                     ← the only directory that deploys to the web
  index.html              app shell (both screens live here)
  css/app.css             styles, dark mode via prefers-color-scheme
  js/app.js               hash router + rendering + interactions
  js/scale.js             pure functions: quantity scaling, fraction display
  sw.js                   service worker (offline)
  manifest.webmanifest    PWA manifest (standalone display, icons)
  icons/                  app icons
  index.json              recipe index
  recipes/*.json          one file per recipe
  photos/                 optional recipe photos
scripts/validate.mjs      schema + index-consistency validator (node, no deps)
scripts/scale.test.mjs    node:test unit tests for scale.js
scripts/serve.mjs         local static server for testing (node, no deps)
scripts/make-icons.mjs    one-time PWA icon generator (node, no deps)
```

The site lives under `site/` (not the repo root) so that the chef's knowledge base, specs, and skills are never served on the public URL — `people/*.md` contains third parties' personal details (allergies, preferences) and must not be web-accessible even on an obscure URL.

Routing is hash-based (`#/` home, `#/recipe/<id>`) so Cloudflare Pages needs zero configuration.

### Home screen

- Search box (matches title, description, tags, ingredient names — case-insensitive substring).
- Tag chips derived from the union of all tags in `index.json`; tapping filters (multiple chips AND together).
- Recipe cards: title, description, total time, difficulty, photo thumbnail if present. Large touch targets.

### Recipe screen (cooking mode)

- Header: title, description, meta row (servings, active/total time, difficulty, tags).
- **Serving scaler**: ½× / 1× / 2× buttons plus a custom stepper. Scales all numeric quantities; display uses kitchen-friendly fractions (0.75 → "¾", 1.5 → "1½"). Non-numeric quantities untouched.
- **Ingredients**: two views behind a segmented toggle, both tappable checklists with independently persisted check state:
  - **By component** (default): grouped by `ingredientGroups`, for cooking.
  - **Shopping list**: one row per distinct ingredient (case-insensitive name match) with quantities summed across groups — same-unit amounts add together ("4 + 2 garlic cloves" → "6"); different units join with "+" ("1 cup + 2 tbsp"); to-taste items show without amounts. Scales with the serving scaler. This is the grocery-store view.
- **Steps**: large numbered cards, tap to mark done (dims and collapses slightly). Current position always obvious.
- **Step timers**: steps with `minutes` show a timer button with the duration. Tap → inline countdown. Completion → audible beep + visual flash + vibration (where supported). Timers compute remaining time from wall-clock timestamps so backgrounding the app doesn't drift them. Timer state is in-memory only; a page reload clears it (accepted).
- **Plating**: if present, rendered as a distinct final card after the steps.
- **Elevate it**: `elevations` rendered as cards after plating.
- **Pairs well with**: `pairsWith` recipe links (tappable, navigate in-app) followed by free-text `pairings` cards.
- **Notes**: technique notes rendered as collapsible cards below.
- **Wake lock**: requested via the Screen Wake Lock API whenever a recipe screen is open (iOS Safari 16.4+); released on navigation back; re-acquired on `visibilitychange` when returning to the app. If unavailable, everything else works normally.
- Checklist/step state persists in `localStorage` per recipe so an accidental navigation or reload doesn't lose your place mid-cook; a "reset" control clears it.

### PWA / offline

- Manifest with `display: standalone` so Add to Home Screen yields a full-screen app with an icon.
- Service worker: cache-first for the app shell (HTML/CSS/JS/icons), network-first with cache fallback for `index.json` and `recipes/*.json` — updates always win online; the kitchen works offline.

## 3. Repo skills

### `.claude/skills/chef/` — the persona Cody talks to

Trigger: any cooking conversation in this repo — planning a dish, discussing technique, importing a chat, "I want to make tomato soup for my girlfriend."

The chef is opinionated and Michelin-trained in instinct: it thinks about elevation, seasoning balance, texture contrast, plating, and timing — not just correctness. Core behaviors:

1. **Diner-aware.** Resolves who's eating from `people/` profiles: "for my girlfriend" → her likes/dislikes/allergies, her signature touches, servings for 2. "For her family" → their allergies, dislikes, headcount. Always states its assumptions ("cooking for 2, no cilantro").
2. **Elevation engine.** For any dish, proactively offers 2–3 "extra" ideas tuned to the diners — finishing oils (the basil-oil-in-tomato-soup move), acid adjustments, texture garnishes, stock upgrades. These are suggestions, offered in character, never silently imposed.
3. **Constraint-aware.** Only suggests techniques the kitchen supports (`kitchen.md`) and builds from staples (`pantry.md`), asking what fresh ingredients are on hand rather than assuming. Offers substitutions when a recipe calls for something Cody lacks.
4. **Timing & coursing.** For multi-component dishes or full meals, produces a work-back schedule ("start rice at T-25").
5. **Plating.** Always has a plating point of view; fills the recipe `plating` field.
6. **Learns.** Any new fact — "less salt next time," "her dad is allergic to shellfish," "we bought an immersion blender" — gets written to the appropriate knowledge file immediately. Corrections overwrite; the knowledge base is the single source of truth.
7. **Imports & reviews from links.** Given a recipe URL or YouTube video, the chef fetches the content, reviews it in character — what's good, what it would change, where it can be elevated for Cody's palate and diners — proposes its adapted version, and on approval publishes it via `add-recipe`. Extraction details are in the `add-recipe` section below.
8. **Structure.** Every recipe it produces conforms to the recipe JSON schema in this spec (the schema is documented in the skill so it survives independently of this doc). When a recipe is finalized, the chef hands off to `add-recipe` to publish.

Knowledge base layout:

```
.claude/skills/chef/
  SKILL.md          persona, behaviors, recipe structure, how to use/update the knowledge base
  people/
    cody.md         likes, dislikes, spice tolerance, portion habits, skill level
    girlfriend.md   (renamed to her actual name during seeding)
    girlfriend-family.md   allergies, dislikes, headcount
  kitchen.md        appliances, cookware, tools
  pantry.md         staples always stocked (oils, acids, spices, aromatics...)
```

Seeding: during implementation, the chef interviews Cody to fill `people/`, `kitchen.md`, and `pantry.md` with real starting data.

### `.claude/skills/add-recipe/` — the librarian

Trigger: a finished recipe needs to go on the site — from the chef's handoff, from a pasted Claude chat, from a URL, or from an explicit "add this recipe."

Steps it performs:

1. Extract/convert the recipe into the JSON schema:
   - **From a chat transcript**: identify the final agreed version, not early drafts; multiple recipes in one chat → multiple files, confirming with Cody.
   - **From a recipe website URL**: fetch the page; prefer schema.org/Recipe JSON-LD markup (most recipe sites embed it) and fall back to parsing the prose.
   - **From a YouTube URL**: fetch the video page for title/description (descriptions often contain the full recipe) and attempt transcript retrieval; if no transcript is reachable, ask Cody to paste it (YouTube share → transcript copy) rather than inventing details. `source` records the original URL.
2. Write `recipes/<id>.json`, update `index.json`.
3. Run `node scripts/validate.mjs`; fix anything it reports.
4. Commit and push (git-connected deploy) — the site updates automatically.

It also handles updates to existing recipes ("here's a chat where we improved the carbonara") by editing the existing file, preserving the `id`/URL.

## 4. Deployment

- Cloudflare Pages, git-connected to a GitHub repo (`codys-cookbook`), build command empty, **output directory `site`** — only the site deploys, never the knowledge base. Every push to `main` auto-deploys. One-time setup during implementation requires Cody to authorize GitHub and Cloudflare.
- Fallback if git-connection is undesirable: `npx wrangler pages deploy site`.
- Result: an HTTPS `*.pages.dev` URL (HTTPS is required for wake lock and service worker) that Cody adds to his iPhone home screen.

## 5. Access model — talking to the chef from anywhere

The chef is not tied to Cody's PC. Everything that makes the agent *this* agent — the `chef` and `add-recipe` skills, people profiles, kitchen and pantry files, recipe schema — lives in the GitHub repo, so any Claude Code environment reconstitutes it:

- **PC**: Claude Code CLI or desktop app in the local checkout (this session).
- **iPhone, PC off**: Claude Code on the web (claude.ai/code in Safari) or the Claude iOS app's code sessions, pointed at the `codys-cookbook` GitHub repo. Sessions run in Anthropic's cloud sandbox: the repo is cloned there, skills load automatically, and pushes trigger the same Cloudflare Pages deploy. Talking to the chef from the couch or the grocery store works identically to talking to it here.

Consequence: GitHub is not just deployment plumbing; it is the agent's home. All chef learning (behavior 6) must be committed and pushed promptly so every environment sees the same knowledge.

## 6. Error handling

- **Bad recipe JSON**: `validate.mjs` blocks it before deploy. If one slips through, the app catches the parse/render error and shows a friendly error card for that recipe only; home screen and other recipes unaffected.
- **Missing recipe id in URL**: friendly "not found" card with a link home.
- **Wake lock unsupported/denied**: silently skipped; app fully functional.
- **Offline with uncached recipe**: clear "you're offline and this recipe isn't cached yet" message.
- **Scaler edge cases**: `null` quantities never scale; display rounding never mutates the underlying value (re-scaling is always computed from the original).

## 7. Testing & verification

- `scripts/validate.mjs` — validates every recipe against the schema and `index.json` consistency (every recipe indexed, no orphan index entries, ids match filenames). Run by `add-recipe` before every deploy.
- `scripts/scale.test.mjs` — `node:test` unit tests for scaling and fraction formatting (the only nontrivial pure logic).
- Manual verification: serve locally, drive both screens in a browser at iPhone viewport — search, filters, scaler, checklists, a real timer countdown — before first deploy and after significant UI changes.

## 8. Implementation notes

- Ship with 2–3 sample recipes written in the schema (one with ingredient groups + timers + plating) so the UI is reviewable immediately; Cody then replaces/augments them by pasting real starred chats one at a time.
- `CLAUDE.md` at repo root: one-paragraph project map pointing at this spec, the two skills, and the validator — enough for any fresh session to orient.
- Keep `js/app.js` under ~500 lines; if it grows past that, split by screen.

## Resolved decisions (from brainstorming)

- Cooking mode is the primary experience; browsing is secondary.
- Website prompt-box generation: **cut** — Claude Code sessions with the chef skill fill this role.
- Content import flows through Claude Code only; the site has no input surfaces.
- Search + tag filters on home; no categories-only view; photos optional.
- Live pantry inventory: rejected as unmaintainable; staples file + ask-about-fresh instead.
- All recipes use imperial units and °F exclusively (Cody's preference, 2026-08-08); metric sources are converted at import time.
