const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  for (let i = 0; i < 5; i += 1) {
    const dlg = page.locator('.rc-dialog:visible').last();
    if ((await dlg.count()) === 0) break;
    const cancel = dlg.getByRole('button', { name: '取消', exact: true });
    const close = dlg.locator('.rc-dialog-close');
    if ((await cancel.count()) > 0) await cancel.last().click().catch(() => undefined);
    else if ((await close.count()) > 0) await close.first().click().catch(() => undefined);
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }
  console.log('dialogs left:', await page.locator('.rc-dialog:visible').count());
  const closeTab = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await closeTab.count()) > 0) {
    await closeTab.click().catch(() => undefined);
    await page.waitForTimeout(500);
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
    await page.waitForTimeout(1500);
  }
  console.log('path:', await page.evaluate(() => location.pathname), 'tabs:', await page.evaluate(() => Array.from(document.querySelectorAll('.ant-tabs-tab')).map((t) => (t.textContent || '').trim())));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
