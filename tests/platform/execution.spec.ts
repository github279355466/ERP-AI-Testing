import { expect, test } from '@playwright/test';
import { PlatformExecutionPlan } from '../../src/platform/plan/module-plan';
import { PlatformStep, PlatformTestCase } from '../../src/platform/plan/compile';
import { CaseRunner, CaseRunOutput, classifyFailure, retryEligible, runSchedule } from '../../src/platform/execution/scheduler';
import { evaluateAssertions, matchExpected } from '../../src/platform/assertion/engine';
import { buildExecutionReport, renderHtml, renderMarkdown, validateReport } from '../../src/platform/report/engine';

const sourceRef = { document_id: 'DOC-1', file_path: 'docs/x.md', source_type: 'PRD_DERIVED' as const };

function step(action: PlatformStep['action'] = 'assert_visible'): PlatformStep {
  return { action, target: '字段' };
}

function testCase(id: string, options: { steps?: PlatformStep[]; timeout?: number; attempts?: number; safe?: boolean } = {}): PlatformTestCase {
  return {
    schema_version: '1.0',
    id,
    module_id: 'purchase',
    version: '0.1.0',
    title: id,
    objective: '验证',
    scenario_refs: ['SCN-1'],
    source_refs: [sourceRef],
    preconditions: [],
    data_recipe_refs: [],
    dependencies: [],
    steps: options.steps ?? [step()],
    assertions: [{ type: 'value', target: '字段', expected: 'A', level: 'ui', source_ref: sourceRef }],
    cleanup_policy: 'keep',
    status: 'draft',
    timeout_ms: options.timeout ?? 1_000,
    retry_policy: { max_attempts: options.attempts ?? 1, retry_safe_actions_only: options.safe ?? true },
  };
}

function planOf(cases: PlatformTestCase[], dependencies: Record<string, string[]> = {}): PlatformExecutionPlan {
  return {
    schema_version: '1.0',
    plan_id: 'PLAN-TEST',
    suite_id: 'SUITE-TEST',
    platform_version: '1.0.0',
    module_packs: [{ module_id: 'purchase', version: '0.1.0' }],
    steps: cases.map((entry, index) => ({ order: index + 1, case_id: entry.id, depends_on: dependencies[entry.id] ?? [] })),
    dry_run: true,
    created_at: new Date('2026-11-08T00:00:00Z').toISOString(),
  };
}

function passed(caseId: string): CaseRunOutput {
  return {
    status: 'passed',
    steps: [{ action: 'assert_visible', status: 'passed' }],
    assertions: [{ name: 'value:字段', level: 'ui', expected: 'A', actual: 'A', passed: true, source_ref: sourceRef }],
    evidence: [],
  };
}

test.describe('执行调度', () => {
  test('按依赖顺序执行并汇总结果', async () => {
    const cases = [testCase('TC-1'), testCase('TC-2')];
    const order: string[] = [];
    const runner: CaseRunner = { run: async (entry) => { order.push(entry.id); return passed(entry.id); } };
    const result = await runSchedule(planOf(cases, { 'TC-2': ['TC-1'] }), { runner, cases });
    expect(order).toEqual(['TC-1', 'TC-2']);
    expect(result.outcomes.every((outcome) => outcome.status === 'passed')).toBe(true);
  });

  test('上游失败后下游按策略阻塞', async () => {
    const cases = [testCase('TC-1'), testCase('TC-2')];
    const runner: CaseRunner = {
      run: async (entry) =>
        entry.id === 'TC-1'
          ? { status: 'failed', steps: [], assertions: [], evidence: [], failure_category: 'assertion', error_code: 'ASSERT_VALUE_FAILED' }
          : passed(entry.id),
    };
    const blocked = await runSchedule(planOf(cases, { 'TC-2': ['TC-1'] }), { runner, cases, failurePolicy: 'block_downstream' });
    expect(blocked.outcomes.find((entry) => entry.case_id === 'TC-2')?.status).toBe('blocked');
    const skipped = await runSchedule(planOf(cases, { 'TC-2': ['TC-1'] }), { runner, cases, failurePolicy: 'skip_downstream' });
    expect(skipped.outcomes.find((entry) => entry.case_id === 'TC-2')?.status).toBe('skipped');
  });

  test('超时用例标记失败且不影响后续用例', async () => {
    const cases = [testCase('TC-SLOW', { timeout: 30 }), testCase('TC-FAST')];
    const runner: CaseRunner = {
      run: async (entry) => {
        if (entry.id === 'TC-SLOW') await new Promise((resolve) => setTimeout(resolve, 200));
        return passed(entry.id);
      },
    };
    const result = await runSchedule(planOf(cases), { runner, cases });
    const slow = result.outcomes.find((entry) => entry.case_id === 'TC-SLOW');
    expect(slow?.status).toBe('failed');
    expect(slow?.error_code).toBe('TIMEOUT');
    expect(result.outcomes.find((entry) => entry.case_id === 'TC-FAST')?.status).toBe('passed');
  });

  test('取消后剩余用例标记 cancelled', async () => {
    const cases = [testCase('TC-1'), testCase('TC-2')];
    const controller = new AbortController();
    controller.abort();
    const result = await runSchedule(planOf(cases), { runner: { run: async (entry) => passed(entry.id) }, cases, signal: controller.signal });
    expect(result.cancelled).toBe(true);
    expect(result.outcomes.every((outcome) => outcome.status === 'cancelled')).toBe(true);
  });

  test('受控并发不超过配置', async () => {
    const cases = [testCase('TC-1'), testCase('TC-2'), testCase('TC-3')];
    let active = 0;
    let peak = 0;
    const runner: CaseRunner = {
      run: async (entry) => {
        active += 1;
        peak = Math.max(peak, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return passed(entry.id);
      },
    };
    await runSchedule(planOf(cases), { runner, cases, concurrency: 2 });
    expect(peak).toBe(2);
  });

  test('非幂等写动作不自动重试', async () => {
    const cases = [testCase('TC-WRITE', { steps: [step('save')], attempts: 3 }), testCase('TC-READ', { steps: [step('assert_visible')], attempts: 3 })];
    expect(retryEligible(cases[0])).toBe(false);
    expect(retryEligible(cases[1])).toBe(true);
    const calls: Record<string, number> = {};
    const runner: CaseRunner = {
      run: async (entry) => {
        calls[entry.id] = (calls[entry.id] ?? 0) + 1;
        return { status: 'failed', steps: [], assertions: [], evidence: [], failure_category: 'step', error_code: 'LOCATOR_UNRESOLVED' };
      },
    };
    await runSchedule(planOf(cases), { runner, cases });
    expect(calls['TC-WRITE']).toBe(1);
    expect(calls['TC-READ']).toBe(3);
  });

  test('失败分类可区分环境/造数/断言/步骤', () => {
    expect(classifyFailure('ENVIRONMENT_BLOCKED')).toBe('environment');
    expect(classifyFailure('RECIPE_WRITE_NOT_AUTHORIZED')).toBe('data_preparation');
    expect(classifyFailure('ASSERT_VALUE_FAILED')).toBe('assertion');
    expect(classifyFailure('LOCATOR_UNRESOLVED')).toBe('step');
    expect(classifyFailure('UNKNOWN')).toBe('platform');
  });
});

test.describe('断言引擎', () => {
  test('按类型比较期望值与实际值', () => {
    expect(matchExpected('value', 'SUPP-1001', '供应商 SUPP-1001')).toBe(true);
    expect(matchExpected('value', 'SUPP-1002', '供应商 SUPP-1001')).toBe(false);
    expect(matchExpected('count', '3', '共 3 行')).toBe(true);
    expect(matchExpected('visible', 'true', 'true')).toBe(true);
  });

  test('逐条保存预期、实际与来源', async () => {
    const evaluation = await evaluateAssertions(
      [
        { type: 'value', target: '供应商', expected: 'SUPP-1001', level: 'ui', source_ref: sourceRef },
        { type: 'status', target: '单据状态', expected: '未审核', level: 'business', source_ref: sourceRef },
      ],
      { read: async (assertion) => ({ actual: assertion.type === 'value' ? 'SUPP-1001' : '已审核' }) },
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.results[0].passed).toBe(true);
    expect(evaluation.results[1].actual).toBe('已审核');
    expect(evaluation.failures).toHaveLength(1);
    expect(evaluation.results[0].source_ref.file_path).toBe('docs/x.md');
  });

  test('探针异常记录为失败而不是通过', async () => {
    const evaluation = await evaluateAssertions(
      [{ type: 'value', target: '字段', expected: 'A', level: 'ui', source_ref: sourceRef }],
      { read: async () => { throw new Error('[LOCATOR_UNRESOLVED] 找不到控件'); } },
    );
    expect(evaluation.passed).toBe(false);
    expect(evaluation.results[0].error).toContain('LOCATOR_UNRESOLVED');
  });
});

test.describe('报告引擎', () => {
  const outcomes = [
    {
      ...passed('TC-1'),
      case_id: 'TC-1',
      duration_ms: 120,
      attempts: 1,
      evidence: ['shots/a.png'],
      data_recipe_refs: ['RECIPE-1'],
      cleanup: { status: 'not_run' as const, notes: '未执行清理' },
    },
  ];

  test('生成符合契约的报告并渲染三种格式', () => {
    const report = buildExecutionReport({
      runId: 'RUN-TEST',
      platformVersion: '1.0.0',
      modulePacks: [{ module_id: 'purchase', version: '0.1.0' }],
      environment: { name: 'athena-test', type: 'test', tenant_id: 'digichannel' },
      operator: 'qa',
      startedAt: '2026-11-08T00:00:00.000Z',
      finishedAt: '2026-11-08T00:00:01.000Z',
      outcomes,
    });
    expect(report.outcome).toBe('passed');
    expect(validateReport(report).valid).toBe(true);
    const markdown = renderMarkdown(report);
    expect(markdown).toContain('期望「A」实际「A」');
    expect(markdown).toContain('docs/x.md');
    expect(renderHtml(report)).toContain('<!doctype html>');
  });

  test('失败运行汇总为 failed 且保留失败分类', () => {
    const report = buildExecutionReport({
      runId: 'RUN-FAIL',
      platformVersion: '1.0.0',
      modulePacks: [],
      environment: { name: 'athena-test', type: 'test', tenant_id: 'digichannel' },
      operator: 'qa',
      startedAt: '2026-11-08T00:00:00.000Z',
      finishedAt: '2026-11-08T00:00:01.000Z',
      outcomes: [
        {
          case_id: 'TC-BAD',
          status: 'failed',
          duration_ms: 20,
          attempts: 1,
          steps: [],
          assertions: [],
          evidence: [],
          failure_category: 'assertion',
        },
      ],
    });
    expect(report.outcome).toBe('failed');
    expect(report.failure_category).toBe('assertion');
    expect(validateReport(report).valid).toBe(true);
  });
});
