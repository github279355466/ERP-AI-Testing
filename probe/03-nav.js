const { attach } = require('./attach');
const fs = require('fs');

const TARGET_ID = process.argv[2] || '1018426297694908';

(async () => {
  const { page } = await attach();
  await page.waitForTimeout(800);

  const before = { url: page.url() };

  const clicked = await page.evaluate((id) => {
    const content = document.getElementById(id);
    if (!content) return 'not-found';
    const li = content.closest('li');
    li.click();
    return { text: content.innerText.trim().replace(/\s+/g, ' '), cls: li.className };
  }, TARGET_ID);
  console.log('CLICK', JSON.stringify(clicked));

  await page.waitForTimeout(5000);

  const after = await page.evaluate(() => {
    const tabLike = [...document.querySelectorAll('[class*=tab]')]
      .filter((e) => e.children.length < 12)
      .slice(0, 10)
      .map((e) => ({ cls: String(e.className).slice(0, 80), text: (e.innerText || '').trim().slice(0, 60) }));
    const iframes = [...document.querySelectorAll('iframe')].map((f) => f.src);
    const mainCandidates = [...document.querySelectorAll('main,[class*=content],[class*=router],[class*=workspace],[class*=page]')]
      .slice(0, 10)
      .map((e) => ({ tag: e.tagName.toLowerCase(), cls: String(e.className).slice(0, 100), html: e.innerHTML.slice(0, 200) }));
    return {
      url: location.href,
      hash: location.hash,
      tabs: tabLike,
      iframes,
      mainCandidates,
      textTop: document.body.innerText.trim().slice(0, 400),
    };
  });

  console.log('BEFORE', JSON.stringify(before));
  console.log('AFTER', JSON.stringify(after, null, 2));
  console.log('FRAMES', page.frames().map((f) => f.url()));

  fs.mkdirSync('probe/shots', { recursive: true });
  await page.screenshot({ path: 'probe/shots/03-nav.png' });
  process.exit(0);
})();
