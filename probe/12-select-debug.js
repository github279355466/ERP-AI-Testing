const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.filter((p) => p.url().includes('lowcode-form-render')).pop();
  if (!page) throw new Error('business page not found');

  const result = await page.evaluate(() => {
    const field = 'ops_unit_invnt_param.aprv_date_basis';
    const labels = Array.from(document.querySelectorAll(`label[for="${field}"]`));
    const label = labels.find((item) => {
      const wrapper = item.closest('[class*="FormItem-module_form-item__"]');
      return Boolean(wrapper && wrapper.offsetWidth > 0);
    });
    if (!label) return { found: false };
    const item = label.closest('[class*="FormItem-module_form-item__"]');
    const select = item.querySelector('[class*="Select-module_select__"]');
    const rect = select ? select.getBoundingClientRect() : null;
    const point = rect ? { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 } : null;
    const stack = point
      ? document.elementsFromPoint(point.x, point.y).slice(0, 6).map((el) => ({
          tag: el.tagName.toLowerCase(),
          cls: String(el.className).slice(0, 120),
          role: el.getAttribute('role'),
        }))
      : [];
    return {
      found: true,
      itemClass: String(item.className),
      itemText: (item.innerText || '').slice(0, 200),
      selectClass: select ? String(select.className) : null,
      rect,
      point,
      stack,
      html: select ? select.outerHTML.slice(0, 1200) : null,
    };
  });

  console.log(JSON.stringify(result, null, 2));
  // CDP 接管的 Browser 不调用 close()，进程退出即断开。
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
