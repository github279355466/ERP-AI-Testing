import fs from 'node:fs';
import path from 'node:path';
import { loadCompiledPlan, PLATFORM_VERSION } from '../platform/plan/module-plan';
import { PlatformTestCase } from '../platform/plan/compile';
import { CaseRunner, CaseRunOutput, ReportAssertion, runSchedule } from '../platform/execution/scheduler';
import { buildExecutionReport, validateReport, writeReports } from '../platform/report/engine';
import { BrowserManager } from '../browser/browser-manager';
import { ContextManager } from '../browser/context-manager';
import { PageManager } from '../browser/page-manager';
import { SessionManager } from '../session/session-manager';
import { loadConfig } from '../config/athena-config';
import { createRunId, EvidenceManager } from '../evidence/evidence-manager';
import { PageMappingRegistry } from '../platform/pages/mapping';
import { loadModuleTestCases, requireTestCase } from '../platform/execution/case-loader';
import { requireTestSuite, resolveSuiteCases } from '../platform/execution/suite-loader';
import { BrowserCaseRunner } from '../platform/execution/browser-runner';
import { createRunManifestV2, validateRunManifestV2 } from '../platform/governance/run-manifest-v2';

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
      '  node dist/cli/platform-run.js cases --module purchase',
      '  node dist/cli/platform-run.js run --module purchase --case SMOKE-PURCHASE-ORDER-CREATE --allow-write',
      '  node dist/cli/platform-run.js run --module purchase --suite SUITE-PURCHASE-REGRESSION --allow-write',
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

  if (command === 'cases') {
    const loaded = loadModuleTestCases(root, moduleId);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'READ_ONLY',
          command,
          success: loaded.issues.length === 0,
          module_id: moduleId,
          directory: loaded.directory,
          cases: loaded.cases.map((entry) => ({ id: entry.id, title: entry.title, status: entry.status, steps: entry.steps.length })),
          issues: loaded.issues,
        },
        null,
        2,
      )}\n`,
    );
    return loaded.issues.length === 0 ? 0 : 2;
  }

  if (command === 'run') {
    const caseId = typeof args.case === 'string' ? args.case : '';
    const suiteId = typeof args.suite === 'string' ? args.suite : '';
    if (!caseId && !suiteId) {
      process.stderr.write('必须提供 --case <case-id> 或 --suite <suite-id>（可用 cases 命令查看用例）\n');
      return 1;
    }
    const allowWrite = args['allow-write'] === true;
    const runId = typeof args['run-id'] === 'string' ? args['run-id'] : createRunId();
    const operator = process.env.ATHENA_OPERATOR ?? 'athena-agent';
    const configPath = typeof args.config === 'string' ? args.config : 'config/athena.config.json';
    const config = loadConfig(configPath);
    if (allowWrite && !config.safety.allowWrite) {
      process.stderr.write(`运行配置 ${configPath} 未启用 safety.allowWrite，拒绝写用例\n`);
      return 1;
    }
    const testCase = caseId ? requireTestCase(root, moduleId, caseId) : null;
    let suiteCases: PlatformTestCase[] = testCase ? [testCase] : [];
    if (suiteId) {
      const suite = requireTestSuite(root, moduleId, suiteId);
      const loadedCases = loadModuleTestCases(root, moduleId);
      if (loadedCases.issues.length > 0) {
        process.stderr.write(
          `[CASE_CONTRACT_INVALID] ${loadedCases.issues.map((entry) => `${entry.file}: ${entry.messages.join('; ')}`).join(' | ')}\n`,
        );
        return 1;
      }
      suiteCases = resolveSuiteCases(suite, loadedCases.cases);
    }
    const mappings = PageMappingRegistry.load(root, moduleId);
    const browser = new BrowserManager(config);
    const session = await browser.connect();
    const contextManager = new ContextManager(session.context);
    const pages = new PageManager(session.context, config);
    const sessionManager = new SessionManager(config, contextManager, pages);
    const evidence = new EvidenceManager(config, runId);
    evidence.init();
    const runner = new BrowserCaseRunner({
      moduleId,
      config,
      pages,
      context: contextManager,
      session: sessionManager,
      mappings,
      evidence,
      allowWrite,
      runId,
      operator,
      isolateCases: Boolean(suiteId),
    });
    const startedAt = new Date();
    const plan = {
      schema_version: '1.0' as const,
      plan_id: `PLAN-${moduleId.toUpperCase()}-MANUAL-${Date.now()}`,
      suite_id: suiteId || `SUITE-${moduleId.toUpperCase()}-MANUAL`,
      platform_version: PLATFORM_VERSION,
      module_packs: [{ module_id: moduleId, version: '0.1.0' }],
      steps: suiteCases.map((entry, index) => ({ order: index + 1, case_id: entry.id, depends_on: [] as string[] })),
      dry_run: false,
      created_at: startedAt.toISOString(),
    };
    const result = await runSchedule(plan, { runner, cases: suiteCases, concurrency: 1 });
    const finishedAt = new Date();
    const report = buildExecutionReport({
      runId,
      platformVersion: PLATFORM_VERSION,
      modulePacks: [{ module_id: moduleId, version: '0.1.0' }],
      environment: { name: config.environment.name, type: config.environment.type as 'development' | 'test' | 'staging', tenant_id: config.environment.tenantId },
      operator,
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      outcomes: result.outcomes,
    });
    const validation = validateReport(report);
    const files = writeReports(path.join(root, 'artifacts', runId), report);
    const outcome = result.outcomes[0];
    const createdDocuments = result.outcomes.flatMap((entry) => entry.created_documents ?? []);
    const manifest = createRunManifestV2({
      run_id: runId,
      platform_version: PLATFORM_VERSION,
      module_packs: [{ module_id: moduleId, version: '0.1.0' }],
      environment: report.environment,
      operator,
      test_case_id: suiteId || (testCase as PlatformTestCase).id,
      started_at: report.started_at,
      finished_at: report.finished_at,
      outcome: report.outcome === 'pending' ? 'error' : report.outcome,
      failure_category: report.failure_category,
      created_documents: createdDocuments,
      cleanup_status: 'not_run',
      evidence_files: report.evidence,
    });
    const manifestValidation = validateRunManifestV2(manifest);
    fs.writeFileSync(path.join(root, 'artifacts', runId, 'run-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await browser.disconnect(session);
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'REAL_UI',
          command,
          success: validation.valid && report.outcome === 'passed',
          run_id: runId,
          suite_id: suiteId || null,
          case_id: suiteId ? null : (testCase as PlatformTestCase).id,
          cases: report.cases.map((entry) => ({ case_id: entry.case_id, status: entry.status })),
          outcome: report.outcome,
          failure_category: report.failure_category,
          error: outcome?.error_message ?? null,
          created_documents: manifest.created_documents,
          report_validation: validation,
          manifest_validation: { valid: manifestValidation.valid, issues: manifestValidation.issues },
          files,
        },
        null,
        2,
      )}\n`,
    );
    return validation.valid && manifestValidation.valid ? (report.outcome === 'passed' ? 0 : 2) : 2;
  }

  process.stderr.write(`未知命令: ${command}\n`);
  printHelp();
  return 1;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
