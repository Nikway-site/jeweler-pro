'use strict';
// G2: read-only journal integration boundary. Never writes to Jeweler Pro's TRY ledger.
// The current ledger's supported currency units are TRY, XAU and XAG, not IRR.
// This adapter intentionally fails closed until an independently approved IRR posting path exists.
const { remainingIrr } = require('./goldAccounts');
function buildJournalPreview(trade) {
  if (!trade || !['buy','sell'].includes(trade.side) || !trade.id) throw Error('INVALID_TRADE');
  if (trade.clearedIrr < 0n || remainingIrr(trade) < 0n) throw Error('INVALID_BALANCE');
  const party = String(trade.counterparty);
  const gross = trade.agreedIrr;
  const lines = trade.side === 'buy'
    ? [{account:'inventory:gold:pending',unit:'IRR',debit:gross,credit:0n},
       {account:'payable:'+party,unit:'IRR',debit:0n,credit:gross}]
    : [{account:'receivable:'+party,unit:'IRR',debit:gross,credit:0n},
       {account:'revenue:gold',unit:'IRR',debit:0n,credit:gross}];
  const debit = lines.reduce((s,l)=>s+l.debit,0n);
  const credit = lines.reduce((s,l)=>s+l.credit,0n);
  if(debit!==credit) throw Error('UNBALANCED_PREVIEW');
  return {tradeId:trade.id,mode:'PREVIEW_ONLY',currency:'IRR',lines,remainingIrr:remainingIrr(trade),goldOwnershipVerified:false};
}
function postToJewelerProLedger() {
  throw Error('IRR_LEDGER_NOT_SUPPORTED: do not map IRR to TRY or post a preview');
}
module.exports={buildJournalPreview,postToJewelerProLedger};
