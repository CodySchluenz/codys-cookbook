import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleQty, formatQty, shoppingList, combinedShopping } from '../site/js/scale.js';

test('scaleQty multiplies numeric quantities', () => {
  assert.equal(scaleQty(450, 2), 900);
  assert.equal(scaleQty(0.75, 0.5), 0.375);
});

test('scaleQty passes null through (to-taste items never scale)', () => {
  assert.equal(scaleQty(null, 2), null);
  assert.equal(scaleQty(undefined, 2), null);
});

test('formatQty renders whole numbers plainly', () => {
  assert.equal(formatQty(3), '3');
  assert.equal(formatQty(12), '12');
});

test('formatQty uses kitchen fractions', () => {
  assert.equal(formatQty(0.25), '¼');
  assert.equal(formatQty(0.5), '½');
  assert.equal(formatQty(0.75), '¾');
  assert.equal(formatQty(0.125), '⅛');
  assert.equal(formatQty(1.5), '1½');
  assert.equal(formatQty(2.6667), '2⅔');
  assert.equal(formatQty(0.3333), '⅓');
  assert.equal(formatQty(0.375), '⅜'); // nearest fraction wins, not first-within-tolerance
});

test('formatQty falls back to trimmed decimals for odd values', () => {
  assert.equal(formatQty(0.09), '0.09');
});

test('formatQty handles null and zero', () => {
  assert.equal(formatQty(null), '');
  assert.equal(formatQty(0), '0');
});

test('shoppingList sums same item + unit across groups, case-insensitive', () => {
  const groups = [
    { name: 'A', items: [{ qty: 4, unit: null, item: 'garlic cloves' }, { qty: 1, unit: 'cup', item: 'olive oil' }] },
    { name: 'B', items: [{ qty: 2, unit: null, item: 'Garlic Cloves' }, { qty: 2, unit: 'tbsp', item: 'olive oil' }] },
  ];
  const list = shoppingList(groups);
  assert.deepEqual(list.find((x) => x.item === 'garlic cloves').parts, [{ qty: 6, unit: null }]);
  assert.deepEqual(list.find((x) => x.item === 'olive oil').parts,
    [{ qty: 1, unit: 'cup' }, { qty: 2, unit: 'tbsp' }]);
});

test('shoppingList marks to-taste items and keeps first-seen casing', () => {
  const list = shoppingList([{ name: null, items: [{ qty: null, unit: null, item: 'Flaky salt' }] }]);
  assert.deepEqual(list, [{ item: 'Flaky salt', parts: [], toTaste: true }]);
});

test('combinedShopping applies each recipe factor before merging', () => {
  const soup = [{ name: null, items: [{ qty: 5, unit: 'tbsp', item: 'butter' }] }];
  const croque = [{ name: null, items: [{ qty: 12, unit: 'tbsp', item: 'Butter' }] }];
  const list = combinedShopping([
    { groups: soup, factor: 2 },
    { groups: croque, factor: 1 },
  ]);
  assert.deepEqual(list, [{ item: 'butter', parts: [{ qty: 22, unit: 'tbsp' }], toTaste: false }]);
});

test('combinedShopping keeps to-taste items unscaled and unsummed', () => {
  const list = combinedShopping([
    { groups: [{ name: null, items: [{ qty: null, unit: null, item: 'salt' }] }], factor: 3 },
  ]);
  assert.deepEqual(list, [{ item: 'salt', parts: [], toTaste: true }]);
});
