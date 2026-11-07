const { chromium } = require('@playwright/test');
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间信息') page = candidate;
  }
  await page.bringToFront();
  const info = await page.evaluate(() => {
    const item = document.querySelector('label[for="acctg_perid_info.acctg_perid_table_no"]')?.closest('[class*="FormItem-module_form-item__"]');
    const date = document.querySelector('label[for="acctg_perid_info.begin_date"]')?.closest('[class*="FormItem-module_form-item__"]');
    return {
      tableHtml: item?.outerHTML,
      dateHtml: date?.outerHTML,
    };
  });
  console.log(info.tableHtml);
  console.log('=== DATE ===');
  console.log(info.dateHtml);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
