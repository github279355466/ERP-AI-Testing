import { Page } from '@playwright/test';
import { ModuleFlow, flowAssertion } from '../types';
import { loadFieldRuleSets, rulesForPage } from '../../platform/rules/loader';
import { captureFieldStates, probeUniqueField } from '../../platform/rules/browser-probe';
import { evaluateFieldRuleSet } from '../../platform/rules/engine';

function requireParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) throw new Error(`[FLOW_PARAM_MISSING] foundation-field-rules 缺少参数 ${key}`);
  return value;
}

async function readFirstRowValue(page: Page, column: string): Promise<string> {
  return page.evaluate((colId) => {
    const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
    for (const row of rows) {
      const text = (row.querySelector(`.ag-cell[col-id="${colId}"]`)?.textContent || '').trim();
      if (text) return text;
    }
    return '';
  }, column);
}

async function clearFilters(page: Page): Promise<void> {
  const filterButton = page.locator('button:visible', { hasText: '筛选' }).first();
  if ((await filterButton.count()) === 0) return;
  await filterButton.click().catch(() => undefined);
  await page.waitForTimeout(700);
  const popover = page.locator('[class*="MultiConditionFilter-module_popover-content"]:visible').last();
  if ((await popover.count()) === 0) return;
  const clear = popover.locator('button', { hasText: '清空' }).last();
  if ((await clear.count()) > 0) {
    await clear.click().catch(() => undefined);
    await page.waitForTimeout(400);
  }
  await popover.locator('button', { hasText: '筛选' }).last().click().catch(() => undefined);
  await page.waitForTimeout(1_800);
}

async function waitForForm(page: Page): Promise<void> {
  await page
    .waitForFunction(
      () => Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).some((node) => (node as HTMLElement).offsetWidth > 0),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => undefined);
  await page.waitForTimeout(800);
}

async function openCreateForm(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: '新增', exact: true }).first();
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const visible = await button
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (visible) {
      await button.click();
      return;
    }
    await page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
    await page.waitForTimeout(2_500);
  }
  throw new Error('[FLOW_LIST_NOT_READY] 列表页未出现「新增」按钮，已重载一次仍失败');
}

async function discardForm(formPage: Page): Promise<void> {
  const cancel = formPage.getByRole('button', { name: '取消', exact: true }).last();
  if ((await cancel.count()) > 0) {
    await cancel.click({ timeout: 5_000 }).catch(() => undefined);
    await formPage.waitForTimeout(900);
  }
  const dialog = formPage.locator('.rc-dialog-wrap:visible').last();
  if ((await dialog.count()) > 0) {
    const leave = dialog.getByRole('button', { name: '直接离开', exact: true });
    if ((await leave.count()) > 0) {
      await leave.last().click().catch(() => undefined);
      await formPage.waitForTimeout(1_200);
    } else {
      await dialog.getByRole('button', { name: '取消', exact: true }).last().click().catch(() => undefined);
      await formPage.waitForTimeout(800);
    }
  }
  const listTab = formPage.locator('.ant-tabs-tab', { hasText: '列表' }).first();
  if ((await listTab.count()) > 0) {
    await listTab.click().catch(() => undefined);
    await formPage.waitForTimeout(1_000);
  }
}

export const foundationFieldRules: ModuleFlow = async (context) => {
  const pageKey = requireParam(context.params, 'pageKey');
  const loaded = loadFieldRuleSets(process.cwd(), 'foundation');
  if (loaded.issues.length > 0) {
    throw new Error(
      `[FIELD_RULE_INVALID] ${loaded.issues.map((entry) => `${entry.file}: ${entry.messages.join('; ')}`).join(' | ')}`,
    );
  }
  const rules = rulesForPage(loaded.sets, pageKey);
  if (rules.length === 0) throw new Error(`[FIELD_RULE_EMPTY] foundation/${pageKey} 未配置字段规则`);
  const fields = [...new Set(rules.map((rule) => rule.field))];

  await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page, { forceReload: true });
  await context.pages.waitReady(context.page);
  await clearFilters(context.page);

  const uniqueRules = rules.filter((rule) => rule.type === 'UNIQUE');
  const duplicates: Record<string, string> = {};
  for (const rule of uniqueRules) {
    const column = rule.field.split('.').pop() ?? '';
    duplicates[rule.field] = column ? await readFirstRowValue(context.page, column) : '';
  }

  const beforePages = new Set(context.page.context().pages());
  await openCreateForm(context.page);
  await context.page.waitForTimeout(3_500);
  const opened = context.page
    .context()
    .pages()
    .find((candidate) => !beforePages.has(candidate) && candidate.url().includes('/detail'));
  const formPage = opened ?? context.page;
  const ownsPage = formPage !== context.page;
  if (ownsPage) await formPage.bringToFront();
  await waitForForm(formPage);

  const before = await captureFieldStates(formPage, fields);
  const unique: Record<string, { attempted: boolean; blocked: boolean; message: string }> = {};
  for (const rule of uniqueRules) {
    unique[rule.field] = await probeUniqueField(formPage, rule.field, duplicates[rule.field] ?? '');
  }
  const after = await captureFieldStates(formPage, fields);
  const evaluation = evaluateFieldRuleSet(rules, { before, after, unique });

  if (ownsPage) {
    await formPage.close().catch(() => undefined);
    await context.page.bringToFront();
  } else {
    await discardForm(formPage);
  }
  await context.pages.ensureListState(context.page, { forceReload: true }).catch(() => 0);
  await context.pages.waitReady(context.page).catch(() => undefined);

  const assertions = evaluation.results.map((result) => {
    const warning = result.status === 'warning';
    const skipped = result.status === 'skipped';
    return flowAssertion(
      `${result.rule_id}${warning ? '（候选/警告）' : ''}${skipped ? '（跳过）' : ''}`,
      result.status === 'passed' || warning || skipped,
      result.expected,
      skipped ? `跳过：${result.actual}` : result.actual,
      ['READONLY', 'DISABLED', 'MAX_LENGTH'].includes(result.type) ? 'ui' : 'business',
      context.sourceRef,
    );
  });
  assertions.push(
    flowAssertion(
      '规则集-无失败',
      evaluation.passed,
      'verified 规则全部通过',
      `passed=${evaluation.results.length - evaluation.failed - evaluation.warnings - evaluation.skipped} failed=${evaluation.failed} warnings=${evaluation.warnings} skipped=${evaluation.skipped}`,
      'business',
      context.sourceRef,
    ),
  );
  return {
    assertions,
    notes: `基础管理字段规则 ${pageKey}：${evaluation.results.length} 条，failed=${evaluation.failed}，warning=${evaluation.warnings}，skipped=${evaluation.skipped}`,
  };
};
