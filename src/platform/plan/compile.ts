import { createHash } from 'node:crypto';
import { Scenario as PrdScenario, SourceRef as PrdSourceRef } from '../../prd/types';

export interface PlatformSourceRef {
  document_id: string;
  file_path: string;
  source_type: 'PRD_EXPLICIT' | 'PRD_DERIVED' | 'PLATFORM_SERVICE' | 'UI_OBSERVED' | 'USER_CONFIRMED' | 'PENDING';
  section?: string;
  line_start?: number;
  line_end?: number;
  excerpt?: string;
}

export interface PlatformScenario {
  schema_version: '1.0';
  id: string;
  module_id: string;
  title: string;
  business_goal: string;
  source_refs: PlatformSourceRef[];
  preconditions: string[];
  business_flow: string[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  status: 'draft' | 'reviewed' | 'approved' | 'deprecated';
  tags: string[];
}

export interface PlatformStep {
  action:
    | 'navigate'
    | 'search'
    | 'open_record'
    | 'select_master_data'
    | 'fill'
    | 'select_option'
    | 'upload'
    | 'save'
    | 'submit'
    | 'approve'
    | 'unapprove'
    | 'delete'
    | 'assert_visible'
    | 'assert_text'
    | 'assert_value'
    | 'assert_row'
    | 'capture_evidence';
  target: string;
  value?: string;
  timeout_ms?: number;
  evidence?: boolean;
}

export interface PlatformAssertion {
  type: 'visible' | 'text' | 'value' | 'row' | 'count' | 'status' | 'document_no' | 'summary_value' | 'relation';
  target: string;
  expected: string;
  level: 'ui' | 'business' | 'persistence';
  source_ref: PlatformSourceRef;
}

export interface PlatformTestCase {
  schema_version: '1.0';
  id: string;
  module_id: string;
  version: string;
  title: string;
  objective: string;
  scenario_refs: string[];
  source_refs: PlatformSourceRef[];
  preconditions: string[];
  data_recipe_refs: string[];
  dependencies: Array<{ case_id: string; required: boolean; reason?: string }>;
  steps: PlatformStep[];
  assertions: PlatformAssertion[];
  cleanup_policy: 'keep' | 'delete_after_run' | 'mark_for_cleanup' | 'manual';
  status: 'draft' | 'reviewed' | 'approved' | 'deprecated';
  timeout_ms: number;
  retry_policy: { max_attempts: number; retry_safe_actions_only: boolean };
}

export interface PlatformTestSuite {
  schema_version: '1.0';
  id: string;
  module_id: string;
  name: string;
  version: string;
  status: 'draft' | 'reviewed' | 'approved' | 'deprecated';
  case_ids: string[];
  execution_order: string[];
  tags: string[];
}

export interface CompileResult {
  scenarios: PlatformScenario[];
  testcases: PlatformTestCase[];
  suite: PlatformTestSuite;
  skipped: Array<{ scenario_id: string; reason: string }>;
}

export interface CompileOptions {
  moduleId: string;
  version?: string;
  maxCases?: number;
}

function hash(value: string): string {
  return createHash('sha256').update(value).digest('hex').slice(0, 10).toUpperCase();
}

function toSourceRef(source: PrdSourceRef): PlatformSourceRef {
  return {
    document_id: source.document_id,
    file_path: source.file_path,
    source_type: 'PRD_DERIVED',
    ...(source.section ? { section: source.section } : {}),
    ...(source.line_start ? { line_start: source.line_start } : {}),
    ...(source.line_end ? { line_end: source.line_end } : {}),
    ...(source.excerpt ? { excerpt: source.excerpt } : {}),
  };
}

function riskOf(scenario: PrdScenario): PlatformScenario['risk_level'] {
  const text = `${scenario.scenario_type} ${scenario.title} ${scenario.test_objective}`;
  if (/状态|审核|撤审|作废|上下游|取单|回写|权限|唯一/.test(text)) return 'high';
  if (/只读|隐藏|默认值|禁用/.test(text)) return 'low';
  return 'medium';
}

function fieldTarget(scenario: PrdScenario): string {
  const value = scenario.data_requirements[0] ?? scenario.business_object ?? scenario.name;
  const match = /字段\s+(.+?)\(([^)]+)\)/.exec(value);
  return (match?.[2] ?? match?.[1] ?? scenario.business_object ?? scenario.name ?? 'page').trim() || 'page';
}

function toSteps(scenario: PrdScenario): PlatformStep[] {
  const target = fieldTarget(scenario);
  const steps: PlatformStep[] = scenario.steps.map((text) => {
    if (/进入|打开|查询/.test(text)) return { action: 'navigate', target: scenario.business_object ?? scenario.name, timeout_ms: 30_000 };
    if (/开窗|选择/.test(text)) return { action: 'select_master_data', target };
    if (/清空|输入|录入|填写|修改/.test(text)) return { action: 'fill', target, value: scenario.expected_result };
    if (/保存/.test(text)) return { action: 'save', target: '保存' };
    if (/撤审|反审核/.test(text)) return { action: 'unapprove', target: '撤审' };
    if (/审核/.test(text)) return { action: 'approve', target: '审核' };
    if (/读取|观察|核对|比对|判断|记录/.test(text)) return { action: 'assert_value', target };
    return { action: 'assert_visible', target };
  });
  if (steps.length === 0) steps.push({ action: 'navigate', target: scenario.business_object ?? scenario.name, timeout_ms: 30_000 });
  return steps;
}

function assertionType(type: string): PlatformAssertion['type'] {
  if (/error_message/.test(type)) return 'text';
  if (/record_status/.test(type)) return 'status';
  if (/business|relation/.test(type)) return 'relation';
  if (/ui_state|data_value|window_data/.test(type)) return 'value';
  return 'text';
}

function toAssertions(scenario: PrdScenario, source: PlatformSourceRef): PlatformAssertion[] {
  const assertions = scenario.assertions.map((assertion) => ({
    type: assertionType(assertion.type),
    target: assertion.target || fieldTarget(scenario),
    expected: assertion.expected || scenario.expected_result || '',
    level: /record_status|business|relation/.test(assertion.type) ? ('business' as const) : ('ui' as const),
    source_ref: source,
  }));
  if (assertions.length === 0) {
    assertions.push({
      type: 'value',
      target: fieldTarget(scenario),
      expected: scenario.expected_result || scenario.test_objective,
      level: 'ui',
      source_ref: source,
    });
  }
  return assertions;
}

export function compileScenarios(input: PrdScenario[], options: CompileOptions): CompileResult {
  const version = options.version ?? '0.1.0';
  const maxCases = options.maxCases ?? 2_000;
  const scenarios: PlatformScenario[] = [];
  const testcases: PlatformTestCase[] = [];
  const skipped: CompileResult['skipped'] = [];
  for (const source of input) {
    if (scenarios.length >= maxCases) break;
    const refs = source.source_refs.map(toSourceRef);
    if (refs.length === 0) {
      skipped.push({ scenario_id: source.id, reason: '缺少来源引用' });
      continue;
    }
    const id = `SCN-${options.moduleId.toUpperCase()}-${hash(source.id)}`;
    const scenario: PlatformScenario = {
      schema_version: '1.0',
      id,
      module_id: options.moduleId,
      title: source.title,
      business_goal: source.test_objective,
      source_refs: refs,
      preconditions: source.preconditions,
      business_flow: source.steps.length > 0 ? source.steps : [source.test_objective || source.title],
      risk_level: riskOf(source),
      status: 'draft',
      tags: [
        options.moduleId,
        source.scenario_type,
        `feasibility:${source.automation_feasibility}`,
        `origin:${source.origin}`,
      ],
    };
    scenarios.push(scenario);
    testcases.push({
      schema_version: '1.0',
      id: `TC-${options.moduleId.toUpperCase()}-${hash(source.id)}`,
      module_id: options.moduleId,
      version,
      title: source.title,
      objective: source.test_objective,
      scenario_refs: [id],
      source_refs: refs,
      preconditions: source.preconditions,
      data_recipe_refs: [],
      dependencies: [],
      steps: toSteps(source),
      assertions: toAssertions(source, refs[0]),
      cleanup_policy: 'keep',
      status: 'draft',
      timeout_ms: 120_000,
      retry_policy: { max_attempts: 1, retry_safe_actions_only: true },
    });
  }
  return {
    scenarios,
    testcases,
    suite: {
      schema_version: '1.0',
      id: `SUITE-${options.moduleId.toUpperCase()}-GENERATED`,
      module_id: options.moduleId,
      name: `${options.moduleId} 生成用例集`,
      version,
      status: 'draft',
      case_ids: testcases.map((testCase) => testCase.id),
      execution_order: testcases.map((testCase) => testCase.id),
      tags: ['generated', 'draft'],
    },
    skipped,
  };
}

export interface CompileValidationIssue {
  code: string;
  target: string;
  message: string;
}

export function validateCompiled(result: Pick<CompileResult, 'scenarios' | 'testcases' | 'suite'>): CompileValidationIssue[] {
  const issues: CompileValidationIssue[] = [];
  const scenarioIds = new Set(result.scenarios.map((scenario) => scenario.id));
  const cases = new Map(result.testcases.map((testCase) => [testCase.id, testCase]));
  for (const testCase of result.testcases) {
    if (testCase.source_refs.length === 0) {
      issues.push({ code: 'CASE_SOURCE_MISSING', target: testCase.id, message: '用例缺少来源引用' });
    }
    if (testCase.scenario_refs.length === 0 || testCase.scenario_refs.some((id) => !scenarioIds.has(id))) {
      issues.push({ code: 'CASE_SCENARIO_MISSING', target: testCase.id, message: '用例引用的场景不存在' });
    }
    if (testCase.steps.length === 0) {
      issues.push({ code: 'CASE_STEPS_MISSING', target: testCase.id, message: '用例缺少步骤' });
    }
    if (testCase.assertions.length === 0) {
      issues.push({ code: 'CASE_ASSERTIONS_MISSING', target: testCase.id, message: '用例缺少断言' });
    }
    for (const dependency of testCase.dependencies) {
      if (!cases.has(dependency.case_id) && dependency.required) {
        issues.push({ code: 'CASE_DEPENDENCY_MISSING', target: testCase.id, message: `缺少依赖用例 ${dependency.case_id}` });
      }
    }
  }
  for (const id of result.suite.case_ids) {
    if (!cases.has(id)) issues.push({ code: 'SUITE_CASE_MISSING', target: result.suite.id, message: `套件引用的用例不存在: ${id}` });
  }
  if (result.suite.status === 'approved') {
    for (const id of result.suite.case_ids) {
      if ((cases.get(id)?.status ?? 'draft') !== 'approved') {
        issues.push({ code: 'SUITE_HAS_UNAPPROVED_CASE', target: result.suite.id, message: `已批准套件包含未批准用例: ${id}` });
      }
    }
  }
  return issues;
}
