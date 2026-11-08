import fs from 'node:fs';
import path from 'node:path';
import { PlatformExecutionPlan } from '../plan/module-plan';
import { PlatformAssertion, PlatformStep, PlatformTestCase } from '../plan/compile';
import { NodeStatus } from '../plan/dag';

export type RunStatus = NodeStatus;

export type FailureCategory =
  | 'none'
  | 'environment'
  | 'data_preparation'
  | 'step'
  | 'assertion'
  | 'platform'
  | 'manual';

export interface ReportStep {
  action: string;
  status: RunStatus;
  detail?: string;
}

export interface ReportAssertion {
  name: string;
  level: PlatformAssertion['level'];
  expected: string;
  actual: string;
  passed: boolean;
  source_ref: PlatformAssertion['source_ref'];
}

export interface CaseRunOutput {
  status: RunStatus;
  steps: ReportStep[];
  assertions: ReportAssertion[];
  evidence: string[];
  failure_category?: FailureCategory;
  error_code?: string;
  error_message?: string;
  created_documents?: Array<{ document_type: string; identifier: string }>;
  data_recipe_refs?: string[];
  cleanup?: { status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'not_run'; notes: string };
}

export interface CaseRunner {
  run(testCase: PlatformTestCase, context: { signal: AbortSignal; attempt: number }): Promise<CaseRunOutput>;
}

export interface CaseOutcome extends CaseRunOutput {
  case_id: string;
  duration_ms: number;
  attempts: number;
}

export interface SchedulerOptions {
  runner: CaseRunner;
  cases: PlatformTestCase[];
  concurrency?: number;
  failurePolicy?: 'block_downstream' | 'skip_downstream' | 'continue';
  signal?: AbortSignal;
  now?: () => number;
  actionRegistryPath?: string;
}

export interface ScheduleResult {
  outcomes: CaseOutcome[];
  cancelled: boolean;
}

let registryCache: Map<string, boolean> | null = null;

export function loadRetrySafety(actionRegistryPath = path.resolve(process.cwd(), 'platform/contracts/action-registry.json')): Map<string, boolean> {
  if (registryCache) return registryCache;
  const data = JSON.parse(fs.readFileSync(actionRegistryPath, 'utf8')) as { actions: Array<{ type: string; retry_safe: boolean; idempotent: boolean }> };
  registryCache = new Map(data.actions.map((action) => [action.type, action.retry_safe && action.idempotent]));
  return registryCache;
}

export function isRetrySafe(action: string, registry = loadRetrySafety()): boolean {
  return registry.get(action) ?? false;
}

export function retryEligible(testCase: PlatformTestCase, registry = loadRetrySafety()): boolean {
  if (testCase.retry_policy.max_attempts <= 1) return false;
  if (!testCase.retry_policy.retry_safe_actions_only) return false;
  const actions: string[] = testCase.steps.map((step: PlatformStep) => step.action);
  return actions.every((action) => isRetrySafe(action, registry));
}

export function classifyFailure(errorCode: string): FailureCategory {
  if (errorCode === 'CANCELLED' || errorCode === 'TIMEOUT') return errorCode === 'TIMEOUT' ? 'step' : 'none';
  if (/^(ENVIRONMENT|SESSION|HOST|AUTH)_/.test(errorCode)) return 'environment';
  if (/^(RECIPE|DATA)_/.test(errorCode)) return 'data_preparation';
  if (/^ASSERT_/.test(errorCode)) return 'assertion';
  if (/^(LOCATOR|PAGE|LOOKUP|CONTROL|DROPDOWN|INPUT|GRID)_/.test(errorCode)) return 'step';
  return 'platform';
}

function cancelledOutput(): CaseRunOutput {
  return { status: 'cancelled', steps: [], assertions: [], evidence: [], failure_category: 'none', error_code: 'CANCELLED' };
}

function blockedOutput(reason: string, status: RunStatus): CaseRunOutput {
  return { status, steps: [], assertions: [], evidence: [], failure_category: 'manual', error_code: 'DEPENDENCY_NOT_PASSED', error_message: reason };
}

async function runWithTimeout(
  testCase: PlatformTestCase,
  runner: CaseRunner,
  attempt: number,
  timeoutMs: number,
  cancel?: AbortSignal,
): Promise<CaseRunOutput> {
  const controller = new AbortController();
  const abort = (): void => controller.abort();
  cancel?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await Promise.race([
      runner.run(testCase, { signal: controller.signal, attempt }),
      new Promise<CaseRunOutput>((resolve) => {
        controller.signal.addEventListener(
          'abort',
          () =>
            resolve({
              status: cancel?.aborted ? 'cancelled' : 'failed',
              steps: [],
              assertions: [],
              evidence: [],
              failure_category: cancel?.aborted ? 'none' : 'step',
              error_code: cancel?.aborted ? 'CANCELLED' : 'TIMEOUT',
              error_message: `用例超时 ${timeoutMs}ms`,
            }),
          { once: true },
        );
      }),
    ]);
  } finally {
    clearTimeout(timer);
    cancel?.removeEventListener('abort', abort);
  }
}

export async function runSchedule(plan: PlatformExecutionPlan, options: SchedulerOptions): Promise<ScheduleResult> {
  const concurrency = Math.max(1, options.concurrency ?? 1);
  const policy = options.failurePolicy ?? 'block_downstream';
  const now = options.now ?? (() => Date.now());
  const registry = loadRetrySafety(options.actionRegistryPath);
  const byId = new Map(options.cases.map((testCase) => [testCase.id, testCase]));
  const pending = new Map(plan.steps.map((step) => [step.case_id, step]));
  const outcomes: CaseOutcome[] = [];
  const statusById = new Map<string, RunStatus>();
  let cancelled = false;

  while (pending.size > 0) {
    if (options.signal?.aborted) {
      cancelled = true;
      for (const [caseId] of pending) {
        outcomes.push({ ...cancelledOutput(), case_id: caseId, duration_ms: 0, attempts: 0 });
        statusById.set(caseId, 'cancelled');
      }
      pending.clear();
      break;
    }
    const ready = [...pending.values()].filter((step) => step.depends_on.every((dependency) => statusById.has(dependency)));
    if (ready.length === 0) {
      for (const [caseId] of pending) {
        outcomes.push({ ...blockedOutput('依赖无法满足（可能存在环）', 'blocked'), case_id: caseId, duration_ms: 0, attempts: 0 });
        statusById.set(caseId, 'blocked');
      }
      pending.clear();
      break;
    }

    const batch = ready.slice(0, concurrency);
    const results = await Promise.all(
      batch.map(async (step): Promise<CaseOutcome> => {
        const testCase = byId.get(step.case_id);
        if (!testCase) {
          return { ...blockedOutput(`计划引用的用例不存在: ${step.case_id}`, 'blocked'), case_id: step.case_id, duration_ms: 0, attempts: 0 };
        }
        const blocking = step.depends_on.filter((dependency) => statusById.get(dependency) !== 'passed');
        if (blocking.length > 0 && policy !== 'continue') {
          const status: RunStatus = policy === 'skip_downstream' ? 'skipped' : 'blocked';
          return { ...blockedOutput(`上游未通过: ${blocking.join(', ')}`, status), case_id: step.case_id, duration_ms: 0, attempts: 0 };
        }

        const started = now();
        const maxAttempts = retryEligible(testCase, registry) ? testCase.retry_policy.max_attempts : 1;
        let output: CaseRunOutput = { status: 'error', steps: [], assertions: [], evidence: [], failure_category: 'platform', error_code: 'NO_ATTEMPT' };
        let attempts = 0;
        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
          attempts = attempt;
          try {
            output = await runWithTimeout(testCase, options.runner, attempt, testCase.timeout_ms, options.signal);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            const errorCode = /^\[([A-Z0-9_]+)\]/.exec(message)?.[1] ?? 'UNCLASSIFIED_ERROR';
            output = {
              status: 'error',
              steps: [],
              assertions: [],
              evidence: [],
              failure_category: classifyFailure(errorCode),
              error_code: errorCode,
              error_message: message,
            };
          }
          if (output.status === 'passed' || output.status === 'cancelled') break;
        }
        return { ...output, case_id: step.case_id, duration_ms: now() - started, attempts };
      }),
    );

    for (const outcome of results) {
      outcomes.push(outcome);
      statusById.set(outcome.case_id, outcome.status);
      pending.delete(outcome.case_id);
    }
  }

  return { outcomes, cancelled };
}
