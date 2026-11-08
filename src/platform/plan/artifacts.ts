import fs from 'node:fs';
import path from 'node:path';
import { ContractSchemaName, validateData } from '../contracts/validator';
import { ModulePlanResult, PlatformExecutionPlan } from './module-plan';
import { PlatformScenario, PlatformTestCase, PlatformTestSuite } from './compile';

export interface ArtifactIssue {
  artifact: string;
  target: string;
  message: string;
}

export interface ArtifactValidation {
  valid: boolean;
  directory: string;
  checked: Record<string, number>;
  issues: ArtifactIssue[];
}

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as T;
}

function checkList<T>(
  directory: string,
  file: string,
  schema: ContractSchemaName,
  label: string,
  issues: ArtifactIssue[],
): number {
  const target = path.join(directory, file);
  if (!fs.existsSync(target)) {
    issues.push({ artifact: file, target, message: `缺少产物: ${file}` });
    return 0;
  }
  const items = readJson<T[]>(target);
  let checked = 0;
  items.forEach((item, index) => {
    const result = validateData(schema, item, { target: `${target}#${index}` });
    checked += 1;
    for (const issue of result.issues) {
      issues.push({ artifact: file, target: `${label}[${index}]`, message: `${issue.path} ${issue.message}` });
    }
  });
  return checked;
}

function checkSingle(
  directory: string,
  file: string,
  schema: ContractSchemaName,
  issues: ArtifactIssue[],
): boolean {
  const target = path.join(directory, file);
  if (!fs.existsSync(target)) {
    issues.push({ artifact: file, target, message: `缺少产物: ${file}` });
    return false;
  }
  const result = validateData(schema, readJson(target), { target });
  for (const issue of result.issues) {
    issues.push({ artifact: file, target, message: `${issue.path} ${issue.message}` });
  }
  return result.valid;
}

export function validateCompiledArtifacts(directory: string): ArtifactValidation {
  const issues: ArtifactIssue[] = [];
  const checked: Record<string, number> = {};
  checked.scenarios = checkList<PlatformScenario>(directory, 'scenarios.json', 'scenario', 'scenario', issues);
  checked.testcases = checkList<PlatformTestCase>(directory, 'testcases.json', 'test-case', 'testcase', issues);
  checked.suites = checkSingle(directory, 'test-suite.json', 'test-suite', issues) ? 1 : 0;
  checked.plans = checkSingle(directory, 'execution-plan.json', 'execution-plan', issues) ? 1 : 0;
  return { valid: issues.length === 0, directory, checked, issues };
}

export interface DryRunSummary {
  schema_version: '1.0';
  mode: 'DRY_RUN';
  readonly: true;
  generated_at: string;
  module_id: string;
  plan_id: string;
  suite_id: string;
  cases: {
    total: number;
    by_status: Record<string, number>;
    by_risk: Record<string, number>;
  };
  actions: Record<string, number>;
  authorization_required_actions: string[];
  approval_gate: {
    required: boolean;
    executable: boolean;
    approved_cases: number;
    reason: string;
  };
  contracts: ArtifactValidation;
}

const WRITE_ACTIONS = new Set(['upload', 'save', 'submit', 'approve', 'unapprove', 'delete']);

function countInto(target: Record<string, number>, key: string): void {
  target[key] = (target[key] ?? 0) + 1;
}

export function buildDryRunSummary(result: ModulePlanResult, contracts: ArtifactValidation): DryRunSummary {
  const byStatus: Record<string, number> = {};
  const byRisk: Record<string, number> = {};
  const actions: Record<string, number> = {};
  const approvalActions = new Set<string>();
  for (const scenario of result.compiled.scenarios) countInto(byRisk, scenario.risk_level);
  for (const testCase of result.compiled.testcases) {
    countInto(byStatus, testCase.status);
    for (const step of testCase.steps) {
      countInto(actions, step.action);
      if (WRITE_ACTIONS.has(step.action)) approvalActions.add(step.action);
    }
  }
  const approvedCases = result.compiled.testcases.filter((testCase) => testCase.status === 'approved').length;
  const total = result.compiled.testcases.length;
  const required = approvalActions.size > 0;
  const executable = contracts.valid && total > 0 && (!required || approvedCases === total);
  return {
    schema_version: '1.0',
    mode: 'DRY_RUN',
    readonly: true,
    generated_at: new Date().toISOString(),
    module_id: result.moduleId,
    plan_id: result.plan.plan_id,
    suite_id: result.compiled.suite.id,
    cases: { total, by_status: byStatus, by_risk: byRisk },
    actions,
    authorization_required_actions: [...approvalActions].sort(),
    approval_gate: {
      required,
      executable,
      approved_cases: approvedCases,
      reason: executable
        ? '计划与契约校验通过'
        : `未满足执行门槛：契约 ${contracts.valid ? '通过' : '失败'}，已批准用例 ${approvedCases}/${total}`,
    },
    contracts,
  };
}

export function writeDryRunSummary(directory: string, summary: DryRunSummary): string {
  const target = path.join(directory, 'dry-run.json');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(target, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  return target;
}

export function loadExecutionPlan(directory: string): PlatformExecutionPlan {
  return readJson<PlatformExecutionPlan>(path.join(directory, 'execution-plan.json'));
}

export function loadSuite(directory: string): PlatformTestSuite {
  return readJson<PlatformTestSuite>(path.join(directory, 'test-suite.json'));
}
