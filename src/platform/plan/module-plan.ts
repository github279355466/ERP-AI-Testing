import fs from 'node:fs';
import path from 'node:path';
import { Scenario as PrdScenario } from '../../prd/types';
import { analyzeDag, DagAnalysis, DagNode } from './dag';
import { compileScenarios, CompileResult, PlatformTestCase } from './compile';

export interface ModulePlanOptions {
  repoRoot?: string;
  moduleId: string;
  version?: string;
  maxCases?: number;
  outputDir?: string;
}

export interface ExecutionPlanStep {
  order: number;
  case_id: string;
  depends_on: string[];
}

export interface PlatformExecutionPlan {
  schema_version: '1.0';
  plan_id: string;
  suite_id: string;
  platform_version: string;
  module_packs: Array<{ module_id: string; version: string }>;
  steps: ExecutionPlanStep[];
  dry_run: boolean;
  created_at: string;
}

export interface ModulePlanResult {
  moduleId: string;
  compiled: CompileResult;
  dag: DagAnalysis;
  plan: PlatformExecutionPlan;
  outputDir: string;
}

export const PLATFORM_VERSION = '1.0.0';

export function knowledgeDir(repoRoot: string, moduleId: string): string {
  return path.join(repoRoot, 'artifacts', 'modules', moduleId, 'knowledge');
}

export function loadKnowledgeScenarios(repoRoot: string, moduleId: string): PrdScenario[] {
  const file = path.join(knowledgeDir(repoRoot, moduleId), 'scenarios.json');
  if (!fs.existsSync(file)) {
    throw new Error(`未找到场景知识: ${file}，请先运行 npm run platform:prd:scan -- --module ${moduleId}`);
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as PrdScenario[];
}

function toDagNodes(cases: PlatformTestCase[]): DagNode[] {
  return cases.map((testCase) => ({
    id: testCase.id,
    depends_on: testCase.dependencies.map((dependency) => dependency.case_id),
  }));
}

export function buildExecutionPlan(
  compiled: CompileResult,
  options: { planId?: string; moduleId: string; version?: string; dryRun?: boolean; createdAt?: string } = {
    moduleId: 'unknown',
  },
): { plan: PlatformExecutionPlan; dag: DagAnalysis } {
  if (compiled.testcases.length === 0) {
    throw new Error(`[PLAN_EMPTY] 模块 ${options.moduleId} 没有可执行用例，请先检查场景知识或 source-index include_paths`);
  }
  const dag = analyzeDag(toDagNodes(compiled.testcases));
  if (dag.cycles.length > 0 || dag.missing.length > 0) {
    throw new Error(
      `[PLAN_DAG_INVALID] cycles=${JSON.stringify(dag.cycles)} missing=${JSON.stringify(dag.missing)}`,
    );
  }
  const byId = new Map(compiled.testcases.map((testCase) => [testCase.id, testCase]));
  const plan: PlatformExecutionPlan = {
    schema_version: '1.0',
    plan_id: options.planId ?? `PLAN-${options.moduleId.toUpperCase()}-${Date.now()}`,
    suite_id: compiled.suite.id,
    platform_version: PLATFORM_VERSION,
    module_packs: [{ module_id: options.moduleId, version: options.version ?? '0.1.0' }],
    steps: dag.order.map((id, index) => ({
      order: index + 1,
      case_id: id,
      depends_on: byId.get(id)?.dependencies.map((dependency) => dependency.case_id) ?? [],
    })),
    dry_run: options.dryRun ?? true,
    created_at: options.createdAt ?? new Date().toISOString(),
  };
  return { plan, dag };
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function compileModulePlan(options: ModulePlanOptions): ModulePlanResult {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const scenarios = loadKnowledgeScenarios(repoRoot, options.moduleId);
  const compiled = compileScenarios(scenarios, {
    moduleId: options.moduleId,
    version: options.version,
    maxCases: options.maxCases,
  });
  const { plan, dag } = buildExecutionPlan(compiled, {
    moduleId: options.moduleId,
    version: options.version,
  });
  const outputDir = options.outputDir
    ? path.resolve(repoRoot, options.outputDir)
    : path.join(repoRoot, 'artifacts', 'modules', options.moduleId, 'compiled');
  writeJson(path.join(outputDir, 'scenarios.json'), compiled.scenarios);
  writeJson(path.join(outputDir, 'testcases.json'), compiled.testcases);
  writeJson(path.join(outputDir, 'test-suite.json'), compiled.suite);
  writeJson(path.join(outputDir, 'execution-plan.json'), plan);
  writeJson(path.join(outputDir, 'compile-summary.json'), {
    module_id: options.moduleId,
    scenarios: compiled.scenarios.length,
    testcases: compiled.testcases.length,
    skipped: compiled.skipped,
    dag,
    plan_id: plan.plan_id,
  });
  return { moduleId: options.moduleId, compiled, dag, plan, outputDir };
}

export function loadCompiledPlan(repoRoot: string, moduleId: string, outputDir?: string): ModulePlanResult {
  const directory = outputDir
    ? path.resolve(repoRoot, outputDir)
    : path.join(repoRoot, 'artifacts', 'modules', moduleId, 'compiled');
  const read = <T>(name: string): T => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8')) as T;
  const compiled: CompileResult = {
    scenarios: read('scenarios.json'),
    testcases: read('testcases.json'),
    suite: read('test-suite.json'),
    skipped: [],
  };
  const plan = read<PlatformExecutionPlan>('execution-plan.json');
  const dag = analyzeDag(toDagNodes(compiled.testcases));
  return { moduleId, compiled, dag, plan, outputDir: directory };
}
