# Shopping-List History & Trends — Design Spec

**Date:** 2026-08-08
**Status:** Approved pending user review

## Overview

The household shopping list currently forgets: tapping an item bought deletes its KV
record permanently. Cody wants the site to keep a permanent record of everything
*entered* into the list, with a trends view ("chicken thighs ×9 · last Tue · ~every
12 days") for casually spotting patterns. History records **add-time**, not
purchase-time — a mistaken add still counts as an entry (visible as a one-off);
whether an item was ever bought is out of scope.

## Goals

- Every add to the household list is recorded permanently, starting the day this ships.
- A trends screen on the phone: per-item frequency, recency, and typical cadence,
  plus a recent-adds feed.
- Zero change to the feel of the existing list (add / tap-bought flows untouched).

## Non-goals

- No purchase-time tracking (deletes stay dumb; can be added later without touching
  this design's data).
- No backfill of items already on the list — history starts today.
- No server-side aggregation, charts, or export. The phone does the math on the raw log.

## 1. Storage & API (`worker.js`)

- **`POST /api/list`** — after writing the live `item:` record, also `put` a permanent
  history record: key `hist:${Date.now()}:${crypto.randomUUID()}`, value the same
  `{ item, note, addedBy, addedAt }` entry. Two KV writes per add; trivial at
  household scale. KV has no transactions: the live `item:` write goes first, and if
  the history write then fails the request 500s and the client re-syncs — worst case
  is one item on the list with no history record. Accepted; the live list stays primary.
- **`GET /api/history`** (new) — list KV keys with prefix `hist:`, fetch each value,
  return the array `[{ key, item, note, addedBy, addedAt }, ...]`. Must loop KV
  `list()` cursors (`list_complete` / `cursor`) so results stay complete past the
  1,000-key page limit (~3 years of household adds).
- **`DELETE /api/list`** — unchanged. No endpoint ever deletes or mutates `hist:` keys.
- Auth: the existing `x-household-key` gate already covers all `/api/*` routes.

## 2. Trends math (new `site/js/history.js`)

A pure ES module, following the `scale.js` pattern (imported by `app.js`, unit-tested
from `scripts/`). Exports:

- `normalizeName(s)` — trim, lowercase, collapse internal whitespace. "Chicken  Thighs"
  → "chicken thighs". This is the grouping key.
- `groupHistory(entries)` — group by normalized name. Per group return:
  - `name` — display name: casing of the **most recent** entry as typed
  - `count` — total adds
  - `lastAt` — most recent `addedAt`
  - `gapDays` — **median** days between consecutive adds, `null` when count < 3
    (median so one long vacation gap doesn't skew the cadence)
  - sorted by `count` desc, ties broken by most recent `lastAt`
- `recentAdds(entries, n)` — last `n` entries, newest first (for the raw feed).

Entries with malformed/missing `addedAt` sort last and are excluded from gap math.

## 3. UI (`app.js`)

- New hash route **`#/list/history`**, rendered by `renderListHistory()`.
- Entry point: a "History" button in the household-list top bar (next to Refresh).
- Screen layout:
  - Top bar: `← List` back link.
  - **Trends** section: one row per group — name, `×count`, a short date label
    (new `dateLabel` helper, e.g. "Aug 5" — `whenLabel` shows only weekday+time,
    ambiguous for months-old entries), and `~every N days` when `gapDays` ≥ 1.
  - **Recent** section: last 20 raw adds — item, note, who, when — newest first.
- Empty state: "History starts today — trends grow as you add."
- Error handling mirrors `renderList()` exactly: 401 clears the stored key and shows
  the join screen, 503 shows the not-configured card, network failure shows the
  offline/unreachable card.
- No hkey stored → same join screen as the list.

## 4. Deploy & testing

- `site/sw.js`: add `./js/history.js` to the precache list and **bump `CACHE`**
  (shell files changed: `app.js`, `sw.js`, new `history.js`).
- Unit tests in `scripts/history.test.mjs` (`node --test scripts/`): normalization
  edge cases, casing-of-most-recent, count/sort order, median gap (single add → null,
  two adds → null, ≥3 adds, same-day double adds, unsorted input, malformed dates).
- `node scripts/validate.mjs` stays green (no recipe content touched).
- Live verification after push: add an item on the phone, confirm it appears in
  `GET /api/history` and on the trends screen.
