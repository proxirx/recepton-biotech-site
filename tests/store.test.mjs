import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeBasket, addItem, setQuantity, basketSummary, removeSubmitted } from '../assets/store-core.js';

const products = [
  { id: 'p1', sku: 'R1-001-1', name: 'PD-1', options: [
    { id: 'small', size: '100 µg', formulation: 'Solution', priceCents: 15000 },
    { id: 'large', size: '1 mg', formulation: 'Solution', priceCents: 150000 }
  ] },
  { id: 'p2', sku: 'R1-041', name: 'Protein', options: [
    { id: 'quote', size: 'Size to be confirmed', formulation: 'To be confirmed', priceCents: null }
  ] }
];

test('same size merges, different sizes remain separate', () => {
  let items = addItem([], products, 'p1', 'small', 2);
  items = addItem(items, products, 'p1', 'small', 3);
  items = addItem(items, products, 'p1', 'large', 1);
  assert.deepEqual(items.map(i => [i.optionId, i.quantity]), [['small', 5], ['large', 1]]);
});

test('rejects zero, fractional, negative and unsafe quantities', () => {
  for (const quantity of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => addItem([], products, 'p1', 'small', quantity));
  }
});

test('restored basket discards unknown and invalid lines, ignores stored prices', () => {
  const basket = normalizeBasket([
    { productId: 'p1', optionId: 'small', quantity: 2, priceCents: 1 },
    { productId: 'p1', optionId: 'missing', quantity: 2 },
    { productId: 'missing', optionId: 'small', quantity: 2 },
    { productId: 'p1', optionId: 'large', quantity: -4 },
    null
  ], products);
  assert.deepEqual(basket, [{ productId: 'p1', optionId: 'small', quantity: 2 }]);
  assert.equal(basketSummary(basket, products).estimateCents, 30000);
});

test('quote lines never appear as a free item or complete total', () => {
  const basket = addItem(addItem([], products, 'p1', 'small', 2), products, 'p2', 'quote', 3);
  const summary = basketSummary(basket, products);
  assert.equal(summary.estimateCents, 30000);
  assert.equal(summary.quoteLines, 1);
  assert.equal(summary.units, 5);
  assert.equal(summary.lines[1].totalCents, null);
});

test('quantity edits and removal affect only selected size', () => {
  let items = addItem(addItem([], products, 'p1', 'small', 2), products, 'p1', 'large', 1);
  items = setQuantity(items, products, 'p1', 'small', 4);
  assert.deepEqual(items.map(i => i.quantity), [4, 1]);
  items = setQuantity(items, products, 'p1', 'small', 0);
  assert.equal(items.length, 1);
  assert.equal(items[0].optionId, 'large');
});

test('successful checkout removes submitted quantities, keeps new items added elsewhere', () => {
  const submitted = addItem([], products, 'p1', 'small', 2);
  const current = addItem(addItem(submitted, products, 'p1', 'small', 1), products, 'p1', 'large', 1);
  assert.deepEqual(removeSubmitted(current, submitted, products), [
    { productId: 'p1', optionId: 'small', quantity: 1 },
    { productId: 'p1', optionId: 'large', quantity: 1 }
  ]);
});
