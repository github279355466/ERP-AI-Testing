const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const candidate of context.pages()) {
    if (!candidate.url().includes('lowcode-form-render')) continue;
    if ((await candidate.title().catch(() => '')) === '会计期间表') page = candidate;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  const info = await page.evaluate(() => {
    const visible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
    return Array.from(document.querySelectorAll('button.custom-op-text-btn')).filter(visible).slice(0, 12).map((btn) => {
      const chain = [];
      let node = btn;
      for (let i = 0; i < 7 && node; i += 1) {
        chain.push({
          tag: node.tagName,
          cls: String(node.className).slice(0, 100),
          rowIndex: node.getAttribute ? node.getAttribute('row-index') : null,
          colId: node.getAttribute ? node.getAttribute('col-id') : null,
        });
        node = node.parentElement;
      }
      return { text: (btn.textContent || '').trim(), chain };
    });
  });
  console.log(JSON.stringify(info, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
