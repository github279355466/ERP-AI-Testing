const { chromium } = require('playwright');

async function attach(endpoint = 'http://127.0.0.1:9333') {
  const browser = await chromium.connectOverCDP(endpoint);
  const context = browser.contexts()[0] || (await browser.newContext());
  const pages = context.pages();
  const page = pages.find((p) => /digiwincloud/.test(p.url())) || pages[0];
  return { browser, context, page };
}

module.exports = { attach };

if (require.main === module) {
  (async () => {
    const { browser, page } = await attach();
    console.log('URL', page.url());
    console.log('TITLE', await page.title());
    console.log('TEXT>>>\n' + (await page.evaluate(() => document.body.innerText.trim())).slice(0, 600));
    process.exit(0);
  })();
}
