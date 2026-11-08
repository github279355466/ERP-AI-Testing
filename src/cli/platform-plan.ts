import fs from 'node:fs';
import path from 'node:path';
import { buildDryRunSummary, validateCompiledArtifacts, writeDryRunSummary } from '../platform/plan/artifacts';
import { compileModulePlan, loadCompiledPlan, ModulePlanResult } from '../platform/plan/module-plan';
import { validateCompiled } from '../platform/plan/compile';

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
      'Athena Scenario Compiler & Plan Builder (只读，不连接 ERP)',
      '',
      '用法：',
      '  node dist/cli/platform-plan.js compile --module purchase [--version 0.1.0] [--max-cases 2000]',
      '  node dist/cli/platform-plan.js validate --module purchase [--out artifacts/modules/purchase/compiled]',
      '  node dist/cli/platform-plan.js dry-run --module purchase [--refresh]',
      '',
      '说明：输入为 artifacts/modules/<id>/knowledge/scenarios.json，输出到 artifacts/modules/<id>/compiled/.',
      'dry-run 只做静态推演与契约校验，不启动浏览器、不触碰 ERP 数据。',
    ].join('\n') + '\n',
  );
}

function compiledDir(root: string, moduleId: string, out?: string): string {
  return out ? path.resolve(root, out) : path.join(root, 'artifacts', 'modules', moduleId, 'compiled');
}

function compile(root: string, moduleId: string, args: Args): ModulePlanResult {
  return compileModulePlan({
    repoRoot: root,
    moduleId,
    version: typeof args.version === 'string' ? args.version : undefined,
    maxCases: typeof args['max-cases'] === 'string' ? Number(args['max-cases']) : undefined,
    outputDir: typeof args.out === 'string' ? args.out : undefined,
  });
}

function main(): number {
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

  try {
    if (command === 'compile') {
      const result = compile(root, moduleId, args);
      const issues = validateCompiled(result.compiled);
      const contracts = validateCompiledArtifacts(result.outputDir);
      const success = issues.length === 0 && contracts.valid;
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'STATIC_COMPILE',
            command,
            success,
            module_id: moduleId,
            output_dir: result.outputDir,
            scenarios: result.compiled.scenarios.length,
            testcases: result.compiled.testcases.length,
            skipped: result.compiled.skipped.length,
            plan_id: result.plan.plan_id,
            dag: { acyclic: result.dag.acyclic, order: result.dag.order.length },
            semantic_issues: issues.slice(0, 20),
            semantic_issue_total: issues.length,
            contracts: { valid: contracts.valid, checked: contracts.checked, issue_total: contracts.issues.length },
          },
          null,
          2,
        )}\n`,
      );
      return success ? 0 : 2;
    }

    if (command === 'validate') {
      const directory = compiledDir(root, moduleId, typeof args.out === 'string' ? args.out : undefined);
      const contracts = validateCompiledArtifacts(directory);
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'READ_ONLY',
            command,
            success: contracts.valid,
            module_id: moduleId,
            directory,
            checked: contracts.checked,
            issue_total: contracts.issues.length,
            issues: contracts.issues.slice(0, 30),
          },
          null,
          2,
        )}\n`,
      );
      return contracts.valid ? 0 : 2;
    }

    if (command === 'dry-run') {
      const directory = compiledDir(root, moduleId, typeof args.out === 'string' ? args.out : undefined);
      const hasPlan = fs.existsSync(path.join(directory, 'execution-plan.json'));
      const result =
        !hasPlan || args.refresh === true
          ? compile(root, moduleId, args)
          : loadCompiledPlan(root, moduleId, typeof args.out === 'string' ? args.out : undefined);
      const target = result.outputDir;
      const contracts = validateCompiledArtifacts(target);
      const summary = buildDryRunSummary(result, contracts);
      const file = writeDryRunSummary(target, summary);
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'DRY_RUN',
            command,
            success: contracts.valid,
            module_id: moduleId,
            plan_id: summary.plan_id,
            cases: summary.cases,
            actions: summary.actions,
            authorization_required_actions: summary.authorization_required_actions,
            approval_gate: summary.approval_gate,
            contracts: { valid: contracts.valid, checked: contracts.checked, issue_total: contracts.issues.length },
            output: file,
          },
          null,
          2,
        )}\n`,
      );
      return contracts.valid ? 0 : 2;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  process.stderr.write(`未知命令: ${command}\n`);
  printHelp();
  return 1;
}

process.exitCode = main();
