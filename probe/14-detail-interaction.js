const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.filter((p) => p.url().includes('lowcode-form-render')).pop();
  if (!page) throw new Error('business page not found');

  const buttons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('button'))
      .filter((item) => item.offsetWidth > 0)
      .map((item) => (item.textContent || '').trim())
      .filter(Boolean)
      .slice(0, 40),
  );
  console.log(JSON.stringify({ buttons }, null, 2));

  const lookup = await page.evaluate(() => {
    const field = 'ops_unit_invnt_param.ops_unit_no';
    const label = Array.from(document.querySelectorAll(`label[for="${field}"]`)).find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    const item = label?.closest('[class*="FormItem-module_form-item__"]');
    const trigger = item?.querySelector('[class*="WindowSelect-module_windowSelect"]');
    const rect = trigger?.getBoundingClientRect();
    return rect
      ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, cls: String(trigger.className) }
      : null;
  });
  console.log(JSON.stringify({ lookup }, null, 2));

  if (lookup) {
    await page.mouse.click(lookup.x + lookup.width - 16, lookup.y + lookup.height / 2);
    await page.waitForTimeout(1200);
    const dialog = await page.evaluate(() => {
      const dialogs = Array.from(document.querySelectorAll('.rc-dialog-wrap')).filter((item) => item.offsetWidth > 0);
      const last = dialogs[dialogs.length - 1];
      return {
        count: dialogs.length,
        title: last ? (last.innerText || '').split('\n')[0].trim() : '',
        rows: last ? last.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length : 0,
        buttons: last
          ? Array.from(last.querySelectorAll('button')).filter((b) => b.offsetWidth > 0).map((b) => (b.textContent || '').trim()).filter(Boolean)
          : [],
      };
    });
    console.log(JSON.stringify({ dialog }, null, 2));
    if (dialog.count > 0) {
      const cancel = page.locator('.rc-dialog-wrap').last().getByRole('button', { name: '取消', exact: true });
      if ((await cancel.count()) > 0) await cancel.first().click();
      else await page.keyboard.press('Escape');
    }
  }

  await page.keyboard.press('Escape');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
