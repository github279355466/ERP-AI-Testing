const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.filter((p) => p.url().includes('lowcode-form-render')).pop();
  if (!page) throw new Error('business page not found');

  let edit = page.locator('button:visible', { hasText: '编辑' }).first();
  if ((await edit.count()) === 0) {
    const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click();
    await page.waitForTimeout(600);
    const discard = page.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
    await page.waitForTimeout(600);
    const view = page.locator('button.custom-op-text-btn', { hasText: '查看' }).first();
    await view.click();
    await page.waitForTimeout(800);
    edit = page.locator('button:visible', { hasText: '编辑' }).first();
  }
  await edit.click();
  await page.waitForTimeout(1000);

  const fields = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]'))
      .filter((item) => item.offsetWidth > 0)
      .map((item) => {
        const label = item.querySelector('label[for]');
        const control = item.querySelector('input, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]');
        return {
          path: label?.getAttribute('for') ?? null,
          label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim(),
          required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
          tag: control ? control.tagName.toLowerCase() : '',
          cls: control ? String(control.className).slice(0, 120) : '',
          value: control && control.tagName === 'INPUT' ? control.value : (control?.textContent || '').trim().slice(0, 60),
        };
      });
  });
  console.log(JSON.stringify({ fields }, null, 2));

  const rect = await page.evaluate(() => {
    const label = Array.from(document.querySelectorAll('label[for="ops_unit_invnt_param.aprv_date_basis"]')).find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    const select = label?.closest('[class*="FormItem-module_form-item__"]')?.querySelector('[class*="Select-module_select__"]');
    const box = select?.getBoundingClientRect();
    return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null;
  });
  if (rect) {
    await page.mouse.click(rect.x + rect.width / 2, rect.y + rect.height / 2);
    await page.waitForTimeout(600);
    const options = await page.evaluate(() =>
      Array.from(document.querySelectorAll('.ath-select-dropdown .ath-select-item-option'))
        .filter((item) => item.offsetWidth > 0)
        .map((item) => ({
          text: (item.textContent || '').trim(),
          cls: String(item.className),
          html: item.outerHTML.slice(0, 300),
        })),
    );
    console.log(JSON.stringify({ options }, null, 2));
    await page.keyboard.press('Escape');
  }

  const cancel = page.getByRole('button', { name: '取消', exact: true });
  if ((await cancel.count()) > 0) await cancel.first().click();
  await page.waitForTimeout(500);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
