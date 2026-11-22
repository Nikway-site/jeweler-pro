/** IR-02 synthetic-only browser/80-mm print preflight; does not activate fa-IR. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = process.env.QA_OUT || path.join(os.tmpdir(), 'jeweler-rtl-receipt');
// Load the actual TS receipt generator through Vite; no app server, API or DB.
const vite = await createServer({
  root,
  configFile: false,
  logLevel: 'error',
  resolve: { alias: { '@': path.join(root, 'src') } },
  server: { middlewareMode: true },
  appType: 'custom',
});
let browser;
try {
  const { buildReceiptHtml } = await vite.ssrLoadModule('/src/services/receipt.ts');
  const labels = {
    title: 'رسید آزمایشی', saleNo: 'شماره', date: 'تاریخ', customer: 'مشتری',
    product: 'کالا', quantity: 'تعداد', total: 'جمع کل', subtotal: 'جمع',
    discount: 'تخفیف', vatIncluded: 'مالیات', paid: 'پرداختی',
    balanceDue: 'مانده', taxOffice: 'اداره مالیات', taxNumber: 'شماره مالیاتی',
    notInvoice: 'این رسید آزمایشی فاکتور رسمی نیست',
  };
  const fmt = {
    money: (v) => v.toFixed(2) + ' TRY',
    date: () => '2026-11-22',
    number: (v) => String(v),
  };
  const html = buildReceiptHtml({
    _id: 'TEST-001', date: '2026-11-22', customerName: 'مشتری آزمایشی',
    lines: [{ productName: 'طلای ۱۸ عیار', quantity: 1, total: 123456.78 }],
    financial: { total: 123456.78, paid: 0, balanceDue: 123456.78 },
  }, { companyName: 'زرگری آزمایشی' }, labels, fmt, { direction: 'rtl' });

  browser = await chromium.launch({ headless: true });
  // 80 mm at CSS 96 dpi = ~302 px, without actual printer hardware.
  const page = await browser.newPage({ viewport: { width: 302, height: 900 } });
  await page.setContent(html);
  await page.emulateMedia({ media: 'print' });
  const snapshot = await page.evaluate(() => {
    const amounts = [...document.querySelectorAll('bdi[dir="ltr"]')];
    const viewport = document.documentElement.clientWidth;
    const clipped = amounts.some((el) => {
      const r = el.getBoundingClientRect();
      return r.left < -1 || r.right > viewport + 1;
    });
    // Range geometry checks actual Persian text, not full-width block boxes.
    // This is a provisional 4-CSS-px browser edge guard, not a print-margin certificate.
    const persianTextBounds = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const text = node.textContent?.trim() || '';
      if (!/[\u0600-\u06ff]/u.test(text)) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (!rect.width || !rect.height) continue;
        persianTextBounds.push({
          text: text.slice(0, 60),
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          marginLeft: Number(rect.left.toFixed(2)),
          marginRight: Number((viewport - rect.right).toFixed(2)),
        });
      }
    }
    const persianEdgeFailures = persianTextBounds.filter(
      (r) => r.marginLeft < 4 || r.marginRight < 4,
    );
    return {
      htmlDir: document.documentElement.dir,
      bodyDirection: getComputedStyle(document.body).direction,
      moneyAlignment: getComputedStyle(document.querySelector('.r')).textAlign,
      viewport,
      scrollWidth: document.documentElement.scrollWidth,
      isolatedValues: amounts.map((el) => el.textContent),
      clipped,
      persianTextBounds,
      persianEdgeFailures,
    };
  });
  assert.equal(snapshot.htmlDir, 'rtl');
  assert.equal(snapshot.bodyDirection, 'rtl');
  assert.equal(snapshot.moneyAlignment, 'left');
  assert.ok(snapshot.isolatedValues.includes('123456.78 TRY'));
  assert.ok(snapshot.isolatedValues.includes('TEST-001'));
  assert.ok(snapshot.isolatedValues.includes('2026-11-22'));
  assert.equal(snapshot.clipped, false, 'LTR amounts must fit the 80-mm viewport');
  assert.ok(snapshot.scrollWidth <= snapshot.viewport + 1, 'no horizontal overflow at 80 mm');

  const pdf = await page.pdf({ width: '80mm', height: '200mm', printBackground: true });
  assert.equal(pdf.subarray(0, 4).toString(), '%PDF');
  fs.mkdirSync(out, { recursive: true });
  await page.screenshot({ path: path.join(out, 'ir02-rtl-receipt-80mm.png'), fullPage: true });
  fs.writeFileSync(path.join(out, 'ir02-rtl-receipt-80mm.pdf'), pdf);
  fs.writeFileSync(path.join(out, 'ir02-rtl-receipt-check.json'), JSON.stringify(snapshot, null, 2));
  // Save the synthetic screenshot/PDF/measurements before a red margin assertion.
  assert.ok(snapshot.persianTextBounds.length >= 4, 'Persian labels/metadata must be measured');
  assert.deepEqual(snapshot.persianEdgeFailures, [],
    'Persian text must clear both 80-mm browser viewport edges by at least 4 CSS px: ' +
    JSON.stringify(snapshot.persianEdgeFailures.slice(0, 6)));
  console.log('[IR-02] Synthetic RTL receipt browser/80-mm print preflight PASS (not a physical printer or font-glyph certification)');
} finally {
  await browser?.close();
  await vite.close();
}
