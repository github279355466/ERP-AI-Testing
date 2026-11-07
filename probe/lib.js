const { chromium } = require('playwright');

const PROXY = 'http://127.0.0.1:10808';
const BASE = 'https://athena-test.digiwincloud.com.cn/';

async function launch() {
  const browser = await chromium.launch({ headless: true, proxy: { server: PROXY } });
  const context = await browser.newContext({
    viewport: { width: 1600, height: 950 },
    ignoreHTTPSErrors: true,
    locale: 'zh-CN',
  });
  return { browser, context };
}

async function goto(page, url, tries = 3) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
      return resp;
    } catch (e) {
      lastErr = e;
      await page.waitForTimeout(3000);
    }
  }
  throw lastErr;
}

async function waitReady(page) {
  try {
    await page.waitForFunction(() => {
      const n = document.querySelectorAll('*').length;
      return n > 120 && document.body.innerText.trim().length > 20;
    }, { timeout: 30000 });
  } catch (e) {
    // keep going, caller decides
  }
  await page.waitForTimeout(1500);
}

module.exports = { launch, goto, waitReady, BASE, PROXY };
