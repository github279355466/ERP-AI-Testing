const { launch, goto, waitReady, BASE } = require('./lib');

(async () => {
  const { browser, context } = await launch();
  const page = await context.newPage();
  await goto(page, BASE);
  await waitReady(page);
  await page.waitForTimeout(3000);

  console.log('URL', page.url());
  const info = await page.evaluate(() => {
    const pick = (el) => ({
      tag: el.tagName.toLowerCase(),
      type: el.getAttribute('type'),
      name: el.getAttribute('name'),
      id: el.id || null,
      cls: String(el.className || '').slice(0, 120),
      ph: el.getAttribute('placeholder'),
      formCtrl: el.getAttribute('formcontrolname'),
      text: (el.innerText || el.value || '').trim().slice(0, 40),
    });
    return {
      inputs: [...document.querySelectorAll('input,textarea')].map(pick),
      buttons: [...document.querySelectorAll('button,[role=button],a')].map(pick).slice(0, 40),
      text: document.body.innerText.trim().slice(0, 900),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await page.screenshot({ path: 'probe/login.png' });
  await browser.close();
})();
