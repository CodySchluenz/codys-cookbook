// Shopping-list history → trends. Pure functions only, unit-tested from scripts/.
// Grouping key is the normalized item name, so "Chicken  Thighs" and "chicken thighs"
// are one item. gapDays is a median so one vacation gap doesn't skew the cadence.

const DAY = 86400000;

export function normalizeName(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

export function groupHistory(entries) {
  const groups = new Map();
  for (const e of entries ?? []) {
    const key = normalizeName(e?.item);
    if (!key) continue;
    let g = groups.get(key);
    if (!g) { g = { name: String(e.item).trim(), count: 0, lastAt: null, times: [] }; groups.set(key, g); }
    g.count += 1;
    const t = Date.parse(e?.addedAt ?? '');
    if (!Number.isNaN(t)) {
      g.times.push(t);
      if (g.lastAt === null || t >= Date.parse(g.lastAt)) { g.lastAt = e.addedAt; g.name = String(e.item).trim(); }
    }
  }
  const out = [];
  for (const { name, count, lastAt, times } of groups.values()) {
    times.sort((a, b) => a - b);
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    out.push({ name, count, lastAt, gapDays: times.length >= 3 ? median(gaps) / DAY : null });
  }
  out.sort((a, b) => (b.count - a.count)
    || (Date.parse(b.lastAt ?? '') || 0) - (Date.parse(a.lastAt ?? '') || 0));
  return out.map((g) => ({ ...g, gapDays: g.gapDays === null ? null : Math.round(g.gapDays) }));
}

function median(values) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function recentAdds(entries, n = 20) {
  return [...(entries ?? [])]
    .sort((a, b) => (Date.parse(b?.addedAt ?? '') || 0) - (Date.parse(a?.addedAt ?? '') || 0))
    .slice(0, n);
}
