const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const pages = browser.contexts()[0].pages();
  const page = pages.find((p) => p.url().includes('athena-test.digiwincloud.com.cn'));
  if (!page) throw new Error('portal page not found');

  const result = await page.evaluate((ids) => {
    const read = (id) => {
      const content = document.getElementById(id);
      if (!content) return { id, found: false };
      const li = content.closest('li');
      const chain = [];
      let node = li;
      while (node) {
        const title = node.querySelector(':scope > .ant-menu-submenu-title');
        chain.push({
          cls: String(node.className).slice(0, 140),
          text: (title?.innerText || node.querySelector(':scope > .menu-content')?.innerText || '').trim().replace(/\s+/g, ' '),
          open: String(node.className).includes('ant-menu-submenu-open'),
          visible: (node.offsetWidth || 0) > 0,
        });
        node = node.parentElement?.closest('li');
      }
      return {
        id,
        found: true,
        text: (content.innerText || '').trim().replace(/\s+/g, ' '),
        visible: (content.offsetWidth || 0) > 0,
        rect: content.getBoundingClientRect(),
        chain: chain.reverse(),
      };
    };
    return { ids: ids.map(read) };
  }, ['1018426297694992', '1018426297694993']);

  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
