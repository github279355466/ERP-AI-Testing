import { Page } from '@playwright/test';
import { ModuleFlow, flowAssertion } from '../types';
import { locateRowIndex, rowCellText, showList } from './biz-type-crud';

export interface BizTypeParamCrudOptions {
  formPrefix: string;
  label: string;
  documentType: string;
  autoApproveField?: string;
  defaultOpsUnit?: string;
}

async function selectLookup(page: Page, formPrefix: string, field: string, value: string): Promise<boolean> {
  const root = page.locator(`[id="${formPrefix}.${field}"]`).first();
  const input = root.locator('input').first();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    await root.locator('.ath-select-content').first().click({ force: true });
    await page.waitForTimeout(400);
    await input.click({ force: true });
    await input.fill(value);
    const popup = page.locator('[class*="dropdownTable"]:visible').last();
    const scope = (await popup.count()) > 0 ? popup : page.locator('body');
    let row = scope.locator('.ag-row').filter({ hasText: value }).first();
    for (let wait = 0; wait < 10 && (await row.count()) === 0; wait += 1) {
      await page.waitForTimeout(500);
      row = scope.locator('.ag-row').filter({ hasText: value }).first();
    }
    if ((await row.count()) > 0) {
      const cell = row.locator('.ag-cell').filter({ hasText: value }).first();
      const clickable = cell.locator('[tabindex]').last();
      if ((await clickable.count()) > 0) await clickable.click({ force: true });
      else await cell.click({ force: true });
      await page.waitForTimeout(800);
      const display = await lookupDisplay(page, formPrefix, field);
      if (display.includes(value)) return true;
    }
    await page.keyboard.press('Escape').catch(() => undefined);
    await page.waitForTimeout(400);
  }
  return false;
}

async function lookupDisplay(page: Page, formPrefix: string, field: string): Promise<string> {
  const text = await page
    .locator(`[id="${formPrefix}.${field}"] .ath-select-content`)
    .first()
    .innerText()
    .catch(() => '');
  return (text || '').trim();
}

async function readSwitch(page: Page, formPrefix: string, field: string): Promise<string> {
  return page.evaluate(
    ({ prefix, name }) => {
      const node = document.getElementById(`${prefix}.${name}`);
      return node?.querySelector('[role="switch"]')?.getAttribute('aria-checked') ?? '';
    },
    { prefix: formPrefix, name: field },
  );
}

async function toggleSwitch(page: Page, formPrefix: string, field: string): Promise<void> {
  await page.evaluate(
    ({ prefix, name }) => {
      const node = document.getElementById(`${prefix}.${name}`);
      const button = node?.querySelector('[role="switch"]');
      (button as HTMLElement | null)?.click();
    },
    { prefix: formPrefix, name: field },
  );
  await page.waitForTimeout(600);
}

async function save(page: Page): Promise<void> {
  await page.getByRole('button', { name: '保存', exact: true }).last().click();
  await page.waitForTimeout(2_500);
}

async function closeDetail(page: Page): Promise<void> {
  await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.ant-tabs-tab')).filter((tab) => (tab.textContent ?? '').includes('详情'));
    tabs.forEach((tab) => {
      const button = tab.querySelector('.ant-tabs-tab-remove, button');
      (button as HTMLElement | null)?.click();
    });
  });
  await page.waitForTimeout(1_000);
}

async function deleteRow(page: Page, rowIndex: string): Promise<void> {
  await page.evaluate((index) => {
    const rows = Array.from(document.querySelectorAll(`.ag-row[row-index="${index}"]`));
    for (const row of rows) {
      const cell = row.querySelector('.ag-cell[col-id="operate"]');
      if (!cell) continue;
      const button = Array.from(cell.querySelectorAll('button')).find(
        (entry) => (entry.textContent ?? '').trim() === '删除' && (entry as HTMLElement).offsetParent !== null,
      );
      (button as HTMLElement | null)?.click();
    }
  }, rowIndex);
  await page.waitForTimeout(600);
  await page.getByRole('button', { name: '确定', exact: true }).last().click();
  await page.waitForTimeout(2_000);
}

export function createBizTypeParamCrudFlow(options: BizTypeParamCrudOptions): ModuleFlow {
  const prefix = options.formPrefix;
  const switchField = options.autoApproveField || 'creat_is_auto_aprv';
  const defaultOpsUnit = options.defaultOpsUnit || '000W1';
  return async ({ page, params, sourceRef }) => {
    const code = params.code || '';
    const opsUnit = params.opsUnit || defaultOpsUnit;
    if (!code) throw new Error('[FLOW_PARAM_MISSING] 缺少业务单别 code');
    const assertions = [];

    await page.getByRole('button', { name: '新增', exact: true }).first().click();
    await page.locator(`[id="${prefix}.biz_type_no"]`).waitFor({ state: 'visible', timeout: 30_000 });
    const opsSelected = await selectLookup(page, prefix, 'ops_unit_no', opsUnit);
    const bizSelected = await selectLookup(page, prefix, 'biz_type_no', code);
    const opsText = await lookupDisplay(page, prefix, 'ops_unit_no');
    const bizText = await lookupDisplay(page, prefix, 'biz_type_no');
    assertions.push(flowAssertion('选择运营单元', opsSelected && opsText.includes(opsUnit), opsUnit, opsText || 'NOT_SELECTED', 'ui', sourceRef));
    assertions.push(flowAssertion('选择业务单别', bizSelected && bizText.includes(code), code, bizText || 'NOT_SELECTED', 'ui', sourceRef));
    if (!opsSelected || !bizSelected) {
      throw new Error(`[LOOKUP_NOT_SELECTED] 运营单元=${opsText || '空'}，业务单别=${bizText || '空'}`);
    }

    await save(page);
    const opsDisplay = await lookupDisplay(page, prefix, 'ops_unit_no');
    assertions.push(flowAssertion('新增后运营单元已带出', opsDisplay.includes(opsUnit), opsUnit, opsDisplay, 'persistence', sourceRef));

    await page.getByRole('button', { name: '编辑', exact: true }).last().click();
    await page.waitForTimeout(800);
    const before = await readSwitch(page, prefix, switchField);
    await toggleSwitch(page, prefix, switchField);
    const after = await readSwitch(page, prefix, switchField);
    assertions.push(flowAssertion('切换自动审核开关', after !== before, `与 ${before} 相反`, after, 'ui', sourceRef));
    await save(page);
    const persisted = await readSwitch(page, prefix, switchField);
    assertions.push(flowAssertion('保存后自动审核已持久化', persisted === after, after, persisted, 'persistence', sourceRef));

    await closeDetail(page);
    await showList(page);
    const rowIndex = await locateRowIndex(page, code);
    assertions.push(flowAssertion('列表可见新增参数', rowIndex !== '', '存在', rowIndex || 'ROW_NOT_FOUND', 'persistence', sourceRef));
    const rowOpsUnit = rowIndex ? await rowCellText(page, rowIndex, 'ops_unit_no') : '';
    assertions.push(
      flowAssertion('列表回读运营单元', rowOpsUnit.includes(opsUnit), opsUnit, rowOpsUnit || 'ROW_NOT_FOUND', 'persistence', sourceRef),
    );

    if (rowIndex) await deleteRow(page, rowIndex);
    await page.waitForTimeout(1_000);
    const remaining = await locateRowIndex(page, code);
    assertions.push(flowAssertion('删除后参数不可见', remaining === '', '', remaining || 'ROW_NOT_FOUND', 'persistence', sourceRef));

    return {
      assertions,
      documents: [{ document_type: options.documentType, identifier: `${code}/${opsUnit}` }],
      notes: `${options.label}业务单别参数 ${code}/${opsUnit}：新增→修改→删除`,
    };
  };
}
