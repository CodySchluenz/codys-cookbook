import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeName, groupHistory, recentAdds, dateLabel } from '../site/js/history.js';

const e = (item, addedAt) => ({ item, addedAt });

test('normalizeName trims, lowercases, collapses whitespace', () => {
  assert.equal(normalizeName('  Chicken   Thighs '), 'chicken thighs');
  assert.equal(normalizeName(''), '');
  assert.equal(normalizeName(null), '');
});

test('groupHistory merges casing/spacing variants into one group', () => {
  const g = groupHistory([
    e('Chicken Thighs', '2026-08-01T10:00:00Z'),
    e('chicken  thighs', '2026-08-05T10:00:00Z'),
  ]);
  assert.equal(g.length, 1);
  assert.equal(g[0].count, 2);
});

test('display name uses the most recently added casing', () => {
  const g = groupHistory([
    e('CHICKEN THIGHS', '2026-08-05T10:00:00Z'),
    e('Chicken thighs', '2026-08-01T10:00:00Z'),   // unsorted input on purpose
  ]);
  assert.equal(g[0].name, 'CHICKEN THIGHS');
});

test('sorted by count desc, ties broken by most recent add', () => {
  const g = groupHistory([
    e('milk', '2026-08-01T10:00:00Z'),
    e('milk', '2026-08-02T10:00:00Z'),
    e('eggs', '2026-08-07T10:00:00Z'),
    e('butter', '2026-08-06T10:00:00Z'),
  ]);
  assert.deepEqual(g.map((x) => x.name), ['milk', 'eggs', 'butter']);
});

test('gapDays is null below 3 dated adds', () => {
  assert.equal(groupHistory([e('milk', '2026-08-01T00:00:00Z')])[0].gapDays, null);
  assert.equal(groupHistory([
    e('milk', '2026-08-01T00:00:00Z'),
    e('milk', '2026-08-11T00:00:00Z'),
  ])[0].gapDays, null);
});

test('gapDays is the median of consecutive gaps (even count averages middles)', () => {
  // gaps 10d and 2d → median 6
  const g = groupHistory([
    e('milk', '2026-08-01T00:00:00Z'),
    e('milk', '2026-08-11T00:00:00Z'),
    e('milk', '2026-08-13T00:00:00Z'),
  ]);
  assert.equal(g[0].gapDays, 6);
});

test('gapDays median resists one outlier gap (odd count takes middle)', () => {
  // gaps 1d, 10d, 1d → median 1
  const g = groupHistory([
    e('milk', '2026-08-01T00:00:00Z'),
    e('milk', '2026-08-02T00:00:00Z'),
    e('milk', '2026-08-12T00:00:00Z'),
    e('milk', '2026-08-13T00:00:00Z'),
  ]);
  assert.equal(g[0].gapDays, 1);
});

test('same-day double adds count as 0-day gaps', () => {
  // gaps 0d and 14d → median 7
  const g = groupHistory([
    e('milk', '2026-08-01T00:00:00Z'),
    e('milk', '2026-08-01T00:00:00Z'),
    e('milk', '2026-08-15T00:00:00Z'),
  ]);
  assert.equal(g[0].gapDays, 7);
});

test('malformed dates are excluded from gap math and sort last', () => {
  const g = groupHistory([
    e('mystery', 'not-a-date'),
    e('milk', '2026-08-01T00:00:00Z'),
  ]);
  assert.deepEqual(g.map((x) => x.name), ['milk', 'mystery']);
  assert.equal(g[1].lastAt, null);
  assert.equal(g[1].count, 1);
});

test('entries with no item are skipped', () => {
  assert.equal(groupHistory([e('', '2026-08-01T00:00:00Z'), { addedAt: '2026-08-01T00:00:00Z' }]).length, 0);
});

test('recentAdds returns newest first and respects the limit', () => {
  const r = recentAdds([
    e('a', '2026-08-01T00:00:00Z'),
    e('c', '2026-08-03T00:00:00Z'),
    e('b', '2026-08-02T00:00:00Z'),
  ], 2);
  assert.deepEqual(r.map((x) => x.item), ['c', 'b']);
});

test('dateLabel omits the year for current-year dates', () => {
  const now = new Date('2026-08-08T12:00:00Z');
  const label = dateLabel('2026-08-05T10:00:00Z', now);
  assert.ok(label.length > 0);
  assert.ok(!label.includes('2026'));
});

test('dateLabel includes the year for other-year dates', () => {
  const now = new Date('2026-08-08T12:00:00Z');
  assert.ok(dateLabel('2025-12-20T10:00:00Z', now).includes('2025'));
});

test('dateLabel returns empty string for malformed dates', () => {
  const now = new Date('2026-08-08T12:00:00Z');
  assert.equal(dateLabel('not-a-date', now), '');
  assert.equal(dateLabel(null, now), '');
});
