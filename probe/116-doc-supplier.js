const { chromium } = require('@playwright/test');
const TITLE = process.argv[2];
(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  let page = null;
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === TITLE) page = p;
  }
  if (!page) throw new Error('page not found');
  await page.bringToFront();
  const url = new URL(page.url());
  if (url.pathname !== '/list') {
    url.pathname = '/list';
    ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((k) => url.searchParams.delete(k));
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  }
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(1500);
  const prefix = TITLE === '询价单' ? 'inq_doc' : TITLE === '采购退货单' ? 'pur_rtn_doc' : 'pur_rtn_stkou_doc';
  const opsItem = page.locator(`label[for="${prefix}.ops_unit_no"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const box = await opsItem.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1000);
  const ops = page.locator('.rc-dialog-wrap:visible').last();
  await ops.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: '000W1' }).first().click();
  await page.waitForTimeout(300);
  await ops.getByRole('button', { name: '确认', exact: true }).last().click();
  await page.waitForTimeout(1000);

  const suppItem = page.locator(`label[for="${prefix}.supp_no"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const sbox = await suppItem.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
  await page.mouse.click(sbox.x + sbox.width - 16, sbox.y + sbox.height / 2);
  await page.waitForTimeout(1500);
  const supp = page.locator('.rc-dialog-wrap:visible').last();
  console.log(TITLE, 'supplier rows:', await supp.locator('.ag-center-cols-container .ag-row[row-index]').count());
  console.log('title:', (await supp.locator('[class*="modal-title"]').first().textContent().catch(() => ''))?.trim());
  await page.screenshot({ path: `artifacts/session-outputs/TP-027-052-purchase-evidence/${TITLE}-supplier-lookup.png`, fullPage: false });
  await supp.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
  await page.waitForTimeout(500);
  const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
  if ((await close.count()) > 0) await close.click().catch(() => undefined);
  await page.waitForTimeout(400);
  const discard = page.getByRole('button', { name: '直接离开', exact: true });
  if ((await discard.count()) > 0) await discard.first().click();
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
