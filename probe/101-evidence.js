const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('@playwright/test');
const OUT = 'artifacts/session-outputs/TP-061-062-069-070-evidence';
fs.mkdirSync(OUT, { recursive: true });

async function pageByTitle(context, title) {
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === title) return p;
  }
  return null;
}

async function toList(page) {
  await page.bringToFront();
  const url = new URL(page.url());
  if (url.pathname !== '/list') {
    url.pathname = '/list';
    ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((k) => url.searchParams.delete(k));
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
  }
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];

  for (const [title, file] of [['应收业务单别', 'TP-069-ar-biz-type-list.png'], ['应收业务单别参数', 'TP-070-ar-param-list.png'], ['应付业务单别', 'TP-061-ap-biz-type-list.png'], ['应付业务单别参数', 'TP-062-ap-param-list.png']]) {
    const page = await pageByTitle(context, title);
    if (!page) { console.log('missing page:', title); continue; }
    await toList(page);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(OUT, file), fullPage: false });
    console.log('shot:', file, 'rows:', await page.evaluate(() => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((r) => r.offsetWidth > 0).length));
  }

  const apParam = await pageByTitle(context, '应付业务单别参数');
  if (apParam) {
    await toList(apParam);
    await apParam.locator('button:visible', { hasText: '新增' }).first().click();
    await apParam.waitForTimeout(1500);
    const item = apParam.locator('label[for="biz_type_ap_param.ops_unit_no"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
    await apParam.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
    await apParam.waitForTimeout(1000);
    const ops = apParam.locator('.rc-dialog-wrap:visible').last();
    await ops.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: '000W1' }).first().click();
    await apParam.waitForTimeout(300);
    await ops.getByRole('button', { name: '确认', exact: true }).last().click();
    await apParam.waitForTimeout(800);

    const bizItem = apParam.locator('label[for="biz_type_ap_param.biz_type_no"]:visible').first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
    const bizBox = await bizItem.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
    await apParam.mouse.click(bizBox.x + bizBox.width - 16, bizBox.y + bizBox.height / 2);
    await apParam.waitForTimeout(1200);
    const biz = apParam.locator('.rc-dialog-wrap:visible').last();
    await apParam.screenshot({ path: path.join(OUT, 'TP-062-ap-param-biz-lookup-ar-domain.png'), fullPage: false });
    const rows = await biz.evaluate((el) => Array.from(el.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((r) => Object.fromEntries(Array.from(r.querySelectorAll('.ag-cell[col-id]')).map((c) => [c.getAttribute('col-id'), (c.textContent || '').trim()]))));
    const title = await biz.evaluate((el) => (el.querySelector('[class*="modal-title"]')?.textContent || '').trim());
    fs.writeFileSync(path.join(OUT, 'TP-062-ap-param-biz-lookup.json'), JSON.stringify({ title, rows }, null, 2), 'utf8');
    console.log('lookup title:', title, 'rows:', rows.length, 'first:', rows[0]);
    await biz.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
    await apParam.waitForTimeout(500);
    const close = apParam.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click().catch(() => undefined);
    await apParam.waitForTimeout(400);
    const discard = apParam.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
