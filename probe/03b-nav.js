const { attach } = require('./attach');
const fs = require('fs');

const TARGET_ID = process.argv[2] || '1018426297694908';

(async () => {
  const { page } = await attach();
  const xhr = [];
  page.on('request', (r) => {
    if (['xhr', 'fetch'].includes(r.resourceType())) xhr.push(`${r.method()} ${r.url().slice(0, 140)}`);
  });

  const before = { url: page.url(), frames: page.frames().map((f) => f.url().slice(0, 100)) };
  const clicked = await page.evaluate((id) => {
    const content = document.getElementById(id);
    if (!content) return 'not-found';
    content.click();
    return content.innerText.trim();
  }, TARGET_ID);
  console.log('CLICK', clicked);
  await page.waitForTimeout(6000);

  const after = await page.evaluate(() => ({
    url: location.href,
    tabs: [...document.querySelectorAll('.ath-tab-menus-li')].map((e) => ({
      text: e.innerText.trim().replace(/\s+/g, ' '),
      active: e.className.includes('active'),
      html: e.outerHTML.slice(0, 260),
    })),
    iframes: [...document.querySelectorAll('iframe')].map((f) => ({ src: f.src.split('?')[0], visible: !!(f.offsetWidth || f.offsetHeight), cls: f.className })),
    containers: [...document.querySelectorAll('[class*=iframe],[class*=micro],[class*=app-container]')].slice(0, 8)
      .map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 90), id: e.id })),
  }));
  console.log('BEFORE', JSON.stringify(before));
  console.log('AFTER', JSON.stringify(after, null, 2));
  console.log('XHR', xhr.slice(-15).join('\n'));
  console.log('FRAMES', page.frames().map((f) => f.url().split('?')[0]));
  fs.mkdirSync('probe/shots', { recursive: true });
  await page.screenshot({ path: 'probe/shots/03b-nav.png' });
  process.exit(0);
})();
