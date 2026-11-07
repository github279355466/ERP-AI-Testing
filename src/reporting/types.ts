import { AssertionResult } from '../assertion/assertion-engine';

export type CaseStatus = 'passed' | 'failed' | 'blocked' | 'skipped';

export interface StepResult {
  action: string;
  expected: string;
  actual: string;
  status: 'ok' | 'fail' | 'blocked';
}

export interface CaseResult {
  id: string;
  name: string;
  status: CaseStatus;
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
  assertions: AssertionResult[];
  evidence: string[];
  error?: string | null;
  repro: string[];
}

export interface RunResult {
  runId: string;
  environment: string;
  tenant: string;
  startedAt: string;
  finishedAt: string;
  cases: CaseResult[];
  notes?: string[];
}

export function summarize(run: RunResult): Record<CaseStatus | 'total', number> {
  const counts = { total: run.cases.length, passed: 0, failed: 0, blocked: 0, skipped: 0 };
  for (const item of run.cases) counts[item.status] += 1;
  return counts;
}
