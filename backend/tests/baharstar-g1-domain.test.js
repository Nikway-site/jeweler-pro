// Bahar STAR G1 — actual Jeweler Pro domain functions, synthetic TRY figures only.
// Run: node --test backend/tests/baharstar-g1-domain.test.js
// NOT a settlement integration test; NOT Iranian currency/tax validation.
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDecimal } = require('../domain/decimal');
const { SCALE } = require('../domain/precision');
const { resolvePurity, fineWeightMg } = require('../domain/metals');
const { priceGramUnit, priceMetalPurchase, priceLine } = require('../domain/pricing');

test('18K 10g -> 7.500g fine gold', () => {
  const purity = resolvePurity({ karat: 18 });
  assert.equal(purity, 7500n);
  assert.equal(fineWeightMg(10000n, purity), 7500n);
});

test('10g 18K sale priced against synthetic pure-gold TRY 1000/g', () => {
  const result = priceGramUnit({ weightMg: 10000n, purity: 7500n, pricePerGram: parseDecimal('1000', SCALE.UNIT_PRICE) });
  assert.equal(result.unitPriceMinor, 750000n); // TRY 7,500.00
  assert.equal(result.fineMg, 7500n);
});

test('synthetic scrap buy-back at 10g 18K with 10 permille deduction', () => {
  const result = priceMetalPurchase({ weightMg: 10000n, purity: 7500n, pricePerGram: parseDecimal('1000', SCALE.UNIT_PRICE), deductionMilyem: 100n });
  assert.equal(result.amountMinor, 740000n); // TRY 7,400.00
  assert.equal(result.fineMg, 7500n); // physical fine metal unchanged
});

test('fixed labor and line total', () => {
  const result = priceGramUnit({ weightMg: 10000n, purity: 7500n, pricePerGram: parseDecimal('1000', SCALE.UNIT_PRICE), laborType: 'fixed', laborValue: parseDecimal('100', SCALE.MONEY) });
  assert.equal(result.unitPriceMinor, 760000n);
  assert.equal(priceLine({ unitPriceMinor: result.unitPriceMinor, quantity: 2 }).totalMinor, 1520000n);
});

test('reject purity above 100 percent', () => {
  assert.throws(() => resolvePurity({ purity: '1.0001' }));
});

test('reject excess precision for money', () => {
  assert.throws(() => parseDecimal('10.001', SCALE.MONEY));
});
