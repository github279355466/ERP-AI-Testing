const { chromium } = require('@playwright/test');

const TARGET_ID = process.argv[2];
if (!TARGET_ID) {
  console.error('usage: node probe/18-open-workitem.js <menu-content-id>');
  process.exit(1);
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const portal = context.pages().find((p) => p.url().includes('athena-test.digiwincloud.com.cn'));
  if (!portal) throw new Error('portal page not found');

  const chain = await portal.evaluate((id) => {
    const content = document.getElementById(id);
    if (!content) return null;
    const leaf = content.closest('li');
    const nodes = [];
    let node = leaf;
    while (node) {
      nodes.push({
        text: (node.querySelector(':scope > .ant-menu-submenu-title') || node.querySelector(':scope > .menu-content'))
          ?.innerText.trim()
          .replace(/\s+/g, ' '),
        open: String(node.className).includes('ant-menu-submenu-open'),
      });
      node = node.parentElement?.closest('li');
    }
    return nodes.reverse();
  }, TARGET_ID);
  if (!chain) throw new Error(`menu item not found: ${TARGET_ID}`);
  console.log('CHAIN', JSON.stringify(chain));

  for (const item of chain.slice(0, -1)) {
    if (item.open) continue;
    const clicked = await portal.evaluate((text) => {
      const titles = Array.from(document.querySelectorAll('li.ant-menu-submenu > .ant-menu-submenu-title'));
      const target = titles.find((element) => (element.innerText || '').trim().replace(/\s+/g, ' ') === text);
      if (!target) return false;
      target.click();
      return true;
    }, item.text);
    console.log(`EXPAND ${item.text}: ${clicked}`);
    await portal.waitForTimeout(500);
  }

  const before = new Set(context.pages().map((p) => p.url()));
  const clicked = await portal.evaluate((id) => {
    const leaf = document.getElementById(id);
    if (!leaf) return false;
    leaf.scrollIntoView({ block: 'center' });
    leaf.click();
    return true;
  }, TARGET_ID);
  console.log(`CLICK ${TARGET_ID}: ${clicked}`);

  let opened = null;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    await portal.waitForTimeout(500);
    opened = context.pages().find((p) => !before.has(p.url()) && p.url().includes('lowcode-form-render'));
    if (opened) break;
  }
  if (!opened) throw new Error('new business page not opened');
  await opened.waitForLoadState('domcontentloaded').catch(() => undefined);
  await opened.waitForTimeout(2000);

  const info = await opened.evaluate(() => {
    const params = new URL(location.href).searchParams;
    return {
      title: document.title,
      workItemCode: params.get('workItemCode'),
      tabName: params.get('tabName'),
      path: location.pathname,
      tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => (tab.textContent || '').trim()),
      rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
      formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
    };
  });
  console.log('OPENED', JSON.stringify({ url: opened.url().replace(/token=[^&]+/, 'token=<redacted>'), ...info }, null, 2));
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
