import { test } from 'node:test';
import assert from 'node:assert/strict';
import { unitFor } from '../site/js/scale.js';

test('plural units singularize at or below 1', () => {
  assert.equal(unitFor('cans', 1), 'can');
  assert.equal(unitFor('cups', 0.5), 'cup');
  assert.equal(unitFor('slices', 1), 'slice');
});

test('singular units pluralize above 1', () => {
  assert.equal(unitFor('cup', 2), 'cups');
  assert.equal(unitFor('clove', 1.5), 'cloves');
});

test('invariant and null units pass through', () => {
  assert.equal(unitFor('tbsp', 0.5), 'tbsp');
  assert.equal(unitFor('oz', 3), 'oz');
  assert.equal(unitFor(null, 2), null);
  assert.equal(unitFor('cans', null), 'cans');
});
