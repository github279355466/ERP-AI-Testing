const { attach } = require('./attach');

(async () => {
  const { context } = await attach();
  const pages = context.pages();
  const page = pages.find((p) => /lowcode-form-render/.test(p.url())) || pages[pages.length - 1];
  await page.waitForTimeout(3000);

  console.log('URL', page.url());
  console.log('TITLE', await page.title());
  const info = await page.evaluate(() => {
    const el = (e) => ({
      tag: e.tagName.toLowerCase(),
      id: e.id || null,
      cls: String(e.className || '').slice(0, 110),
      type: e.getAttribute('type'),
      name: e.getAttribute('name'),
      ph: e.getAttribute('placeholder'),
      text: (e.innerText || '').trim().slice(0, 30),
    });
    return {
      text: document.body.innerText.trim().slice(0, 500),
      inputs: [...document.querySelectorAll('input,textarea')].slice(0, 30).map(el),
      buttons: [...document.querySelectorAll('button,[role=button],a')].slice(0, 25).map(el),
      selects: [...document.querySelectorAll('.ant-select,[class*=select]')].slice(0, 10).map(el),
      bodyChildren: [...document.body.children].map((e) => e.tagName.toLowerCase() + '.' + String(e.className).slice(0, 60)),
      elementCount: document.querySelectorAll('*').length,
      lsKeys: Object.keys(localStorage).slice(0, 25),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'probe/shots/04-page.png' });
  process.exit(0);
})();
