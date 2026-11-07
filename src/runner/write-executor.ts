import { BrowserContext, Page } from '@playwright/test';
import { AssertionEngine, AssertionLevel } from '../assertion/assertion-engine';
import { AthenaConfig } from '../config/athena-config';
import { EvidenceManager } from '../evidence/evidence-manager';
import { CaseResult, StepResult } from '../reporting/types';
import { SafetyPolicy } from './safety-policy';
import { MasterDataActions } from './actions/master-data-actions';

export type WriteStep =
  | { action: 'log'; name: string }
  | { action: 'switchWorkItem'; workItem: string }
  | { action: 'new' }
  | { action: 'clickButton'; text: string }
  | { action: 'fill'; fieldPath: string; value: string }
  | { action: 'pickDate'; fieldPath: string; value: string }
  | { action: 'openLookup'; fieldPath: string }
  | { action: 'lookupFilter'; field: string; value: string }
  | { action: 'selectLookupRow'; value: string; column?: string }
  | { action: 'confirmLookup' }
  | { action: 'cancelLookup' }
  | { action: 'save' }
  | { action: 'rowAction'; column: string; value: string; text: string }
  | { action: 'deleteRow'; column: string; value: string }
  | { action: 'deleteRowIfPresent'; column: string; value: string }
  | { action: 'confirmDialog' }
  | { action: 'filter'; field: string; value: string }
  | { action: 'clearFilter' }
  | { action: 'closeDetail' }
  | { action: 'waitRows'; min: number }
  | { action: 'assertLookup'; level: AssertionLevel; name: string; titleContains?: string; columns?: string[]; minRows?: number; single?: boolean }
  | { action: 'assertLookupRows'; level: AssertionLevel; name: string; expected: number }
  | { action: 'assertGridRows'; level: AssertionLevel; name: string; expected: number }
  | { action: 'assertGridCell'; level: AssertionLevel; name: string; rowIndex: number; colId: string; expected: string; mode?: 'equals' | 'contains' }
  | { action: 'assertGridSwitch'; level: AssertionLevel; name: string; rowIndex: number; expected: boolean }
  | { action: 'assertFieldValue'; level: AssertionLevel; name: string; fieldPath: string; expected: string; mode?: 'equals' | 'contains' }
  | { action: 'assertInputMax'; level: AssertionLevel; name: string; fieldPath: string; expected: string }
  | { action: 'assertSaveEnabled'; level: AssertionLevel; name: string; expected: boolean }
  | { action: 'assertRow'; level: AssertionLevel; name: string; column: string; value: string; expect?: boolean }
  | { action: 'assertRowCell'; level: AssertionLevel; name: string; matchColumn: string; matchValue: string; column: string; expected: string; mode?: 'equals' | 'contains' }
  | { action: 'assertToast'; level: AssertionLevel; name: string; expected: string }
  | { action: 'blocked'; name: string; reason: string }
  | { action: 'screenshot'; name: string }
  | { action: 'snapshot'; name: string };

export interface WriteCase {
  id: string;
  name: string;
  workItem: string;
  vars?: Record<string, string>;
  steps: WriteStep[];
  cleanup?: WriteStep[];
}

const POLICY_TYPES: Record<string, string> = {
  log: 'assert',
  switchWorkItem: 'read',
  new: 'new',
  clickButton: 'click',
  fill: 'fill',
  pickDate: 'pick-date',
  openLookup: 'popup',
  lookupFilter: 'filter',
  selectLookupRow: 'select',
  confirmLookup: 'confirm',
  cancelLookup: 'close-tab',
  save: 'save',
  rowAction: 'row-action',
  deleteRow: 'delete',
  deleteRowIfPresent: 'delete',
  confirmDialog: 'confirm',
  filter: 'filter',
  clearFilter: 'filter',
  closeDetail: 'close-tab',
  waitRows: 'read',
  assertLookup: 'assert',
  assertLookupRows: 'assert',
  assertGridRows: 'assert',
  assertGridCell: 'assert',
  assertGridSwitch: 'assert',
  assertFieldValue: 'assert',
  assertInputMax: 'assert',
  assertSaveEnabled: 'assert',
  assertRow: 'assert',
  assertRowCell: 'assert',
  assertToast: 'assert',
  blocked: 'assert',
  screenshot: 'screenshot',
  snapshot: 'snapshot',
};

export class WriteExecutor {
  private readonly context: BrowserContext;
  private listPage!: Page;
  private activePage!: Page;
  private detailPage: Page | null = null;
  private runToken = '';
  private lastToast = '';
  private readonly actions: MasterDataActions;

  constructor(
    page: Page,
    private readonly config: AthenaConfig,
    private readonly evidence: EvidenceManager,
    private readonly policy: SafetyPolicy,
  ) {
    this.context = page.context();
    this.actions = new MasterDataActions(() => this.activePage);
  }

  async runCase(definition: WriteCase): Promise<CaseResult> {
    this.runToken = this.runToken || Date.now().toString(36).slice(-6).toUpperCase();
    const assertions = new AssertionEngine();
    const steps: StepResult[] = [];
    const evidence: string[] = [];
    const blockers: string[] = [];
    const startedAt = new Date().toISOString();
    const started = Date.now();
    let error: string | null = null;
    const vars = { run: this.runToken, ...(definition.vars ?? {}) };

    try {
      await this.prepareCase(definition.workItem);
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
      steps.push({ action: 'switchWorkItem', expected: definition.workItem, actual: error, status: 'blocked' });
    }

    if (!error) {
      for (const step of definition.steps) {
        const policyType = POLICY_TYPES[step.action] ?? 'assert';
        const decision = this.policy.evaluate({ type: policyType });
        if (!decision.allowed) {
          steps.push({ action: step.action, expected: '允许执行', actual: decision.reason, status: 'blocked' });
          error = decision.reason;
          break;
        }
        try {
          const outcome = await this.runStep(step, vars, assertions, evidence);
          steps.push(outcome);
          if (outcome.status === 'blocked') blockers.push(outcome.actual);
          if (outcome.status === 'fail') break;
        } catch (caught) {
          error = caught instanceof Error ? caught.message : String(caught);
          steps.push({ action: step.action, expected: '执行成功', actual: error, status: 'blocked' });
          evidence.push(await this.evidence.screenshot(this.activePage, `${definition.id}-fail`).catch(() => ''));
          evidence.push(await this.evidence.domSnapshot(this.activePage, `${definition.id}-fail`).catch(() => ''));
          break;
        }
      }
    }

    const failed = Boolean(error) || steps.some((step) => step.status === 'fail') || !assertions.passed;
    if (failed && definition.cleanup && definition.cleanup.length > 0) {
      await this.runCleanup(definition, vars, steps, evidence);
    }
    const status = error ? 'blocked' : failed ? 'failed' : blockers.length > 0 ? 'blocked' : 'passed';
    return {
      id: definition.id,
      name: definition.name,
      status,
      startedAt,
      durationMs: Date.now() - started,
      steps,
      assertions: assertions.all(),
      evidence: evidence.filter(Boolean),
      error: error ?? (blockers[0] ?? null),
      repro: definition.steps.map((step) => step.action),
    };
  }

  /** 用例失败/异常后的兜底清理：先关闭浮层与详情，再按 cleanup 步骤删除测试数据。 */
  private async runCleanup(
    definition: WriteCase,
    vars: Record<string, string>,
    steps: StepResult[],
    evidence: string[],
  ): Promise<void> {
    const cleanupAssertions = new AssertionEngine();
    try {
      await this.activePage.keyboard.press('Escape');
      await this.activePage.waitForTimeout(300);
      await this.activePage.keyboard.press('Escape');
    } catch {
      // 页面可能已关闭，忽略。
    }
    try {
      await this.closeDetail();
    } catch {
      // 无详情可关时忽略。
    }
    for (const step of definition.cleanup ?? []) {
      try {
        const outcome = await this.runStep(step, vars, cleanupAssertions, evidence);
        steps.push({ ...outcome, action: `cleanup:${outcome.action}` });
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : String(caught);
        steps.push({ action: `cleanup:${step.action}`, expected: '清理成功', actual: message, status: 'blocked' });
        evidence.push(await this.evidence.screenshot(this.activePage, `${definition.id}-cleanup-fail`).catch(() => ''));
      }
    }
    evidence.push(await this.evidence.screenshot(this.activePage, `${definition.id}-cleanup`).catch(() => ''));
  }

  private async prepareCase(workItem: string): Promise<void> {
    const page = await this.resolvePage(workItem);
    this.listPage = page;
    this.activePage = page;
    this.detailPage = null;
    await this.prepareList(page);
  }

  private async resolvePage(workItem: string): Promise<Page> {
    for (const page of this.context.pages()) {
      if (!page.url().includes('lowcode-form-render')) continue;
      if ((await page.title().catch(() => '')) === workItem) return page;
    }
    throw new Error(`未找到作业页面: ${workItem}`);
  }

  private async prepareList(page: Page): Promise<void> {
    await page.bringToFront();
    const url = new URL(page.url());
    if (url.pathname !== '/list' && (url.pathname === '/' || url.pathname.endsWith('/detail') || url.searchParams.has('pageCode'))) {
      url.pathname = '/list';
      ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'].forEach((key) =>
        url.searchParams.delete(key),
      );
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: this.config.browser.navigationTimeoutMs });
      await page.waitForTimeout(1500);
    }
    for (let guard = 0; guard < 10; guard += 1) {
      const tabs = page.locator('.ant-tabs-tab');
      if ((await tabs.count()) <= 1) break;
      const remove = tabs.last().locator('.ant-tabs-tab-remove');
      if ((await remove.count()) === 0) break;
      await remove.first().click();
      await page.waitForTimeout(300);
      const discard = page.getByRole('button', { name: '直接离开', exact: true });
      if ((await discard.count()) > 0) await discard.first().click();
      await page.waitForTimeout(300);
    }
    await this.waitRows(page, 1, 15000);
  }

  private async waitRows(page: Page, minRows: number, timeoutMs: number): Promise<number> {
    const started = Date.now();
    let count = 0;
    while (Date.now() - started < timeoutMs) {
      count = await page.evaluate(
        () => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((row) => (row as HTMLElement).offsetWidth > 0).length,
      );
      if (count >= minRows) return count;
      await page.waitForTimeout(300);
    }
    return count;
  }

  private async runStep(
    step: WriteStep,
    vars: Record<string, string>,
    assertions: AssertionEngine,
    evidence: string[],
  ): Promise<StepResult> {
    const page = this.activePage;
    switch (step.action) {
      case 'log':
        return { action: 'log', expected: '阶段标记', actual: step.name, status: 'ok' };
      case 'switchWorkItem': {
        await this.closeDetail();
        const next = await this.resolvePage(step.workItem);
        this.listPage = next;
        this.activePage = next;
        this.detailPage = null;
        await this.prepareList(next);
        return { action: 'switchWorkItem', expected: step.workItem, actual: next.url().split('?')[0], status: 'ok' };
      }
      case 'new': {
        await page.locator('button:visible', { hasText: '新增' }).first().click();
        await page.waitForTimeout(1200);
        await page.locator('[class*="FormItem-module_form-item__"]:visible').first().waitFor({ state: 'visible', timeout: 15000 });
        return { action: 'new', expected: '新增详情打开', actual: '详情页已渲染', status: 'ok' };
      }
      case 'clickButton': {
        await page.locator('button:visible', { hasText: step.text }).first().click();
        await page.waitForTimeout(1500);
        return { action: 'clickButton', expected: step.text, actual: '已点击', status: 'ok' };
      }
      case 'fill': {
        const item = this.fieldItem(step.fieldPath);
        const input = item.locator('input, textarea').first();
        await input.click();
        await input.fill('');
        await input.fill(render(step.value, vars));
        await page.keyboard.press('Tab');
        await page.waitForTimeout(700);
        return { action: 'fill', expected: render(step.value, vars), actual: await input.inputValue().catch(() => ''), status: 'ok' };
      }
      case 'pickDate': {
        const target = render(step.value, vars);
        const item = this.fieldItem(step.fieldPath);
        const input = item.locator('input').first();
        await input.click();
        await page.waitForTimeout(700);
        const cell = page.locator(`.digi-picker-dropdown:visible td[title="${target}"]`).first();
        if ((await cell.count()) > 0) {
          await cell.click();
        } else {
          await input.fill(target);
          await input.press('Enter');
        }
        await page.waitForTimeout(1500);
        return { action: 'pickDate', expected: target, actual: await input.inputValue().catch(() => ''), status: 'ok' };
      }
      case 'openLookup': {
        const trigger = this.fieldItem(step.fieldPath).locator('[class*="WindowSelect-module_windowSelect"]').first();
        const box = await trigger.boundingBox();
        if (!box) throw new Error(`开窗控件不可见: ${step.fieldPath}`);
        await page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
        await this.modal().waitFor({ state: 'visible', timeout: 15000 });
        await page.waitForTimeout(800);
        return { action: 'openLookup', expected: '开窗打开', actual: '查询弹窗可见', status: 'ok' };
      }
      case 'lookupFilter': {
        const modal = this.modal();
        await modal.locator('[class*="ConditionRow-module_row-field"] .ath-select').first().click();
        await page.waitForTimeout(500);
        await page
          .locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option:visible', { hasText: step.field })
          .first()
          .click();
        await page.waitForTimeout(300);
        const valueInput = modal.locator('input[placeholder="请输入值"]').first();
        await valueInput.click();
        await valueInput.fill(render(step.value, vars));
        await modal.locator('button', { hasText: '筛选' }).last().click();
        await page.waitForTimeout(1800);
        return { action: 'lookupFilter', expected: `${step.field} 包含 ${step.value}`, actual: '筛选已执行', status: 'ok' };
      }
      case 'selectLookupRow': {
        const modal = this.modal();
        const row = modal.locator('.ag-center-cols-container .ag-row[row-index]', { hasText: render(step.value, vars) }).first();
        if ((await row.count()) === 0) throw new Error(`开窗中未找到目标行: ${step.value}`);
        await row.click();
        await page.waitForTimeout(600);
        return { action: 'selectLookupRow', expected: render(step.value, vars), actual: '已选中 1 行', status: 'ok' };
      }
      case 'confirmLookup': {
        const modal = this.modal();
        await modal.getByRole('button', { name: '确认', exact: true }).last().click();
        await page.waitForTimeout(1800);
        return { action: 'confirmLookup', expected: '回填并关闭', actual: '弹窗已关闭', status: 'ok' };
      }
      case 'cancelLookup': {
        const modal = this.modal();
        await modal.getByRole('button', { name: '取消', exact: true }).last().click();
        await page.waitForTimeout(800);
        return { action: 'cancelLookup', expected: '取消并关闭', actual: '弹窗已关闭', status: 'ok' };
      }
      case 'save': {
        await page.locator('button:visible', { hasText: '保存' }).first().click();
        await page.waitForTimeout(2600);
        this.lastToast = await this.actions.readToast();
        return { action: 'save', expected: '保存成功', actual: this.lastToast || '(无提示文本)', status: 'ok' };
      }
      case 'rowAction': {
        const target = await this.actions.openRowAction(step.column, render(step.value, vars), step.text);
        this.activePage = target.page;
        this.detailPage = target.ownsPage ? target.page : null;
        return { action: 'rowAction', expected: `${step.text} ${step.value}`, actual: target.ownsPage ? 'detail page' : 'in-page tab', status: 'ok' };
      }
      case 'deleteRow': {
        await this.actions.clickDelete(step.column, render(step.value, vars));
        return { action: 'deleteRow', expected: '二次确认弹出', actual: '删除确认已打开', status: 'ok' };
      }
      case 'deleteRowIfPresent': {
        const value = render(step.value, vars);
        const index = await this.actions.rowIndex(step.column, value);
        if (index < 0) {
          return { action: 'deleteRowIfPresent', expected: `删除 ${value}（如存在）`, actual: '不存在，跳过', status: 'ok' };
        }
        const result = await this.actions.deleteRowWithConfirm(step.column, value);
        return {
          action: 'deleteRowIfPresent',
          expected: `删除 ${value}（如存在）`,
          actual: `${result.dialogText} / ${result.toast}`,
          status: 'ok',
        };
      }
      case 'confirmDialog': {
        const result = await this.actions.confirmDialog();
        this.lastToast = result.toast;
        return { action: 'confirmDialog', expected: '确认删除', actual: `${result.dialogText} / ${result.toast}`, status: 'ok' };
      }
      case 'filter': {
        await this.actions.filterBy(step.field, render(step.value, vars));
        return { action: 'filter', expected: `${step.field} 包含 ${step.value}`, actual: '筛选已执行', status: 'ok' };
      }
      case 'clearFilter': {
        await this.actions.clearFilter();
        return { action: 'clearFilter', expected: '清空并恢复', actual: '筛选条件已清空', status: 'ok' };
      }
      case 'closeDetail': {
        await this.closeDetail();
        return { action: 'closeDetail', expected: '详情关闭', actual: this.detailPage ? '弹窗页保留' : '已返回列表', status: 'ok' };
      }
      case 'waitRows': {
        const count = await this.actions.waitRows(step.min, 20000);
        return { action: 'waitRows', expected: `>= ${step.min}`, actual: String(count), status: count >= step.min ? 'ok' : 'fail' };
      }
      case 'assertLookup': {
        const info = await this.lookupInfo();
        let passed = true;
        if (step.titleContains) passed = assertions.contains(step.level, `${step.name}: 标题`, info.title, step.titleContains) && passed;
        if (typeof step.minRows === 'number') passed = assertions.gte(step.level, `${step.name}: 行数`, info.rows, step.minRows) && passed;
        for (const column of step.columns ?? []) {
          passed = assertions.contains(step.level, `${step.name}: 列 ${column}`, info.columns.join(' | '), column) && passed;
        }
        if (step.single) passed = assertions.equals(step.level, `${step.name}: 单选`, info.selectionMode, 'single') && passed;
        return {
          action: 'assertLookup',
          expected: step.titleContains ?? '开窗结构',
          actual: `${info.title} / ${info.rows} 行 / ${info.selectionMode}`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertLookupRows': {
        const info = await this.lookupInfo();
        const passed = assertions.equals(step.level, step.name, info.rows, step.expected);
        return { action: 'assertLookupRows', expected: String(step.expected), actual: String(info.rows), status: passed ? 'ok' : 'fail' };
      }
      case 'assertGridRows': {
        const count = await this.actions.gridRowCount();
        const passed = assertions.equals(step.level, step.name, count, step.expected);
        return { action: 'assertGridRows', expected: String(step.expected), actual: String(count), status: passed ? 'ok' : 'fail' };
      }
      case 'assertGridCell': {
        const cell = page.locator(`.ag-center-cols-container .ag-row[row-index="${step.rowIndex}"] .ag-cell[col-id="${step.colId}"]`).first();
        const text = (await cell.textContent().catch(() => ''))?.trim() ?? '';
        const passed =
          step.mode === 'contains'
            ? assertions.contains(step.level, step.name, text, step.expected)
            : assertions.equals(step.level, step.name, text, step.expected);
        return { action: 'assertGridCell', expected: step.expected, actual: text, status: passed ? 'ok' : 'fail' };
      }
      case 'assertGridSwitch': {
        const control = page.locator(`.ag-row[row-index="${step.rowIndex}"] button[role="switch"]`).first();
        const checked = await control.getAttribute('aria-checked');
        const passed = assertions.equals(step.level, step.name, checked, String(step.expected));
        return { action: 'assertGridSwitch', expected: String(step.expected), actual: String(checked), status: passed ? 'ok' : 'fail' };
      }
      case 'assertFieldValue': {
        const value = await this.readFieldValue(step.fieldPath);
        const passed =
          step.mode === 'contains'
            ? assertions.contains(step.level, step.name, value, render(step.expected, vars))
            : assertions.equals(step.level, step.name, value, render(step.expected, vars));
        return { action: 'assertFieldValue', expected: render(step.expected, vars), actual: value, status: passed ? 'ok' : 'fail' };
      }
      case 'assertInputMax': {
        const input = this.fieldItem(step.fieldPath).locator('input.input-number-input').first();
        const max = await input.getAttribute('aria-valuemax');
        const passed = assertions.equals(step.level, step.name, max, step.expected);
        return { action: 'assertInputMax', expected: step.expected, actual: String(max), status: passed ? 'ok' : 'fail' };
      }
      case 'assertSaveEnabled': {
        const button = page.locator('button:visible', { hasText: '保存' }).first();
        const disabled = await button.isDisabled().catch(() => true);
        const passed = assertions.equals(step.level, step.name, !disabled, step.expected);
        return { action: 'assertSaveEnabled', expected: String(step.expected), actual: `disabled=${disabled}`, status: passed ? 'ok' : 'fail' };
      }
      case 'assertRow': {
        const cells = await this.actions.readRow(step.column, render(step.value, vars));
        const exists = Boolean(cells);
        const expected = step.expect ?? true;
        const passed = assertions.equals(step.level, step.name, exists, expected);
        return { action: 'assertRow', expected: `存在=${expected}`, actual: exists ? JSON.stringify(cells) : '不存在', status: passed ? 'ok' : 'fail' };
      }
      case 'assertRowCell': {
        const cells = await this.actions.readRow(step.matchColumn, render(step.matchValue, vars));
        const text = cells?.[step.column] ?? '';
        const expected = render(step.expected, vars);
        const passed =
          step.mode === 'contains'
            ? assertions.contains(step.level, step.name, text, expected)
            : assertions.equals(step.level, step.name, text, expected);
        return { action: 'assertRowCell', expected, actual: text, status: passed ? 'ok' : 'fail' };
      }
      case 'assertToast': {
        const toast = await this.actions.readToast();
        const passed = assertions.contains(step.level, step.name, toast, step.expected);
        return { action: 'assertToast', expected: step.expected, actual: toast, status: passed ? 'ok' : 'fail' };
      }
      case 'blocked':
        return { action: 'blocked', expected: step.name, actual: step.reason, status: 'blocked' };
      case 'screenshot': {
        evidence.push(await this.evidence.screenshot(this.activePage, step.name));
        return { action: 'screenshot', expected: '截图保存', actual: step.name, status: 'ok' };
      }
      case 'snapshot': {
        evidence.push(await this.evidence.domSnapshot(this.activePage, step.name));
        return { action: 'snapshot', expected: 'DOM 保存', actual: step.name, status: 'ok' };
      }
      default: {
        const unknown = step as { action: string };
        return { action: unknown.action, expected: '支持的动作', actual: '未知动作', status: 'blocked' };
      }
    }
  }

  private fieldItem(fieldPath: string) {
    return this.activePage
      .locator(`label[for="${fieldPath}"]:visible`)
      .first()
      .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  }

  private async readFieldValue(fieldPath: string): Promise<string> {
    return this.activePage.evaluate((path) => {
      const label = document.querySelector(`label[for="${path}"]`);
      const item = label?.closest('[class*="FormItem-module_form-item__"]');
      if (!item) return '';
      const input = item.querySelector('input');
      if (input) {
        const isSelectInput = String(input.className).includes('ath-select-input');
        if (!isSelectInput) return input.value;
        if (input.value) return input.value;
      }
      const labelText = (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim();
      return (item.textContent || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(labelText, '')
        .replace(/^[:：]\s*/, '')
        .trim();
    }, fieldPath);
  }

  private modal() {
    return this.activePage.locator('.rc-dialog-wrap:visible').last();
  }

  private async lookupInfo(): Promise<{ title: string; columns: string[]; rows: number; selectionMode: 'single' | 'multi' | 'unknown' }> {
    const modal = this.modal();
    return modal.evaluate((element) => {
      const rows = new Set(
        Array.from(element.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) => row.getAttribute('row-index')),
      );
      const radios = element.querySelectorAll('input.digi-radio-input').length;
      const checkboxes = element.querySelectorAll('input.digi-checkbox-input').length;
      return {
        title: (element.querySelector('[class*="modal-title"]')?.textContent || '').trim(),
        columns: Array.from(element.querySelectorAll('.ag-header-cell'))
          .map((cell) => (cell.textContent || '').trim())
          .filter(Boolean),
        rows: rows.size,
        selectionMode: radios > 0 ? 'single' : checkboxes > 0 ? 'multi' : 'unknown',
      };
    });
  }

  private async closeDetail(): Promise<void> {
    if (this.detailPage) {
      const detail = this.detailPage;
      this.detailPage = null;
      await detail.close().catch(() => undefined);
      this.activePage = this.listPage;
      await this.listPage.bringToFront();
      await this.listPage.waitForTimeout(1500);
      return;
    }
    const close = this.listPage.locator('.ant-tabs-tab-active .ant-tabs-tab-remove').first();
    if ((await close.count()) > 0) await close.click();
    await this.listPage.waitForTimeout(400);
    const discard = this.listPage.getByRole('button', { name: '直接离开', exact: true });
    if ((await discard.count()) > 0) await discard.first().click();
    await this.listPage.waitForTimeout(1500);
  }
}

function render(value: string, vars: Record<string, string>): string {
  return value.replace(/\{\{(\w+)\}\}/g, (match, key: string) => vars[key] ?? match);
}
