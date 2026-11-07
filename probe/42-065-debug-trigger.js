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

  const events = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warning') events.push({ type: 'console-' + msg.type(), text: msg.text().slice(0, 400) });
  });
  page.on('pageerror', (err) => events.push({ type: 'pageerror', text: String(err).slice(0, 500) }));
  page.on('request', (req) => {
    const url = req.url();
    if (req.method() === 'POST' || /acctg|form-data|runtime/i.test(url)) {
      events.push({ type: 'request', method: req.method(), url: url.split('?')[0].slice(-120), body: (req.postData() || '').slice(0, 300) });
    }
  });

  const item = page.locator('label[for="acctg_perid_info.begin_date"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  await item.locator('input').first().click();
  await page.waitForTimeout(600);
  const cell = page.locator('.digi-picker-dropdown:visible td[title="2027-02-01"]').first();
  console.log('cell:', await cell.count());
  await cell.click();
  await page.waitForTimeout(2500);
  console.log(JSON.stringify(events.slice(-40), null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
