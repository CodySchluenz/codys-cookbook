import test from 'node:test';
import assert from 'node:assert/strict';
import { scaleQty, formatQty } from '../site/js/scale.js';

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
