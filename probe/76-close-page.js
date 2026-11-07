const { chromium } = require('@playwright/test');
const CODE = process.argv[2];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let closed = 0;
  for (const p of [...context.pages()]) {
    if (p.url().includes(`workItemCode=${CODE}`)) {
      await p.close().catch(() => undefined);
      closed += 1;
    }
  }
  console.log('closed:', closed);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
