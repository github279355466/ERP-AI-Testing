import { Page } from '@playwright/test';
import { ModuleFlow, flowAssertion } from '../types';

const SWITCH_ID = 'ops_unit_invnt_param.is_ena_proj_mgmt';

async function readSwitch(page: Page): Promise<string> {
  return page.evaluate((id) => {
    const node = document.getElementById(id);
    const sw = node?.querySelector('button[role="switch"]');
    return sw ? (sw.getAttribute('aria-checked') ?? '') : '';
  }, SWITCH_ID);
}

async function clickSwitch(page: Page): Promise<boolean> {
  const box = await page.evaluate((id) => {
    const node = document.getElementById(id);
    const sw = node?.querySelector('button[role="switch"]');
    if (!sw) return null;
    const rect = sw.getBoundingClientRect();
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, SWITCH_ID);
  if (!box) return false;
  await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(800);
  return true;
}

async function openEdit(page: Page, opsUnit: string): Promise<boolean> {
  await page
    .waitForSelector('.ag-center-cols-container .ag-cell[col-id="ops_unit_no"]', { timeout: 15_000 })
    .catch(() => undefined);
  const rowIndex = await page.evaluate((unit) => {
    const cells = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-cell[col-id="ops_unit_no"]'));
    const hit = cells.find((cell) => (cell.textContent ?? '').trim() === unit);
    return hit?.closest('.ag-row')?.getAttribute('row-index') ?? '';
  }, opsUnit);
  if (!rowIndex) return false;

  const operateCell = page.locator(`.ag-row[row-index="${rowIndex}"] .ag-cell[col-id="operate"]`).first();
  const editLink = operateCell.getByText('编辑', { exact: true }).first();
  if ((await editLink.count()) === 0) return false;
  await editLink.evaluate((node) => (node as HTMLElement).click());
  await page.waitForTimeout(2_600);
  return true;
}

async function save(page: Page): Promise<string> {
  const button = page.getByRole('button', { name: '保存', exact: true }).last();
  if ((await button.count()) === 0) return 'NO_SAVE_BUTTON';
  await button.click();
  await page.waitForTimeout(2_600);
  return page.evaluate(() => {
    const toast = Array.from(document.querySelectorAll('[class*="message"], [class*="toast"], [class*="notification"]'))
      .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .pop();
    return toast ?? '';
  });
}

export const baseInventoryParamToggle: ModuleFlow = async ({ page, params, sourceRef }) => {
  const opsUnit = params.opsUnit || '000W1';
  const assertions = [];

  const opened = await openEdit(page, opsUnit);
  if (!opened) {
    throw new Error(`[FLOW_ROW_NOT_FOUND] 未能打开运营单元 ${opsUnit} 的存货参数编辑页`);
  }
  await page.waitForFunction(
    (id) => !!document.getElementById(id)?.querySelector('button[role="switch"]'),
    SWITCH_ID,
    { timeout: 15_000 },
  );

  const before = await readSwitch(page);
  const clicked = await clickSwitch(page);
  const afterToggle = await readSwitch(page);
  assertions.push(
    flowAssertion('切换启用项目管理', clicked && afterToggle !== before, `与 ${before} 相反`, afterToggle, 'ui', sourceRef),
  );

  const toast = await save(page);
  assertions.push(flowAssertion('保存返回成功提示', /操作成功/.test(toast), '操作成功', toast, 'ui', sourceRef));

  await page.waitForTimeout(1_500);
  const reopened = await openEdit(page, opsUnit);
  const persisted = reopened ? await readSwitch(page) : '';
  assertions.push(
    flowAssertion('重新打开后值已持久化', persisted === afterToggle, afterToggle, persisted, 'persistence', sourceRef),
  );

  if (reopened && persisted !== before) {
    await clickSwitch(page);
    await save(page);
  }

  return { assertions, notes: `存货参数 ${opsUnit}：${before} → ${afterToggle} → 回读 ${persisted}` };
};
