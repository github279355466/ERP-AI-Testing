import { Page } from '@playwright/test';
import { AssertionEngine, AssertionLevel, AssertionResult } from '../assertion/assertion-engine';
import { AthenaConfig } from '../config/athena-config';
import { ErpForm } from '../controls/erp-form';
import { ErpGrid } from '../controls/erp-grid';
import { ErpDropdown } from '../controls/erp-dropdown';
import { ErpLookup } from '../controls/erp-lookup';
import { ErpTabs } from '../controls/erp-tabs';
import { EvidenceManager } from '../evidence/evidence-manager';
import { KnowledgePage } from '../knowledge/knowledge-base';
import { CaseResult, StepResult } from '../reporting/types';
import { SafetyPolicy } from './safety-policy';

export type ReadonlyStep =
  | { action: 'open'; url: string }
  | { action: 'click'; selector?: string; text?: string }
  | { action: 'waitFor'; selector: string; timeoutMs?: number }
  | { action: 'assertVisible'; level: AssertionLevel; name: string; selector: string }
  | { action: 'assertText'; level: AssertionLevel; name: string; selector: string; expected: string; mode?: 'equals' | 'contains' }
  | { action: 'assertCount'; level: AssertionLevel; name: string; selector: string; min: number }
  | {
      action: 'assertField';
      level: AssertionLevel;
      name: string;
      fieldPath: string;
      kind?: string;
      expectDisabled?: boolean;
      expectRequired?: boolean;
    }
  | { action: 'assertFieldValue'; level: AssertionLevel; name: string; fieldPath: string; expected: string; mode?: 'equals' | 'contains' }
  | { action: 'assertSwitch'; level: AssertionLevel; name: string; fieldPath: string; expected?: boolean }
  | { action: 'assertReadonly'; level: AssertionLevel; name: string; fieldPath: string }
  | { action: 'assertGrid'; level: AssertionLevel; name: string; minRows?: number; requiredColIds?: string[] }
  | {
      action: 'assertGridCell';
      level: AssertionLevel;
      name: string;
      rowIndex: number;
      colId: string;
      expected: string;
      mode?: 'equals' | 'contains';
    }
  | { action: 'assertGridMatchesField'; level: AssertionLevel; name: string; fieldPath: string }
  | {
      action: 'dropdownOptions';
      level: AssertionLevel;
      name: string;
      fieldPath: string;
      expectContains?: string[];
      expectOptions?: string[];
      expectSelected?: string;
    }
  | {
      action: 'lookupInfo';
      level: AssertionLevel;
      name: string;
      fieldPath: string;
      expectTitle?: string;
      minRows?: number;
      expectColumns?: string[];
      expectFilterRow?: boolean;
      expectSelectionMode?: 'single' | 'multi' | 'unknown';
    }
  | { action: 'closeTab' }
  | { action: 'screenshot'; name: string }
  | { action: 'snapshot'; name: string };

export interface ReadonlyCase {
  id: string;
  name: string;
  steps: ReadonlyStep[];
}

export class ReadonlyExecutor {
  constructor(
    private readonly page: Page,
    private readonly config: AthenaConfig,
    private readonly evidence: EvidenceManager,
    private readonly policy: SafetyPolicy,
  ) {}

  async runCase(definition: ReadonlyCase): Promise<CaseResult> {
    const assertions = new AssertionEngine();
    const steps: StepResult[] = [];
    const evidence: string[] = [];
    const startedAt = new Date().toISOString();
    const started = Date.now();
    let error: string | null = null;

    for (const step of definition.steps) {
      try {
        const assertActions = [
          'assertVisible',
          'assertText',
          'assertCount',
          'assertField',
          'assertFieldValue',
          'assertSwitch',
          'assertReadonly',
          'assertGrid',
          'assertGridCell',
          'assertGridMatchesField',
          'dropdownOptions',
          'lookupInfo',
        ];
        const popupActions = ['dropdownOptions', 'lookupInfo'];
        const policyType = assertActions.includes(step.action)
          ? 'assert'
          : step.action === 'closeTab'
            ? 'close-tab'
            : step.action === 'waitFor'
              ? 'read'
              : popupActions.includes(step.action)
                ? 'popup'
                : step.action;
        // click 的目标文本需要先解析元素再判定，放到 runStep 内执行。
        if (step.action !== 'click') {
          const policyDecision = this.policy.evaluate({
            type: policyType,
            text: 'text' in step && typeof step.text === 'string' ? step.text : undefined,
            url: step.action === 'open' ? step.url : undefined,
          });
          if (!policyDecision.allowed) {
            steps.push({ action: step.action, expected: '允许执行', actual: policyDecision.reason, status: 'blocked' });
            throw new Error(policyDecision.reason);
          }
        }

        const outcome = await this.runStep(step, assertions, evidence);
        steps.push(outcome);
        if (outcome.status === 'fail') break;
      } catch (caught) {
        error = caught instanceof Error ? caught.message : String(caught);
        steps.push({ action: step.action, expected: '执行成功', actual: error, status: 'blocked' });
        evidence.push(await this.evidence.screenshot(this.page, `${definition.id}-fail`).catch(() => ''));
        evidence.push(await this.evidence.domSnapshot(this.page, `${definition.id}-fail`).catch(() => ''));
        break;
      }
    }

    const failed = Boolean(error) || steps.some((step) => step.status !== 'ok') || !assertions.passed;
    return {
      id: definition.id,
      name: definition.name,
      status: error ? 'blocked' : failed ? 'failed' : 'passed',
      startedAt,
      durationMs: Date.now() - started,
      steps,
      assertions: assertions.all(),
      evidence: evidence.filter(Boolean),
      error,
      repro: definition.steps.map((step) => step.action),
    };
  }

  async runPageSmoke(pageInfo: KnowledgePage): Promise<CaseResult> {
    const definition: ReadonlyCase = {
      id: `SMOKE-${pageInfo.id}`,
      name: `${pageInfo.name} 只读冒烟`,
      steps: [{ action: 'assertCount', level: 'ui', name: '页面已渲染业务容器', selector: '.ant-tabs-tab, .ag-row, [class*="FormItem-module_form-item__"]', min: 1 }],
    };
    return this.runCase(definition);
  }

  private async runStep(
    step: ReadonlyStep,
    assertions: AssertionEngine,
    evidence: string[],
  ): Promise<StepResult> {
    switch (step.action) {
      case 'open': {
        await this.page.goto(step.url, { waitUntil: 'domcontentloaded', timeout: this.config.browser.navigationTimeoutMs });
        await this.page.waitForTimeout(1000);
        return { action: 'open', expected: '页面打开', actual: this.page.url(), status: 'ok' };
      }
      case 'click': {
        const target = step.selector
          ? this.page.locator(step.selector).first()
          : this.page.locator('button:visible', { hasText: step.text ?? '' }).first();
        const resolvedText = await target
          .evaluate((element) => {
            return (
              (element.textContent ?? '').trim() ||
              element.getAttribute('aria-label') ||
              element.getAttribute('title') ||
              ''
            );
          })
          .catch(() => '');
        const decision = this.policy.evaluate({ type: 'click', text: resolvedText, selector: step.selector });
        if (!decision.allowed) {
          throw new Error(`[${decision.code}] ${decision.reason}`);
        }
        await target.click({ timeout: this.config.browser.actionTimeoutMs });
        await this.page.waitForTimeout(500);
        return { action: 'click', expected: '点击成功', actual: resolvedText || step.selector || '', status: 'ok' };
      }
      case 'waitFor': {
        await this.page.locator(step.selector).first().waitFor({ state: 'visible', timeout: step.timeoutMs ?? this.config.browser.readyTimeoutMs });
        return { action: 'waitFor', expected: '元素可见', actual: step.selector, status: 'ok' };
      }
      case 'assertVisible': {
        const passed = await assertions.visible(step.level, step.name, this.page.locator(step.selector).first());
        return { action: 'assertVisible', expected: '可见', actual: passed ? '可见' : '不可见', status: passed ? 'ok' : 'fail' };
      }
      case 'assertText': {
        const text = (await this.page.locator(step.selector).first().innerText({ timeout: this.config.browser.actionTimeoutMs })).trim();
        const passed = step.mode === 'contains'
          ? assertions.contains(step.level, step.name, text, step.expected)
          : assertions.equals(step.level, step.name, text, step.expected);
        return { action: 'assertText', expected: step.expected, actual: text, status: passed ? 'ok' : 'fail' };
      }
      case 'assertCount': {
        const count = await this.page.locator(step.selector).count();
        const passed = assertions.gte(step.level, step.name, count, step.min);
        return { action: 'assertCount', expected: `>= ${step.min}`, actual: String(count), status: passed ? 'ok' : 'fail' };
      }
      case 'assertField': {
        const info = await new ErpForm(this.page).describe(step.fieldPath);
        let passed = step.kind ? assertions.equals(step.level, step.name, info.kind, step.kind) : assertions.equals(step.level, step.name, info.label.length > 0, true);
        if (typeof step.expectDisabled === 'boolean') {
          passed = assertions.equals(step.level, `${step.name}: 禁用态`, info.disabled, step.expectDisabled) && passed;
        }
        if (typeof step.expectRequired === 'boolean') {
          passed = assertions.equals(step.level, `${step.name}: 必填`, info.required, step.expectRequired) && passed;
        }
        return {
          action: 'assertField',
          expected: step.kind ?? '字段存在',
          actual: `${info.kind} / ${info.label} / required=${info.required} / disabled=${info.disabled} / editable=${info.editable}`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertFieldValue': {
        const info = await new ErpForm(this.page).describe(step.fieldPath);
        const passed = step.mode === 'contains'
          ? assertions.contains(step.level, step.name, info.value, step.expected)
          : assertions.equals(step.level, step.name, info.value, step.expected);
        return { action: 'assertFieldValue', expected: step.expected, actual: info.value, status: passed ? 'ok' : 'fail' };
      }
      case 'assertSwitch': {
        const info = await new ErpForm(this.page).readSwitch(step.fieldPath);
        let passed = true;
        if (typeof step.expected === 'boolean') {
          passed = assertions.equals(step.level, step.name, info.checked, step.expected);
        } else {
          assertions.record({
            level: step.level,
            name: step.name,
            expected: '可读取布尔状态',
            actual: `checked=${info.checked}`,
            passed: info.readable,
          });
          passed = info.readable;
        }
        return {
          action: 'assertSwitch',
          expected: typeof step.expected === 'boolean' ? String(step.expected) : '状态可读',
          actual: `checked=${info.checked} / disabled=${info.disabled}`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertReadonly': {
        const info = await new ErpForm(this.page).describe(step.fieldPath);
        const passed = assertions.equals(step.level, step.name, info.editable, false);
        return {
          action: 'assertReadonly',
          expected: '不可编辑',
          actual: `editable=${info.editable} / kind=${info.kind} / disabled=${info.disabled}`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertGrid': {
        const grid = new ErpGrid(this.page);
        const rows = await grid.rowCount();
        const headers = await grid.headers();
        const colIds = headers.map((header) => header.colId);
        let passed = true;
        if (typeof step.minRows === 'number') {
          passed = assertions.gte(step.level, `${step.name}: 行数`, rows, step.minRows) && passed;
        }
        for (const colId of step.requiredColIds ?? []) {
          passed = assertions.equals(step.level, `${step.name}: 列 ${colId}`, colIds.includes(colId), true) && passed;
        }
        return {
          action: 'assertGrid',
          expected: `${step.minRows ?? 0} 行 / ${(step.requiredColIds ?? []).length} 列`,
          actual: `${rows} 行 / ${colIds.length} 列`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertGridCell': {
        const grid = new ErpGrid(this.page);
        const text = await grid.cellText(step.rowIndex, step.colId);
        const passed = step.mode === 'contains'
          ? assertions.contains(step.level, step.name, text, step.expected)
          : assertions.equals(step.level, step.name, text, step.expected);
        return {
          action: 'assertGridCell',
          expected: step.expected,
          actual: text,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'assertGridMatchesField': {
        const info = await new ErpForm(this.page).describe(step.fieldPath);
        const rows = await new ErpGrid(this.page).rowCount();
        const expected = Number(info.value.replace(/[^\d.-]/g, ''));
        let passed = false;
        if (Number.isFinite(expected)) {
          passed = assertions.equals(step.level, step.name, rows, expected);
        } else {
          assertions.record({
            level: step.level,
            name: step.name,
            expected: '字段为数字',
            actual: info.value,
            passed: false,
          });
        }
        return {
          action: 'assertGridMatchesField',
          expected: `明细行数=${info.value}`,
          actual: `${rows} 行`,
          status: passed ? 'ok' : 'fail',
        };
      }
      case 'dropdownOptions': {
        const dropdown = new ErpDropdown(this.page);
        const before = await new ErpForm(this.page).describe(step.fieldPath);
        await dropdown.open(step.fieldPath);
        try {
          const options = await dropdown.options();
          const selected = (await dropdown.selected()) || before.value;
          let passed = true;
          for (const expected of step.expectContains ?? []) {
            passed = assertions.contains(step.level, `${step.name}: ${expected}`, options.join(' | '), expected) && passed;
          }
          if (step.expectOptions) {
            const actualSet = options.map(compact).filter(Boolean).sort().join(' | ');
            const expectedSet = step.expectOptions.map(compact).sort().join(' | ');
            passed = assertions.equals(step.level, `${step.name}: 选项集合`, actualSet, expectedSet) && passed;
          }
          if (step.expectSelected) {
            passed = assertions.contains(step.level, `${step.name}: 选中项`, selected, step.expectSelected) && passed;
          }
          return {
            action: 'dropdownOptions',
            expected: step.expectOptions?.join(',') ?? step.expectContains?.join(',') ?? '选项可读',
            actual: `${options.join(',')} / selected=${selected}`,
            status: passed ? 'ok' : 'fail',
          };
        } finally {
          await dropdown.close();
        }
      }
      case 'lookupInfo': {
        const lookup = new ErpLookup(this.page);
        await lookup.open(step.fieldPath);
        try {
          const info = await lookup.info();
          let passed = true;
          if (step.expectTitle) passed = assertions.contains(step.level, `${step.name}: 标题`, info.title, step.expectTitle) && passed;
          if (typeof step.minRows === 'number') passed = assertions.gte(step.level, `${step.name}: 行数`, info.rowCount, step.minRows) && passed;
          for (const column of step.expectColumns ?? []) {
            passed = assertions.contains(step.level, `${step.name}: 列 ${column}`, info.columns.join(' | '), column) && passed;
          }
          if (typeof step.expectFilterRow === 'boolean') {
            passed = assertions.equals(step.level, `${step.name}: 筛选行`, info.hasFilterRow, step.expectFilterRow) && passed;
          }
          if (step.expectSelectionMode) {
            passed = assertions.equals(step.level, `${step.name}: 选择模式`, info.selectionMode, step.expectSelectionMode) && passed;
          }
          return {
            action: 'lookupInfo',
            expected: step.expectTitle ?? '选择器可读',
            actual: `${info.title} / ${info.rowCount} 行 / ${info.selectionMode} / filter=${info.hasFilterRow}`,
            status: passed ? 'ok' : 'fail',
          };
        } finally {
          await lookup.close();
        }
      }
      case 'closeTab': {
        const result = await new ErpTabs(this.page).closeActiveWithDiscard();
        return { action: 'closeTab', expected: '页签关闭', actual: result.closed ? `closed(guard=${result.guardShown})` : '未找到页签', status: result.closed ? 'ok' : 'fail' };
      }
      case 'screenshot': {
        evidence.push(await this.evidence.screenshot(this.page, step.name));
        return { action: 'screenshot', expected: '截图保存', actual: step.name, status: 'ok' };
      }
      case 'snapshot': {
        evidence.push(await this.evidence.domSnapshot(this.page, step.name));
        return { action: 'snapshot', expected: 'DOM 保存', actual: step.name, status: 'ok' };
      }
      default: {
        const unknown = step as { action: string };
        return { action: unknown.action, expected: '支持的动作', actual: '未知动作', status: 'blocked' };
      }
    }
  }
}

function compact(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

export type { AssertionResult };
