const test=require('node:test');
const assert=require('node:assert/strict');
const {createTrade,recordEvent}=require('../baharstar-iran/goldAccounts');
const {buildJournalPreview,postToJewelerProLedger}=require('../baharstar-iran/ledgerBridge');
function trade(side='buy'){return createTrade({id:'synthetic-bridge',side,grossWeightG:'10.000',purity:'0.7500',priceIrrPerGram:'50000000',counterparty:'synthetic-party',owner:'synthetic-party'});}
test('buy preview is balanced in IRR',()=>{const p=buildJournalPreview(trade());assert.equal(p.currency,'IRR');assert.equal(p.lines[0].debit,500000000n);assert.equal(p.lines[1].credit,500000000n);assert.equal(p.mode,'PREVIEW_ONLY');});
test('sell preview has distinct receivable and revenue',()=>{const p=buildJournalPreview(trade('sell'));assert.match(p.lines[0].account,/receivable/);assert.match(p.lines[1].account,/revenue/);});
test('confirmed partial payment changes outstanding only',()=>{const t=recordEvent(trade(),{key:'bank-1',kind:'bank_confirmed',amountIrr:300000000n});const p=buildJournalPreview(t);assert.equal(p.remainingIrr,200000000n);assert.equal(p.lines[0].debit,500000000n);});
test('IRR posting into TRY ledger is forbidden',()=>assert.throws(()=>postToJewelerProLedger(),/IRR_LEDGER_NOT_SUPPORTED/));
test('gold ownership is not claimed by financial preview',()=>assert.equal(buildJournalPreview(trade()).goldOwnershipVerified,false));
