import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { compileScenarios, validateCompiled } from '../../src/platform/plan/compile';
import { Scenario } from '../../src/prd/types';

function scenario(overrides: Partial<Scenario> = {}): Scenario {
  return {
    id: 'SCN-SRC-0001',
    object_type: 'Scenario',
    name: '采购订单-数量为0校验',
    module: 'purchase',
    status: 'ACTIVE',
    schema_version: '1.0.0',
    source_refs: [
      {
        document_id: 'DOC-0001',
        file_path: '采购/01-采购订单.md',
        section: '3.2 数量校验',
        line_start: 120,
        line_end: 126,
        excerpt: '数量必须大于 0',
      },
    ],
    created_by_parser_version: '1.0.0',
    updated_at: '2026-11-08T00:00:00.000Z',
    title: '采购订单数量为 0 时禁止保存',
    test_objective: '验证数量校验规则',
    scenario_type: 'VALUE_VALIDATION',
    automation_feasibility: 'AUTOMATABLE',
    business_object: '采购订单',
    preconditions: ['已进入采购订单新增页'],
    data_requirements: ['字段 数量(qty)'],
    steps: ['进入采购订单', '输入数量 0', '保存'],
    assertions: [{ type: 'error_message', target: '数量', expected: '数量必须大于 0' }],
    expected_result: '提示数量必须大于 0',
    evidence_requirements: ['screenshot'],
    rule_ids: ['RULE-0001'],
    document_ids: ['DOC-0001'],
    case_ids: [],
    review_required: true,
    origin: 'GENERATED',
    ...overrides,
  };
}

test.describe('场景编译为可执行用例', () => {
  test('保留 PRD 来源与场景双向追溯', () => {
    const result = compileScenarios([scenario()], { moduleId: 'purchase' });
    expect(result.scenarios).toHaveLength(1);
    expect(result.testcases).toHaveLength(1);
    const compiled = result.testcases[0];
    expect(compiled.scenario_refs).toEqual([result.scenarios[0].id]);
    expect(compiled.source_refs[0].document_id).toBe('DOC-0001');
    expect(compiled.source_refs[0].line_start).toBe(120);
    expect(result.suite.case_ids).toContain(compiled.id);
    expect(validateCompiled(result)).toEqual([]);
  });

  test('缺少来源引用的场景被跳过并记录原因', () => {
    const result = compileScenarios([scenario({ id: 'SCN-NO-SOURCE', source_refs: [] })], { moduleId: 'purchase' });
    expect(result.testcases).toHaveLength(0);
    expect(result.skipped).toEqual([{ scenario_id: 'SCN-NO-SOURCE', reason: '缺少来源引用' }]);
  });

  test('步骤映射到 action-registry 中已登记的动作', () => {
    const registryPath = path.resolve(process.cwd(), 'platform/contracts/action-registry.json');
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8')) as { actions: Array<{ type: string }> };
    const registered = new Set(registry.actions.map((action) => action.type));
    const result = compileScenarios([scenario()], { moduleId: 'purchase' });
    for (const testCase of result.testcases) {
      for (const step of testCase.steps) expect(registered.has(step.action)).toBe(true);
      expect(testCase.steps.length).toBeGreaterThan(0);
      expect(testCase.assertions.length).toBeGreaterThan(0);
    }
  });

  test('空步骤与空断言被检出', () => {
    const result = compileScenarios([scenario()], { moduleId: 'purchase' });
    const broken = {
      ...result,
      testcases: result.testcases.map((testCase) => ({
        ...testCase,
        steps: [],
        assertions: [],
        scenario_refs: ['SCN-NOT-EXIST'],
      })),
    };
    const codes = validateCompiled(broken).map((issue) => issue.code);
    expect(codes).toContain('CASE_STEPS_MISSING');
    expect(codes).toContain('CASE_ASSERTIONS_MISSING');
    expect(codes).toContain('CASE_SCENARIO_MISSING');
  });

  test('已批准套件包含未批准用例时失败', () => {
    const result = compileScenarios([scenario()], { moduleId: 'purchase' });
    const approved = { ...result, suite: { ...result.suite, status: 'approved' as const } };
    const codes = validateCompiled(approved).map((issue) => issue.code);
    expect(codes).toContain('SUITE_HAS_UNAPPROVED_CASE');
  });

  test('同一来源场景编译结果稳定', () => {
    const first = compileScenarios([scenario()], { moduleId: 'purchase' });
    const second = compileScenarios([scenario()], { moduleId: 'purchase' });
    expect(first.testcases[0].id).toBe(second.testcases[0].id);
  });
});
