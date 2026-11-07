const fs = require('node:fs');
const { chromium } = require('@playwright/test');
const OUT = 'artifacts/session-outputs/TP-027-052-purchase-evidence';
fs.mkdirSync(OUT, { recursive: true });
const items = [
  ['批号编号规则', 'TP-027-batch-rule.png'],
  ['采购取价策略', 'TP-038-price-strategy.png'],
  ['供应商品号价格', 'TP-039-supplier-item-price.png'],
  ['询价单', 'TP-047-inquiry.png'],
  ['采购退货单', 'TP-051-return-doc.png'],
  ['采购退货出库单', 'TP-052-return-stockout.png'],
];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  for (const [title, file] of items) {
    let page = null;
    for (const p of context.pages()) {
      if (!p.url().includes('lowcode-form-render')) continue;
      if ((await p.title().catch(() => '')) === title) page = p;
    }
    if (!page) { console.log('missing:', title); continue; }
    await page.bringToFront();
    const url = new URL(page.url());
    if (url.pathname !== '/list') {
      url.pathname = '/list';
      ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((k) => url.searchParams.delete(k));
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(5000);
    }
    await page.screenshot({ path: `${OUT}/${file}`, fullPage: false });
    console.log('shot:', file, 'rows:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
