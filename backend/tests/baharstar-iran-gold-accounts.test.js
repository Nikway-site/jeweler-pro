const test=require('node:test');
const assert=require('node:assert/strict');
const {createTrade,recordEvent,remainingIrr}=require('../baharstar-iran/goldAccounts');
const sample=()=>createTrade({id:'synthetic-1',side:'buy',grossWeightG:'10.000',purity:'0.7500',priceIrrPerGram:'50000000',counterparty:'fake-customer',owner:'fake-customer'});
test('locked trade 10g 18K and 500m IRR',()=>{const t=sample();assert.equal(t.agreedIrr,500000000n);assert.equal(t.weightMg*t.purity10000/10000n,7500n)});
test('instruction and screenshot do not clear debt',()=>{let t=recordEvent(sample(),{key:'i1',kind:'payment_instruction'});t=recordEvent(t,{key:'r1',kind:'receipt_uploaded'});assert.equal(remainingIrr(t),500000000n)});
test('partial bank-confirmed payments clear only confirmed amounts',()=>{let t=recordEvent(sample(),{key:'b1',kind:'bank_confirmed',amountIrr:300000000n});assert.equal(remainingIrr(t),200000000n);t=recordEvent(t,{key:'b2',kind:'bank_confirmed',amountIrr:200000000n});assert.equal(remainingIrr(t),0n)});
test('idempotent bank confirmation',()=>{let t=recordEvent(sample(),{key:'b1',kind:'bank_confirmed',amountIrr:300000000n});t=recordEvent(t,{key:'b1',kind:'bank_confirmed',amountIrr:300000000n});assert.equal(t.clearedIrr,300000000n);assert.equal(t.events.length,2)});
test('reject overpayment',()=>assert.throws(()=>recordEvent(sample(),{key:'b1',kind:'bank_confirmed',amountIrr:500000001n})));
test('trade direction and owner retained separately',()=>{const t=sample();assert.equal(t.side,'buy');assert.equal(t.owner,'fake-customer');assert.equal(t.counterparty,'fake-customer')});
test('reversal of settled trade requires separate adjustment',()=>{const t=recordEvent(sample(),{key:'b1',kind:'bank_confirmed',amountIrr:100n});assert.throws(()=>recordEvent(t,{key:'rev',kind:'reversal'}))});

test('reject same idempotency key with changed amount',()=>{const t=recordEvent(sample(),{key:'b1',kind:'bank_confirmed',amountIrr:300000000n});assert.throws(()=>recordEvent(t,{key:'b1',kind:'bank_confirmed',amountIrr:200000000n}),/IDEMPOTENCY_KEY_CONFLICT/)});
test('reject same idempotency key with different event type',()=>{const t=recordEvent(sample(),{key:'shared',kind:'receipt_uploaded'});assert.throws(()=>recordEvent(t,{key:'shared',kind:'bank_confirmed',amountIrr:1n}),/IDEMPOTENCY_KEY_CONFLICT/)});


const { resolvePurity, fineWeightMg } = require('../domain/metals');

test('IR-01 F5: Iran adapter 18K purity agrees with Jeweler Pro metal core', () => {
  const trade = sample();
  const actualPurity = resolvePurity({ karat: 18 });
  assert.equal(actualPurity, 7500n);
  assert.equal(trade.purity10000, actualPurity);
  assert.equal(fineWeightMg(trade.weightMg, actualPurity), 7500n);
  assert.equal(trade.agreedIrr, 500000000n); // Synthetic agreed rate per gross gram, not a live quote.
});

test('IR-01 F3: synthetic customer and wholesaler trades stay separate', () => {
  const customerBuy = sample();
  const wholesaleSell = createTrade({
    id: 'synthetic-wholesale-1', side: 'sell', grossWeightG: '10.000',
    purity: '0.7500', priceIrrPerGram: '51000000',
    counterparty: 'fake-wholesaler', owner: 'fake-shop',
  });
  const paidCustomer = recordEvent(customerBuy, {
    key: 'bank-customer-1', kind: 'bank_confirmed', amountIrr: 300000000n,
  });
  assert.notEqual(customerBuy.id, wholesaleSell.id);
  assert.notEqual(customerBuy.counterparty, wholesaleSell.counterparty);
  assert.equal(customerBuy.agreedIrr, 500000000n);
  assert.equal(wholesaleSell.agreedIrr, 510000000n);
  assert.equal(remainingIrr(paidCustomer), 200000000n);
  assert.equal(remainingIrr(wholesaleSell), 510000000n);
  assert.equal(wholesaleSell.events.length, 1); // No settlement leaked between trades.
});


test('IR-01 F2: sale screenshot does not settle receivable', () => {
  // Synthetic agreed price: 4.000 g × 52,000,000 IRR/g = 208,000,000 IRR.
  const sale = createTrade({
    id: 'synthetic-f2-sale', side: 'sell', grossWeightG: '4.000',
    purity: '0.7500', priceIrrPerGram: '52000000',
    counterparty: 'fake-buyer-f2', owner: 'fake-shop',
  });
  assert.equal(sale.agreedIrr, 208000000n);
  assert.equal(remainingIrr(sale), 208000000n);
  const screenshot = recordEvent(sale, { key: 'f2-screenshot', kind: 'receipt_uploaded' });
  assert.equal(screenshot.clearedIrr, 0n);
  assert.equal(remainingIrr(screenshot), 208000000n);
  const confirmed = recordEvent(screenshot, {
    key: 'f2-bank-confirmed', kind: 'bank_confirmed', amountIrr: 208000000n,
  });
  assert.equal(remainingIrr(confirmed), 0n);
  const retry = recordEvent(confirmed, {
    key: 'f2-bank-confirmed', kind: 'bank_confirmed', amountIrr: 208000000n,
  });
  assert.equal(retry.clearedIrr, 208000000n);
  assert.equal(retry.events.length, 3); // Agreement, screenshot, one bank confirmation.
});


test('IR-01 F4: synthetic reversal is terminal, replay-safe, and audit-preserving', () => {
  const agreed = sample();
  const reversed = recordEvent(agreed, { key: 'f4-reversal', kind: 'reversal' });
  assert.deepEqual(agreed.events.map(e => e.kind), ['agreement']);
  assert.deepEqual(reversed.events.map(e => e.kind), ['agreement', 'reversal']);
  assert.equal(recordEvent(reversed, { key: 'f4-reversal', kind: 'reversal' }), reversed);
  assert.throws(() => recordEvent(reversed, {
    key: 'f4-bank-after-reversal', kind: 'bank_confirmed', amountIrr: 1n,
  }), /TRADE_REVERSED/);
  assert.throws(() => recordEvent(reversed, { key: 'f4-second-reversal', kind: 'reversal' }), /TRADE_REVERSED/);
  assert.deepEqual(reversed.events.map(e => e.kind), ['agreement', 'reversal']);
});
