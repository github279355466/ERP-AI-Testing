import fs from 'node:fs';
import path from 'node:path';
import { loadCompiledPlan, PLATFORM_VERSION } from '../platform/plan/module-plan';
import { PlatformTestCase } from '../platform/plan/compile';
import { CaseRunner, CaseRunOutput, ReportAssertion, runSchedule } from '../platform/execution/scheduler';
import { buildExecutionReport, validateReport, writeReports } from '../platform/report/engine';

interface Args {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = 'help', ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return { command, args };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Athena Execution/Report Engine',
      '',
      '用法：',
      '  node dist/cli/platform-run.js simulate --module purchase [--limit 20] [--fail-at 5] [--concurrency 1]',
      '',
      '说明：simulate 使用占位执行器验证调度/断言/报告链路，不启动浏览器、不访问 ERP。',
      '真实 UI 执行由平台运行器在显式授权后调用。',
    ].join('\n') + '\n',
  );
}

function simulatedRunner(failAt: number): CaseRunner {
  let index = 0;
  return {
    async run(testCase: PlatformTestCase): Promise<CaseRunOutput> {
      index += 1;
      const shouldFail = failAt > 0 && index === failAt;
      const steps = testCase.steps.map((step, position) => ({
        action: step.action,
        status: shouldFail && position === testCase.steps.length - 1 ? ('failed' as const) : ('passed' as const),
        detail: step.target,
      }));
      const assertions: ReportAssertion[] = testCase.assertions.map((assertion, position) => ({
        name: `${assertion.type}:${assertion.target}`,
        level: assertion.level,
        expected: assertion.expected,
        actual: shouldFail && position === 0 ? '<simulated-mismatch>' : assertion.expected,
        passed: !(shouldFail && position === 0),
        source_ref: assertion.source_ref,
      }));
      return {
        status: shouldFail ? 'failed' : 'passed',
        steps,
        assertions,
        evidence: [],
        ...(shouldFail ? { failure_category: 'assertion' as const, error_code: 'ASSERT_VALUE_FAILED', error_message: '模拟断言失败' } : {}),
      };
    },
  };
}

async function main(): Promise<number> {
  const { command, args } = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  const moduleId = typeof args.module === 'string' ? args.module : '';
  if (!moduleId) {
    process.stderr.write('必须提供 --module <id>\n');
    return 1;
  }

  if (command === 'simulate') {
    const limit = typeof args.limit === 'string' ? Number(args.limit) : 10;
    const failAt = typeof args['fail-at'] === 'string' ? Number(args['fail-at']) : 0;
    const concurrency = typeof args.concurrency === 'string' ? Number(args.concurrency) : 1;
    const loaded = loadCompiledPlan(root, moduleId);
    const cases = loaded.compiled.testcases.slice(0, limit);
    const plan = {
      ...loaded.plan,
      steps: loaded.plan.steps.filter((step) => cases.some((testCase) => testCase.id === step.case_id)).slice(0, cases.length),
    };
    const startedAt = new Date();
    const result = await runSchedule(plan, { runner: simulatedRunner(failAt), cases, concurrency });
    const finishedAt = new Date();
    const runId = `SIM-${startedAt.toISOString().replace(/[-:.]/g, '').slice(0, 15)}`;
    const report = buildExecutionReport({
      runId,
      platformVersion: PLATFORM_VERSION,
      modulePacks: [{ module_id: moduleId, version: '0.1.0' }],
      environment: { name: 'simulate', type: 'test', tenant_id: 'UNKNOWN' },
      operator: process.env.ATHENA_OPERATOR ?? 'simulated',
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      outcomes: result.outcomes,
    });
    const validation = validateReport(report);
    const files = writeReports(path.join(root, 'artifacts', runId), report);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'SIMULATE',
          command,
          success: validation.valid && report.outcome === 'passed',
          run_id: runId,
          outcome: report.outcome,
          cases: { total: report.cases.length, passed: report.cases.filter((entry) => entry.status === 'passed').length },
          failures: report.cases.filter((entry) => entry.status !== 'passed').map((entry) => entry.case_id),
          report_validation: validation,
          files,
        },
        null,
        2,
      )}\n`,
    );
    return validation.valid ? 0 : 2;
  }

  process.stderr.write(`未知命令: ${command}\n`);
  printHelp();
  return 1;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
