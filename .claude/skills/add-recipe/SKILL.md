---
name: add-recipe
description: Use when a finished recipe needs to go on the cookbook site — from the chef's handoff, a pasted Claude chat, a recipe URL, a YouTube video, or "add this recipe". Converts to the site's JSON schema, validates, and deploys.
---

# Add Recipe (the librarian)

Converts a finished recipe into `site/recipes/<id>.json`, keeps `site/index.json` in
sync, validates, and ships. The chef skill handles taste; this skill handles correctness.

## The schema (canonical copy)

One file per recipe at `site/recipes/<id>.json`:

    {
      "id": "kebab-case, must match filename",
      "title": "string",
      "description": "one sentence",
      "tags": ["lowercase", "strings"],
      "servings": <number>,
      "activeMinutes": <number>,
      "totalMinutes": <number>,
      "difficulty": "easy" | "medium" | "project",
      "photo": "photos/<file>" | null,
      "source": "where this came from (chat, URL)",     // optional
      "equipment": ["blender", "oven with broiler"],   // optional — gear whose absence stops the cook
      "ingredientGroups": [
        { "name": "Group name" | null,
          "items": [ { "qty": <number>|null, "unit": "oz"|"lb"|"cup"|"tbsp"|"tsp"|null,
                       "item": "name", "note": "prep note" } ] }   // note optional
      ],
      "steps": [ { "text": "instruction with timing cues in prose",
                   "minutes": <number>,                    // optional → timer button
                   "why": "the teaching reason" } ],       // optional → teaching callout
      "notes": [ { "title": "Why …", "body": "the technique reasoning" } ],  // optional
      "plating": "how to plate it",                       // optional
      "elevations": ["upgrade idea"],                     // optional
      "pairings": ["what goes alongside (free text)"],    // optional
      "pairsWith": ["<other-recipe-id>"],                 // optional — ids must exist
      "variations": ["string"]                            // optional
    }

Rules that trip people up:

- `qty: null` means "to taste" — it renders as-is and never scales. Count items are
  `qty: 2, unit: null`.
- `steps[].minutes` only where a cook would actually set a timer (sears, simmers,
  rests) — not for "chop the onion".
- Imperial units ONLY: oz, lb, cups, tbsp, tsp; temperatures in °F. Convert metric
  sources at import — grams and °C never appear in a stored recipe, including notes
  and step text.
- `id` is forever — it's the URL and the localStorage key for cook progress.
- Teach in the steps: any step whose technique isn't self-evident gets a `why` — one or
  two sentences explaining the reason (why char instead of crush, why rest instead of
  slice hot). `notes` stays for recipe-level technique that spans steps.
- Steps restate exact amounts at the point of use: "add the 3 minced garlic cloves,"
  never "add the garlic." The ingredient list is for shopping; each step must stand
  alone at the stove with no scrolling back.
- When adding a recipe, scan site/index.json for natural pairings and propose
  `pairsWith` cross-links in BOTH directions (lasagna ↔ garlic bread ↔ italian salad).
  Every id in pairsWith must be an existing recipe; the validator enforces it.
- `equipment` lists only gear whose absence would STOP the cook mid-recipe (blender,
  broiler, thermometer, stand mixer) — never universal utensils (knives, bowls,
  spoons). Cody cooks in unfamiliar kitchens; the list is his no-surprises check.
- The validator enforces an imperial unit allowlist (UNITS in scripts/validate.mjs) and
  scans all text for metric leftovers. If a genuinely new imperial unit appears, extend
  UNITS deliberately — don't work around it.

## Sources

- **Claude chat transcript:** extract the FINAL agreed version, not early drafts. If the
  chat contains several recipes, list them and confirm with Cody before writing files.
- **Recipe website URL:** WebFetch the page. Prefer the schema.org/Recipe JSON-LD block
  (most recipe sites embed one) over scraping prose.
- **YouTube URL:** WebFetch the watch page — title + description often contain the whole
  recipe. If you need the transcript and can't retrieve it, ask Cody to paste it
  (Share → Show Transcript → copy). Never invent quantities the source doesn't state.
- Record where it came from in `source`.

## Steps

1. Write `site/recipes/<id>.json`.
2. Update `site/index.json`: entry is `{ id, title, description, tags, totalMinutes,
   difficulty, photo, ingredients }` where `ingredients` is the flat array of every
   `item` string in order. Keep entries sorted by id.
3. Run `node scripts/validate.mjs` — fix anything it reports before continuing.
4. Commit and push. Cloudflare Workers Builds redeploys `site/` automatically from main.

## Updating an existing recipe

Edit the existing file; NEVER change its `id`. Update the index entry to match.
Same validate → commit → push flow.

Cook-note blobs ("Cook notes for <id>: …") are the most common update source — fold the
observations into the existing file and never change the id.

## Revision history

Every recipe carries a `changelog`: `[{ "date": "YYYY-MM-DD", "note": "one line" }]`,
appended in chronological order (the site renders newest first).

- First publish → entry saying where it came from.
- EVERY update → entry saying what changed and why, in cook terms ("Mornay
  edge-to-edge — exposed bread burns"), never git terms.
- Git is the full-fidelity layer: exact diffs and restores via
  `git log --follow site/recipes/<id>.json` — offer it when Cody asks what changed
  or wants an old version back.

## Photos

- Files live at `site/photos/<recipe-id>.jpg` — JPEG, max ~1600px wide (aim under
  ~300KB). On the PC, `powershell -File scripts/prep-photo.ps1 -Source <path>
  -RecipeId <id>` does the resize (HEIC not supported — have the phone share as JPEG).
- From the phone: upload via GitHub (app or github.com → site/photos → Add file),
  then tell the chef to wire it up.
- Wiring: set the recipe's `photo` field AND its index.json entry to
  `photos/<recipe-id>.jpg`. The validator checks the prefix.
- REPLACING a photo needs a NEW filename (`photos/<id>-2.jpg`, update both
  references): non-JSON assets are cache-first in the service worker, so a same-name
  replacement never refreshes on installed phones.

## What you never need to touch

Adding/updating recipe JSON requires no service-worker cache bump (recipe data is
network-first). Only shell changes (html/css/js/manifest/icons) need the `CACHE`
version in `site/sw.js` bumped — see CLAUDE.md.
