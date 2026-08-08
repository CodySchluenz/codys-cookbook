# STATE — where things stand

*The handoff file. Any session (PC, phone, fresh clone) reads this FIRST and updates it
(+ commit + push) at every milestone and before finishing work. If a session dies
mid-task, the next one resumes from here. Git history is the fine-grained backup:
`git log --oneline` tells the story; this file tells the headline.*

**Last updated:** 2026-08-08 (PC session — the build day)

## Current status: STABLE, nothing in flight

All shipped and verified live at https://codys-cookbook.codydps.workers.dev (SW cache v12):
search/tags · cooking mode (scaler, checklists, timers, wake lock) · shopping-list +
component ingredient views · meal mode (basket, game plan, combined list) · teaching
whys + technique pages · precise steps · equipment lists · elevations/pairings/links ·
revision history · cook notes (send-to-chef) · photos pipeline · made-it + scale
memory · print styles · household shopping list (first API: worker.js + KV, household
key set as Worker secret — value known to Cody, never written here).

## How this repo works (fresh-session crash course)

- Cooking talk → `chef` skill. Publishing → `add-recipe` skill. Both in `.claude/skills/`.
- Push to `main` → Cloudflare Workers Builds auto-deploys `site/` (~60s). Shell file
  changes REQUIRE bumping `CACHE` in `site/sw.js`.
- `node scripts/validate.mjs` before every content push. `node --test scripts/` for units.
- Parallel sessions are normal (Cody works from his phone): `git pull --rebase` before pushing.

## Awaiting Cody (standing)

- Chef seeding interview: Zoe's dislikes/allergies/spice, Cody's likes/spice, her
  family's headcount+allergies, remaining kitchen gear, pantry staples.
- Real ribeye recipe to replace the sample (`pan-seared-ribeye` still placeholder).
- First photo (esquites suggested).
- Phones onboard the household list (one-time key entry).

## Known punch list (accepted minors, fix opportunistically)

See `docs/superpowers/plans/2026-08-08-cookbook.md` and reviewer notes in git history.
Highlights: metric-text scan skips ingredient notes; changelog date regex is
shape-only; app.js ~700 lines (split-by-screen refactor if it keeps growing);
household 500s expose error detail to authed users.
