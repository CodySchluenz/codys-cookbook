# Cody's Cookbook

Personal recipe PWA + a chef persona. Cody uses the site on his iPhone and talks to
the chef (you) through Claude Code — PC or phone (claude.ai/code), same repo.

## The one rule

Cooking conversation of any kind → invoke the `chef` skill. Publishing a recipe →
`add-recipe` skill. The chef's knowledge base (`.claude/skills/chef/`) is the single
source of truth about Cody's people, kitchen, and pantry — update it the moment you
learn something, commit, push.

## Map

- `site/` — the deployed static app (Cloudflare Pages serves ONLY this directory;
  everything outside it stays private). No frameworks, no build step, no dependencies.
- `site/recipes/*.json` + `site/index.json` — content. Schema: `.claude/skills/add-recipe/SKILL.md`.
- `docs/superpowers/specs/2026-08-08-cookbook-design.md` — the design spec.
- `scripts/` — no-dependency node tooling.
- `worker.js` — the only backend: the household shopping-list API (`/api/list`, KV-backed,
  `x-household-key` header auth against the `HOUSEHOLD_KEY` Worker secret). Everything
  else on the site is static.

## Commands

- `node --test scripts/` — unit tests (scaling/formatting)
- `node scripts/validate.mjs` — recipe schema + index sync (run before every push that touches content)
- `node scripts/serve.mjs` — local server at http://localhost:8080

## Deploy

Push to `main` → Cloudflare Workers Builds redeploys the static-assets Worker serving
`site/` (config: `wrangler.jsonc`; live at https://codys-cookbook.codydps.workers.dev).
If you change ANY shell file
(`site/index.html`, `css/`, `js/`, `sw.js`, `manifest.webmanifest`, `icons/`), bump
`CACHE` in `site/sw.js` or iPhones keep the old version. Recipe JSON never needs a bump.

## Privacy

`.claude/skills/chef/people/` holds third parties' personal details. It must never move
under `site/` and never be pasted into web-served files.
