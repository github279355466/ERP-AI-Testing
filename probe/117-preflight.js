const fs = require('node:fs');
const { chromium } = require('@playwright/test');

const PAGES = [
  { title: '供应商品号价格', prefix: 'supp_item_price', item: true, ccy: true },
  { title: '询价单', prefix: 'inq_doc', item: true, ccy: true },
  { title: '采购退货单', prefix: 'pur_rtn_doc', item: false, ccy: false },
  { title: '采购退货出库单', prefix: 'pur_rtn_stkou_doc', item: false, ccy: false },
];

async function findPage(context, title) {
  for (const p of context.pages()) {
    if (!p.url().includes('lowcode-form-render')) continue;
    if ((await p.title().catch(() => '')) === title) return p;
  }
  return null;
}

async function toList(page) {
  const url = new URL(page.url());
  if (url.pathname !== '/list') {
    url.pathname = '/list';
    ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((k) => url.searchParams.delete(k));
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(4000);
  }
}

async function openLookup(page, fieldPath) {
  const item = page.locator(`label[for="${fieldPath}"]:visible`).first().locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  const box = await item.locator('[class*="WindowSelect-module_windowSelect"]').first().boundingBox();
  if (!box) return null;
  await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
  await page.waitForTimeout(1200);
  return page.locator('.rc-dialog-wrap:visible').last();
}

async function countRows(modal) {
  if (!modal) return -1;
  return modal.locator('.ag-center-cols-container .ag-row[row-index]').count();
}

async function enterNew(context, page) {
  const before = new Set(context.pages());
  await page.locator('button:visible', { hasText: '新增' }).first().click();
  await page.waitForTimeout(2500);
  const created = context.pages().filter((p) => !before.has(p) && p.url().includes('/detail'));
  const detail = created[0] ?? page;
  await detail.bringToFront();
  await detail.waitForTimeout(1000);
  return { detail, ownsPage: created.length > 0 };
}

(async () => {
  const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
  const context = browser.contexts()[0];
  const result = { checkedAt: new Date().toISOString(), opsUnit: '000W1', pages: [] };

  for (const config of PAGES) {
    const record = { workItem: config.title, supplierRows: -1, itemRows: null, currencyRows: null, note: '' };
    const page = await findPage(context, config.title);
    if (!page) { record.note = 'page not found'; result.pages.push(record); continue; }
    try {
      await page.bringToFront();
      await toList(page);
      const entered = await enterNew(context, page);
      const detail = entered.detail;

      const ops = await openLookup(detail, `${config.prefix}.ops_unit_no`);
      record.opsRows = await countRows(ops);
      if (record.opsRows > 0) {
        await ops.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: '000W1' }).first().click();
        await detail.waitForTimeout(300);
        await ops.getByRole('button', { name: '确认', exact: true }).last().click();
        await detail.waitForTimeout(800);
      }

      const supp = await openLookup(detail, `${config.prefix}.supp_no`);
      record.supplierRows = await countRows(supp);
      if (supp) await supp.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
      await detail.waitForTimeout(400);

      if (config.item) {
        const item = await openLookup(detail, `${config.prefix}.item_no`);
        record.itemRows = await countRows(item);
        if (item) await item.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
        await detail.waitForTimeout(400);
      }
      if (config.ccy) {
        const ccy = await openLookup(detail, `${config.prefix}.ccy_no`);
        record.currencyRows = await countRows(ccy);
        if (ccy) await ccy.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
      }
      if (entered.ownsPage) {
        await detail.close().catch(() => undefined);
        await page.bringToFront();
      }
    } catch (error) {
      record.note = error instanceof Error ? error.message : String(error);
    } finally {
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForTimeout(300);
      const close = page.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
      if ((await close.count()) > 0) await close.click().catch(() => undefined);
      await page.waitForTimeout(400);
      const discard = page.getByRole('button', { name: '直接离开', exact: true });
      if ((await discard.count()) > 0) await discard.first().click().catch(() => undefined);
      result.pages.push(record);
    }
  }

  fs.mkdirSync('artifacts/session-outputs', { recursive: true });
  fs.writeFileSync('artifacts/session-outputs/purchase-preflight.json', JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
