const { attach } = require('./attach');
const fs = require('fs');

(async () => {
  const { page } = await attach();
  await page.waitForTimeout(2500);

  const info = await page.evaluate(() => {
    const describe = (el) => ({
      tag: el.tagName.toLowerCase(),
      id: el.id || undefined,
      cls: String(el.className || '').slice(0, 150),
      role: el.getAttribute('role') || undefined,
    });
    const regions = [...document.querySelectorAll('header,aside,nav,main,footer,[class*=layout],[class*=sider],[class*=header],[class*=menu]')]
      .slice(0, 25)
      .map(describe);
    const menuEls = [...document.querySelectorAll('[class*=menu]')].slice(0, 15).map(describe);
    return {
      url: location.href,
      title: document.title,
      bodySize: { w: document.body.scrollWidth, h: document.body.scrollHeight },
      regions,
      menuEls,
      tokenKeys: Object.keys(localStorage).filter((k) => /token|auth|user|tenant/i.test(k)).slice(0, 20),
      ngVersion: window.ng ? 'ng-debug' : null,
    };
  });
  console.log(JSON.stringify(info, null, 2));

  await page.screenshot({ path: 'probe/shots/01-home.png' });
  fs.mkdirSync('probe/shots', { recursive: true });
  process.exit(0);
})();
