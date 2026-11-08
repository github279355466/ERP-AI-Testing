const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const portal = context.pages().find((page) => page.url().includes('athena-test.digiwincloud.com.cn'));
  if (!portal) throw new Error('门户页未打开');
  await portal.bringToFront();
  const result = {};
  for (const [key, label, parent] of [['ap-biz-type', '应付业务单别', '应付管理'], ['ap-biz-type-param', '应付业务单别参数', '应付管理']]) {
    const before = new Set(context.pages());
    await portal.evaluate((args) => {
      const parentItem = Array.from(document.querySelectorAll('.menu-content')).find((node) => (node.textContent || '').trim() === args.parent);
      if (!parentItem) throw new Error('未找到父菜单 ' + args.parent);
      const li = parentItem.closest('li');
      if (li && li.className.includes('ant-menu-submenu') && !li.className.includes('ant-menu-submenu-open')) {
        li.querySelector('.ant-menu-submenu-title')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
    }, { parent });
    await portal.waitForTimeout(1200);
    await portal.evaluate((args) => {
      const target = Array.from(document.querySelectorAll('.menu-content')).find((node) => (node.textContent || '').trim() === args.label);
      if (!target) throw new Error('未找到菜单 ' + args.label);
      target.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      target.click();
    }, { label });
    await portal.waitForTimeout(4000);
    const created = context.pages().find((page) => !before.has(page));
    if (created) {
      await created.waitForLoadState('domcontentloaded').catch(() => undefined);
      const url = new URL(created.url());
      result[key] = { title: await created.title(), workItemCode: url.searchParams.get('workItemCode') };
    } else {
      result[key] = { error: '未打开新页面' };
    }
  }
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((error) => { console.error(error); process.exit(1); });
