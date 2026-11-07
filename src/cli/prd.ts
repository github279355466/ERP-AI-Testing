import path from 'node:path';
import { loadPrdConfig } from '../prd/config';
import { buildKnowledge, PipelineResult } from '../prd/pipeline';

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
  const lines = [
    'Athena PRD 建模（Phase 1）',
    '',
    '用法：',
    '  npm run prd:scan            全量扫描、建模并生成报告',
    '  npm run prd:scan:incremental 增量扫描（未变化文档复用缓存）',
    '  npm run prd:validate        校验知识模型（Schema/证据/引用）',
    '  npm run prd:report          重新生成报告',
    '  npm run prd:build           扫描 + 校验 + 报告',
    '  npm run prd:help            显示帮助',
    '',
    '可选参数：',
    '  --prd <dir>       覆盖 PRD 目录（默认取配置）',
    '  --scenario <dir>  覆盖测试用例库目录',
    '  --config <file>   指定配置文件',
    '  --json            以 JSON 输出摘要',
  ];
  process.stdout.write(`${lines.join('\n')}\n`);
}

function printSummary(result: PipelineResult, asJson: boolean): void {
  const { bundle, validation, coverage, outputs } = result;
  const consideredRules = bundle.rules.filter((rule) => coverage.considered_rule_ids.has(rule.id));
  const covered = consideredRules.filter((rule) => coverage.covered_rule_ids.has(rule.id)).length;
  const summary = {
    mode: bundle.scan.mode,
    documents: bundle.documents.length,
    prd_documents: bundle.documents.filter((document) => document.source_role === 'PRD').length,
    test_case_documents: bundle.documents.filter((document) => document.source_role === 'TEST_CASE_LIBRARY').length,
    entities: bundle.entities.length,
    pages: bundle.pages.length,
    fields: bundle.fields.length,
    controls: bundle.controls.length,
    rules: bundle.rules.length,
    actions: bundle.actions.length,
    workflows: bundle.workflows.length,
    dependencies: bundle.dependencies.length,
    scenarios: bundle.scenarios.length,
    existing_cases: bundle.existingCases.length,
    open_questions: bundle.openQuestions.length,
    parse_issues: bundle.issues.length,
    validation: { valid: validation.valid, errors: validation.errors.length, warnings: validation.warnings.length },
    coverage: {
      rules: consideredRules.length,
      covered,
      rate: consideredRules.length === 0 ? 0 : Number((covered / consideredRules.length).toFixed(4)),
    },
    outputs,
  };
  if (asJson) {
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
    return;
  }
  const rows = [
    `模式          ${summary.mode}`,
    `文档          ${summary.documents}（PRD ${summary.prd_documents} / 测试用例库 ${summary.test_case_documents}）`,
    `实体/页面     ${summary.entities} / ${summary.pages}`,
    `字段/控件     ${summary.fields} / ${summary.controls}`,
    `规则/动作     ${summary.rules} / ${summary.actions}`,
    `流程/依赖     ${summary.workflows} / ${summary.dependencies}`,
    `场景草案      ${summary.scenarios}`,
    `已有用例      ${summary.existing_cases}`,
    `待确认问题    ${summary.open_questions}`,
    `解析问题      ${summary.parse_issues}`,
    `校验          ${validation.valid ? 'PASS' : 'FAIL'}（错误 ${validation.errors.length} / 告警 ${validation.warnings.length}）`,
    `规则覆盖率    ${(consideredRules.length === 0 ? '0.0' : ((covered / consideredRules.length) * 100).toFixed(1))}%（${covered}/${consideredRules.length}，最新版文档）`,
    `知识库        ${outputs.knowledge_dir}`,
    `报告          ${outputs.report_dir}`,
  ];
  process.stdout.write(`${rows.join('\n')}\n`);
}

function main(): number {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  const repoRoot = path.resolve(__dirname, '..', '..');
  const config = loadPrdConfig({
    repoRoot,
    configPath: typeof args.config === 'string' ? args.config : undefined,
    prdDirOverride: typeof args.prd === 'string' ? args.prd : undefined,
    scenarioDirOverride: typeof args.scenario === 'string' ? args.scenario : undefined,
  });
  const asJson = args.json === true;

  switch (command) {
    case 'scan':
    case 'build': {
      const result = buildKnowledge(config, 'FULL', { useCache: false });
      printSummary(result, asJson);
      return result.validation.valid ? 0 : 2;
    }
    case 'scan:incremental': {
      const result = buildKnowledge(config, 'INCREMENTAL', { useCache: true });
      printSummary(result, asJson);
      return result.validation.valid ? 0 : 2;
    }
    case 'validate': {
      const result = buildKnowledge(config, 'FULL', { useCache: false });
      if (asJson) {
        printSummary(result, true);
      } else {
        printSummary(result, false);
        process.stdout.write('\n校验结果\n');
        for (const issue of result.validation.errors.slice(0, 50)) {
          process.stdout.write(`  ERROR ${issue.code} ${issue.object_type}:${issue.object_id} ${issue.message}\n`);
        }
        for (const issue of result.validation.warnings.slice(0, 30)) {
          process.stdout.write(`  WARN  ${issue.code} ${issue.object_type}:${issue.object_id} ${issue.message}\n`);
        }
      }
      return result.validation.valid ? 0 : 2;
    }
    case 'report': {
      const result = buildKnowledge(config, 'FULL', { useCache: false });
      printSummary(result, asJson);
      return 0;
    }
    default:
      process.stderr.write(`未知命令：${command}\n`);
      printHelp();
      return 1;
  }
}

process.exitCode = main();
