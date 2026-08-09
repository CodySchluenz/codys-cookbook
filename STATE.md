# STATE — where things stand

*The handoff file. Any session (PC, phone, fresh clone) reads this FIRST and updates it
(+ commit + push) at every milestone and before finishing work. If a session dies
mid-task, the next one resumes from here. Git history is the fine-grained backup:
`git log --oneline` tells the story; this file tells the headline.*

**Last updated:** 2026-08-08, evening (PC session — Task 22 shipped)

## Current status: STABLE, nothing in flight

All shipped and verified live at https://codys-cookbook.codydps.workers.dev (SW cache v14):
search/tags · cooking mode (scaler, checklists, timers, wake lock) · shopping-list +
component ingredient views · meal mode (basket, game plan, combined list) · teaching
whys + technique pages · precise steps · equipment lists · elevations/pairings/links ·
revision history · cook notes (send-to-chef) · photos pipeline · made-it + scale
memory · print styles · household shopping list (first API: worker.js + KV, household
key set as Worker secret — value known to Cody, never written here) · **list history +
trends** (Task 22: every add writes a permanent `hist:` KV record; `GET /api/history`;
`#/list/history` trends screen — spec `docs/superpowers/specs/2026-08-08-list-history-design.md`).
History starts 2026-08-08; deletes never touch it. Live end-to-end check confirmed by
Cody on his phone 2026-08-08: add → appears in history; tap bought → leaves list, stays
in history.

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
- Zoe's phone onboards the household list (Cody's is done — his items are already on it; the list is in live use). Ask Cody for the key if needed; it is never written in this repo.

## Known punch list (accepted minors, fix opportunistically)

See `docs/superpowers/plans/2026-08-08-cookbook.md` and reviewer notes in git history.
Highlights: metric-text scan skips ingredient notes; changelog date regex is
shape-only; app.js ~800 lines (split-by-screen refactor if it keeps growing);
household 500s expose error detail to authed users. (Task 22's two cosmetic minors —
join-from-history landing and year-less dateLabel — fixed in 6587c0b, SW v14.)
**Queued follow-up (do soonish — hist record format is permanent, later = migration):**
write `hist:` puts with `{metadata: entry}` so `/api/history` reads list pages
instead of N+1 gets; defuses the KV ops-per-invocation ceiling (~3-5 yrs out).
