// Pure quantity math and kitchen-friendly display. No DOM. Unit-tested in node.

const FRACTIONS = [
  [0.125, '⅛'], [0.25, '¼'], [0.333, '⅓'], [0.375, '⅜'],
  [0.5, '½'], [0.625, '⅝'], [0.667, '⅔'], [0.75, '¾'], [0.875, '⅞'],
];
const TOL = 0.05;

export function scaleQty(qty, factor) {
  if (qty === null || qty === undefined) return null;
  return qty * factor;
}

export function formatQty(qty) {
  if (qty === null || qty === undefined) return '';
  const rounded = Math.round(qty * 1000) / 1000;
  const whole = Math.floor(rounded);
  const frac = rounded - whole;
  if (frac <= TOL && (whole > 0 || frac === 0)) return String(whole);
  if (frac >= 1 - TOL) return String(whole + 1);
  if (rounded < 0.1) return String(rounded); // tiny amounts stay decimal, never round up to ⅛
  let best = null;
  for (const [value, glyph] of FRACTIONS) {
    const d = Math.abs(frac - value);
    if (d <= TOL && (best === null || d < best.d)) best = { d, glyph };
  }
  if (best) return whole === 0 ? best.glyph : `${whole}${best.glyph}`;
  return String(Math.round(rounded * 100) / 100);
}

function foldEntries(item, entries) {
  const byUnit = new Map();
  let toTaste = false;
  for (const e of entries) {
    if (e.qty === null) { toTaste = true; continue; }
    const u = e.unit ?? '';
    byUnit.set(u, (byUnit.get(u) ?? 0) + e.qty);
  }
  const parts = [...byUnit.entries()].map(([unit, qty]) => ({ qty, unit: unit || null }));
  return { item, parts, toTaste };
}

export function shoppingList(groups) {
  const map = new Map();
  for (const g of groups) {
    for (const it of g.items) {
      const key = it.item.trim().toLowerCase();
      if (!map.has(key)) map.set(key, { item: it.item, entries: [] });
      map.get(key).entries.push({ qty: it.qty ?? null, unit: it.unit ?? null });
    }
  }
  return [...map.values()].map(({ item, entries }) => foldEntries(item, entries));
}

export function combinedShopping(recipeEntries) {
  const map = new Map();
  for (const { groups, factor } of recipeEntries) {
    for (const g of groups) {
      for (const it of g.items) {
        const key = it.item.trim().toLowerCase();
        if (!map.has(key)) map.set(key, { item: it.item, entries: [] });
        map.get(key).entries.push({
          qty: it.qty === null || it.qty === undefined ? null : it.qty * factor,
          unit: it.unit ?? null,
        });
      }
    }
  }
  return [...map.values()].map(({ item, entries }) => foldEntries(item, entries));
}
