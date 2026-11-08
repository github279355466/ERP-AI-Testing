import { PlatformAssertion } from '../plan/compile';

export interface AssertionProbeResult {
  actual: string;
  evidence?: string;
  error?: string;
}

export interface AssertionProbe {
  read(assertion: PlatformAssertion): Promise<AssertionProbeResult>;
}

export interface AssertionResult {
  name: string;
  level: PlatformAssertion['level'];
  expected: string;
  actual: string;
  passed: boolean;
  source_ref: PlatformAssertion['source_ref'];
  type: PlatformAssertion['type'];
  evidence?: string;
  error?: string;
}

export interface AssertionEvaluation {
  results: AssertionResult[];
  passed: boolean;
  failures: AssertionResult[];
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

export function matchExpected(type: PlatformAssertion['type'], expected: string, actual: string): boolean {
  const left = normalize(actual);
  const right = normalize(expected);
  if (right === '') return left !== '';
  if (type === 'count' || type === 'row') {
    const expectedNumber = Number(right.replace(/[^\d.-]/g, ''));
    const actualNumber = Number(left.replace(/[^\d.-]/g, ''));
    if (Number.isFinite(expectedNumber) && Number.isFinite(actualNumber)) return expectedNumber === actualNumber;
  }
  if (type === 'visible') {
    const truthy = /^(true|1|yes|visible|是)$/i.test(left);
    const wanted = /^(true|1|yes|visible|是)$/i.test(right);
    return truthy === wanted;
  }
  return left.includes(right);
}

export async function evaluateAssertions(assertions: PlatformAssertion[], probe: AssertionProbe): Promise<AssertionEvaluation> {
  const results: AssertionResult[] = [];
  for (const assertion of assertions) {
    let actual = '';
    let evidence: string | undefined;
    let error: string | undefined;
    try {
      const outcome = await probe.read(assertion);
      actual = outcome.actual;
      evidence = outcome.evidence;
      error = outcome.error;
    } catch (caught) {
      error = caught instanceof Error ? caught.message : String(caught);
    }
    const passed = error === undefined && matchExpected(assertion.type, assertion.expected, actual);
    results.push({
      name: `${assertion.type}:${assertion.target}`,
      level: assertion.level,
      expected: assertion.expected,
      actual,
      passed,
      source_ref: assertion.source_ref,
      type: assertion.type,
      ...(evidence ? { evidence } : {}),
      ...(error ? { error } : {}),
    });
  }
  const failures = results.filter((result) => !result.passed);
  return { results, passed: failures.length === 0, failures };
}
