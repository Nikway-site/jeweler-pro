'use strict';
// Synthetic-only Iranian gold account model; NOT legal/tax/accounting approval.
// Explicitly separate trade agreement, gold custody, ownership and bank-cleared payments.
const { parseDecimal } = require('../domain/decimal');
function amount(value, scale) { return parseDecimal(value, scale); }
function createTrade({ id, side, grossWeightG, purity, priceIrrPerGram, counterparty, owner }) {
  if (!id || !counterparty || !owner || !['buy','sell'].includes(side)) throw Error('INVALID_TRADE');
  const weightMg = amount(grossWeightG, 3);
  const purity10000 = amount(purity, 4);
  const price = amount(priceIrrPerGram, 0);
  if (weightMg <= 0n || purity10000 <= 0n || purity10000 > 10000n || price <= 0n) throw Error('INVALID_VALUES');
  const numerator = weightMg * price;
  if (numerator % 1000n !== 0n) throw Error('NON_INTEGRAL_IRR');
  return { id, side, counterparty, owner, weightMg, purity10000, priceIrrPerGram:price,
    agreedIrr:numerator/1000n, events:[{key:'agreement:'+id,kind:'agreement'}], clearedIrr:0n, pendingIrr:0n };
}
function recordEvent(trade, {key,kind,amountIrr=0n}) {
  if (!key || !['payment_instruction','receipt_uploaded','bank_confirmed','reversal'].includes(kind)) throw Error('INVALID_EVENT');
  const value=BigInt(amountIrr);
  const prior = trade.events.find(e=>e.key===key);
  if (prior) {
    if (prior.kind!==kind || BigInt(prior.amountIrr || 0n)!==value) throw Error('IDEMPOTENCY_KEY_CONFLICT');
    return trade;
  }
  if (value<0n) throw Error('NEGATIVE_PAYMENT');
  if (kind==='bank_confirmed' && (value<=0n || trade.clearedIrr+value>trade.agreedIrr)) throw Error('INVALID_SETTLEMENT');
  if (kind==='reversal' && (trade.clearedIrr!==0n || value!==0n)) throw Error('REVERSAL_REQUIRES_ADJUSTMENT');
  return {...trade, clearedIrr:trade.clearedIrr+(kind==='bank_confirmed'?value:0n),
    events:[...trade.events,{key,kind,amountIrr:value}]};
}
function remainingIrr(trade) { return trade.agreedIrr-trade.clearedIrr; }
module.exports={createTrade,recordEvent,remainingIrr};
