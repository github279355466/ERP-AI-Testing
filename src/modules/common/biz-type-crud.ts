import { Page } from '@playwright/test';
import { ModuleFlow, flowAssertion } from '../types';

export interface BizTypeCrudOptions {
  formPrefix: string;
  bizProp: string;
  label: string;
  codePrefix: string;
  documentType: string;
}

async function openCreate(page: Page, formPrefix: string): Promise<void> {
  await page.getByRole('button', { name: '新增', exact: true }).first().click();
  await page.locator(`[id="${formPrefix}.biz_type_no"]`).waitFor({ state: 'visible', timeout: 15_000 });
}

async function fillField(page: Page, formPrefix: string, field: string, value: string): Promise<void> {
  await page.locator(`[id="${formPrefix}.${field}"] input`).first().fill(value);
}

async function readField(page: Page, formPrefix: string, field: string): Promise<string> {
  return page.locator(`[id="${formPrefix}.${field}"] input`).first().inputValue();
}

async function selectOption(page: Page, formPrefix: string, field: string, label: string): Promise<boolean> {
  await page.locator(`[id="${formPrefix}.${field}"] .ath-select`).first().click();
  const option = page.locator('.ath-select-item-option').filter({ hasText: label }).last();
  if ((await option.count()) === 0) return false;
  await option.click({ force: true });
  await page.waitForTimeout(500);
  return true;
}

export async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: '保存', exact: true }).last().click();
  await page.waitForTimeout(2_500);
}

export async function showList(page: Page): Promise<void> {
  const listTab = page.locator('[role="tab"], .ant-tabs-tab').filter({ hasText: '列表' }).first();
  if ((await listTab.count()) > 0) await listTab.click();
  await page
    .waitForSelector('.ag-center-cols-container .ag-cell[col-id="biz_type_no"]', { timeout: 15_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1_000);
}

export async function findRowIndex(page: Page, code: string): Promise<string> {
  return page.evaluate((target) => {
    const cells = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-cell[col-id="biz_type_no"]'));
    const hit = cells.find((cell) => (cell.textContent ?? '').trim() === target);
    return hit?.closest('.ag-row')?.getAttribute('row-index') ?? '';
  }, code);
}

export async function locateRowIndex(page: Page, code: string): Promise<string> {
  for (let reset = 0; reset < 10; reset += 1) {
    const prev = page.getByRole('button', { name: '上一页', exact: true }).last();
    if ((await prev.count()) === 0 || (await prev.isDisabled().catch(() => true))) break;
    await prev.click();
    await page.waitForTimeout(300);
  }
  for (let pageIndex = 0; pageIndex < 10; pageIndex += 1) {
    await page.evaluate(() => {
      const viewport = document.querySelector('.ag-body-viewport');
      if (viewport) viewport.scrollTop = viewport.scrollHeight;
    });
    await page.waitForTimeout(400);
    const rowIndex = await findRowIndex(page, code);
    if (rowIndex) return rowIndex;
    const next = page.getByRole('button', { name: '下一页', exact: true }).last();
    if ((await next.count()) === 0 || (await next.isDisabled().catch(() => true))) break;
    await next.click();
    await page.waitForTimeout(900);
  }
  return '';
}

export async function rowCellText(page: Page, rowIndex: string, colId: string): Promise<string> {
  return page.evaluate(
    ({ index, column }) => {
      const rows = Array.from(document.querySelectorAll(`.ag-row[row-index="${index}"]`));
      for (const row of rows) {
        const cell = row.querySelector(`.ag-cell[col-id="${column}"]`);
        if (cell) return (cell.textContent ?? '').trim();
      }
      return '';
    },
    { index: rowIndex, column: colId },
  );
}

export async function clickRowAction(page: Page, rowIndex: string, action: '失效' | '生效' | '删除'): Promise<void> {
  const trigger = page
    .locator(`.ag-row[row-index="${rowIndex}"] .ag-cell[col-id="operate"] .custom-op-more-btn[aria-haspopup="menu"]`)
    .last();
  await trigger.evaluate((node) => (node as HTMLElement).click());
  await page.waitForTimeout(500);
  await page.locator('[role="menuitem"]').filter({ hasText: action }).last().click();
  await page.waitForTimeout(500);
  await page.getByRole('button', { name: '确定', exact: true }).last().click();
  await page.waitForTimeout(2_000);
}

export async function waitStatus(page: Page, code: string, expected: string): Promise<{ status: string; rowIndex: string }> {
  let status = '';
  let rowIndex = '';
  for (let attempt = 0; attempt < 10; attempt += 1) {
    rowIndex = await locateRowIndex(page, code);
    if (!rowIndex) {
      status = '';
      await page.waitForTimeout(500);
      continue;
    }
    status = await rowCellText(page, rowIndex, 'manage_status');
    if (status === expected) break;
    await page.waitForTimeout(500);
  }
  return { status, rowIndex };
}

export function createBizTypeCrudFlow(options: BizTypeCrudOptions): ModuleFlow {
  return async ({ page, params, sourceRef }) => {
    const code = params.code || `${options.codePrefix}${Date.now()}`;
    const created = await createBizTypeRecord(page, options, code, params.name);
    const assertions = [];
    assertions.push(flowAssertion('新增后回读业务单别编号', created.code === code, code, created.code, 'persistence', sourceRef));
    assertions.push(flowAssertion('新增后回读业务单别名称', created.name === created.expectedName, created.expectedName, created.name, 'persistence', sourceRef));

    await page.getByRole('button', { name: '编辑', exact: true }).last().click();
    await page.waitForTimeout(1_000);
    const updatedName = `${created.expectedName}-改`;
    await fillField(page, options.formPrefix, 'biz_type_name', updatedName);
    await fillField(page, options.formPrefix, 'rmk', `${created.remark}-改`);
    await save(page);
    await showList(page);

    const updatedRowIndex = await locateRowIndex(page, code);
    const rowName = updatedRowIndex ? await rowCellText(page, updatedRowIndex, 'biz_type_name') : '';
    assertions.push(flowAssertion('列表回读修改后名称', rowName === updatedName, updatedName, rowName, 'persistence', sourceRef));

    if (updatedRowIndex) await clickRowAction(page, updatedRowIndex, '失效');
    const invalidState = await waitStatus(page, code, '失效');
    assertions.push(
      flowAssertion('执行失效操作', invalidState.status === '失效', '失效', invalidState.status || 'ROW_NOT_FOUND', 'business', sourceRef),
    );

    if (invalidState.rowIndex) await clickRowAction(page, invalidState.rowIndex, '生效');
    const activeState = await waitStatus(page, code, '生效');
    assertions.push(
      flowAssertion('生效后状态恢复', activeState.status === '生效', '生效', activeState.status || 'ROW_NOT_FOUND', 'business', sourceRef),
    );

    if (activeState.rowIndex) await clickRowAction(page, activeState.rowIndex, '删除');
    await page.waitForTimeout(1_500);
    const remaining = await locateRowIndex(page, code);
    assertions.push(flowAssertion('删除后列表不可见', remaining === '', '', remaining || 'ROW_NOT_FOUND', 'persistence', sourceRef));

    return {
      assertions,
      documents: [{ document_type: options.documentType, identifier: code }],
      notes: `${options.label}业务单别 ${code}：新增→修改→失效→生效→删除`,
    };
  };
}

export interface CreatedBizType {
  code: string;
  name: string;
  expectedName: string;
  remark: string;
}

export async function createBizTypeRecord(
  page: Page,
  options: BizTypeCrudOptions,
  code: string,
  name?: string,
): Promise<CreatedBizType> {
  const expectedName = name || `QA26${options.label}测试单别${code.slice(-6)}`;
  const remark = `QA26 P2 CRUD ${code}`;
  await openCreate(page, options.formPrefix);
  await selectOption(page, options.formPrefix, 'biz_prop', options.bizProp);
  await fillField(page, options.formPrefix, 'biz_type_no', code);
  await fillField(page, options.formPrefix, 'biz_type_name', expectedName);
  await fillField(page, options.formPrefix, 'biz_type_fname', `${expectedName}全称`);
  await selectOption(page, options.formPrefix, 'year_digit_type', '公元四码');
  await fillField(page, options.formPrefix, 'serl_digit', '4');
  await fillField(page, options.formPrefix, 'rmk', remark);
  await save(page);
  return {
    code: await readField(page, options.formPrefix, 'biz_type_no').catch(() => ''),
    name: await readField(page, options.formPrefix, 'biz_type_name').catch(() => ''),
    expectedName,
    remark,
  };
}

export async function deleteBizTypeRecord(page: Page, code: string): Promise<boolean> {
  await showList(page);
  const rowIndex = await locateRowIndex(page, code);
  if (!rowIndex) return false;
  await clickRowAction(page, rowIndex, '删除');
  await page.waitForTimeout(1_500);
  return (await locateRowIndex(page, code)) === '';
}
