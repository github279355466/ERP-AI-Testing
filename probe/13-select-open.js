const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.filter((p) => p.url().includes('lowcode-form-render')).pop();
  if (!page) throw new Error('business page not found');

  const field = 'ops_unit_invnt_param.aprv_date_basis';
  const info = await page.evaluate((path) => {
    const label = Array.from(document.querySelectorAll(`label[for="${path}"]`)).find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    const item = label.closest('[class*="FormItem-module_form-item__"]');
    const select = item.querySelector('[class*="Select-module_select__"]');
    const ath = select.querySelector('.ath-select');
    const suffix = select.querySelector('.ath-select-suffix');
    const input = select.querySelector('input');
    const ancestors = [];
    let node = item;
    for (let i = 0; i < 6 && node; i += 1) {
      ancestors.push(String(node.className).slice(0, 160));
      node = node.parentElement;
    }
    const srect = suffix.getBoundingClientRect();
    return {
      selectClass: String(select.className),
      athClass: String(ath.className),
      pointerEvents: getComputedStyle(select).pointerEvents,
      ariaDisabled: ath.getAttribute('aria-disabled'),
      inputDisabled: input.disabled,
      inputReadonly: input.readOnly,
      suffixRect: { x: srect.x, y: srect.y, width: srect.width, height: srect.height },
      ancestors,
    };
  }, field);
  console.log(JSON.stringify(info, null, 2));

  const box = info.suffixRect;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => {
    const dropdowns = Array.from(document.querySelectorAll('.ath-select-dropdown'));
    return {
      count: dropdowns.length,
      visible: dropdowns.filter((item) => item.offsetWidth > 0).length,
      text: dropdowns.map((item) => (item.textContent || '').trim()).join(' | '),
      focus: document.activeElement ? String(document.activeElement.className) : '',
    };
  });
  console.log(JSON.stringify({ opened }, null, 2));
  await page.keyboard.press('Escape');
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
