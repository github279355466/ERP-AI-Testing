import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { compileScenarios, CompileResult, PlatformTestCase } from '../../src/platform/plan/compile';
import { buildExecutionPlan } from '../../src/platform/plan/module-plan';
import { buildDryRunSummary, validateCompiledArtifacts, writeDryRunSummary } from '../../src/platform/plan/artifacts';
import { Scenario } from '../../src/prd/types';

const sourceRef = {
  document_id: 'DOC-0001',
  file_path: '采购/01-采购订单.md',
  section: '1.1',
  excerpt: '保存后单据状态为未审核',
};

function scenario(id: string, steps: string[]): Scenario {
  return {
    id,
    object_type: 'Scenario',
    name: id,
    module: 'purchase',
    status: 'ACTIVE',
    schema_version: '1.0.0',
    source_refs: [sourceRef],
    created_by_parser_version: '1.0.0',
    updated_at: '2026-11-08T00:00:00.000Z',
    title: `场景 ${id}`,
    test_objective: '验证单据保存',
    scenario_type: 'FUNCTIONAL',
    automation_feasibility: 'AUTOMATABLE',
    business_object: '采购订单',
    preconditions: [],
    data_requirements: ['字段 数量(qty)'],
    steps,
    assertions: [{ type: 'record_status', target: '单据状态', expected: '未审核' }],
    expected_result: '单据保存成功',
    evidence_requirements: [],
    rule_ids: [],
    document_ids: ['DOC-0001'],
    case_ids: [],
    review_required: false,
    origin: 'GENERATED',
  };
}

function withDependency(result: CompileResult, index: number, dependsOn: string): CompileResult {
  const testcases: PlatformTestCase[] = result.testcases.map((testCase, position) =>
    position === index ? { ...testCase, dependencies: [{ case_id: dependsOn, required: true }] } : testCase,
  );
  return { ...result, testcases };
}

test.describe('执行计划与推演', () => {
  test('按依赖拓扑排序生成执行计划', () => {
    const result = compileScenarios([scenario('A', ['进入采购订单', '保存']), scenario('B', ['进入采购订单'])], {
      moduleId: 'purchase',
    });
    const dependent = withDependency(result, 1, result.testcases[0].id);
    const { plan, dag } = buildExecutionPlan(dependent, { moduleId: 'purchase', planId: 'PLAN-TEST' });
    expect(dag.acyclic).toBe(true);
    expect(plan.steps.map((step) => step.case_id)).toEqual([result.testcases[0].id, result.testcases[1].id]);
    expect(plan.steps[1].depends_on).toEqual([result.testcases[0].id]);
    expect(plan.steps.map((step) => step.order)).toEqual([1, 2]);
  });

  test('缺少依赖用例时拒绝生成计划', () => {
    const result = compileScenarios([scenario('A', ['进入采购订单'])], { moduleId: 'purchase' });
    const dependent = withDependency(result, 0, 'TC-NOT-EXIST');
    expect(() => buildExecutionPlan(dependent, { moduleId: 'purchase' })).toThrow(/PLAN_DAG_INVALID/);
  });

  test('零用例模块拒绝生成空计划', () => {
    const empty = compileScenarios([], { moduleId: 'purchase' });
    expect(() => buildExecutionPlan(empty, { moduleId: 'purchase' })).toThrow(/PLAN_EMPTY/);
  });

  test('写操作未批准时推演被审批闸门拦截', () => {
    const result = compileScenarios([scenario('A', ['进入采购订单', '保存'])], { moduleId: 'purchase' });
    const { plan } = buildExecutionPlan(result, { moduleId: 'purchase' });
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-plan-'));
    const contracts = validateCompiledArtifacts(directory);
    expect(contracts.valid).toBe(false);
    const summary = buildDryRunSummary(
      { moduleId: 'purchase', compiled: result, dag: { order: [], missing: [], cycles: [], acyclic: true }, plan, outputDir: directory },
      { valid: true, directory, checked: {}, issues: [] },
    );
    expect(summary.authorization_required_actions).toContain('save');
    expect(summary.approval_gate.required).toBe(true);
    expect(summary.approval_gate.executable).toBe(false);
    const file = writeDryRunSummary(directory, summary);
    expect(JSON.parse(fs.readFileSync(file, 'utf8')).mode).toBe('DRY_RUN');
    fs.rmSync(directory, { recursive: true, force: true });
  });
});
