import fs from 'node:fs';
import path from 'node:path';
import { validateData } from '../contracts/validator';
import { CaseOutcome, FailureCategory, ReportAssertion, ReportStep, RunStatus } from '../execution/scheduler';

export interface ReportCase {
  case_id: string;
  status: RunStatus;
  duration_ms: number;
  steps: ReportStep[];
  assertions: ReportAssertion[];
  evidence: string[];
}

export interface ExecutionReport {
  schema_version: '1.0';
  run_id: string;
  platform_version: string;
  module_packs: Array<{ module_id: string; version: string }>;
  environment: { name: string; type: 'development' | 'test' | 'staging'; tenant_id: string };
  operator: string;
  started_at: string;
  finished_at: string;
  outcome: RunStatus;
  failure_category: FailureCategory;
  cases: ReportCase[];
  data_preparation: { status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'not_run'; recipe_refs: string[]; notes: string };
  cleanup: { status: 'passed' | 'failed' | 'blocked' | 'skipped' | 'not_run'; notes: string };
  evidence: string[];
}

export interface ReportInput {
  runId: string;
  platformVersion: string;
  modulePacks: Array<{ module_id: string; version: string }>;
  environment: ExecutionReport['environment'];
  operator: string;
  startedAt: string;
  finishedAt: string;
  outcomes: CaseOutcome[];
}

export function aggregateOutcome(outcomes: CaseOutcome[]): RunStatus {
  if (outcomes.length === 0) return 'skipped';
  if (outcomes.some((outcome) => outcome.status === 'failed' || outcome.status === 'error')) return 'failed';
  if (outcomes.some((outcome) => outcome.status === 'blocked')) return 'blocked';
  if (outcomes.every((outcome) => outcome.status === 'cancelled')) return 'cancelled';
  if (outcomes.some((outcome) => outcome.status === 'cancelled')) return 'cancelled';
  if (outcomes.every((outcome) => outcome.status === 'skipped')) return 'skipped';
  return 'passed';
}

export function aggregateFailure(outcomes: CaseOutcome[]): FailureCategory {
  const failed = outcomes.find((outcome) => outcome.status === 'failed' || outcome.status === 'error');
  return failed?.failure_category ?? 'none';
}

export function buildExecutionReport(input: ReportInput): ExecutionReport {
  const cases: ReportCase[] = input.outcomes.map((outcome) => ({
    case_id: outcome.case_id,
    status: outcome.status,
    duration_ms: outcome.duration_ms,
    steps: outcome.steps.map((step) => ({ action: step.action, status: step.status, ...(step.detail ? { detail: step.detail } : {}) })),
    assertions: outcome.assertions.map((assertion) => ({
      name: assertion.name,
      level: assertion.level,
      expected: assertion.expected,
      actual: assertion.actual,
      passed: assertion.passed,
      source_ref: assertion.source_ref,
    })),
    evidence: outcome.evidence,
  }));
  const recipeRefs = [...new Set(input.outcomes.flatMap((outcome) => outcome.data_recipe_refs ?? []))];
  const dataFailed = input.outcomes.some((outcome) => outcome.failure_category === 'data_preparation');
  const cleanupStatuses = input.outcomes.map((outcome) => outcome.cleanup?.status ?? 'not_run');
  const cleanup = cleanupStatuses.includes('failed')
    ? 'failed'
    : cleanupStatuses.includes('blocked')
      ? 'blocked'
      : cleanupStatuses.every((status) => status === 'passed')
        ? 'passed'
        : cleanupStatuses.every((status) => status === 'not_run')
          ? 'not_run'
          : 'skipped';
  const cleanupNotes = [...new Set(input.outcomes.map((outcome) => outcome.cleanup?.notes).filter((note): note is string => Boolean(note)))].join('；');
  return {
    schema_version: '1.0',
    run_id: input.runId,
    platform_version: input.platformVersion,
    module_packs: input.modulePacks,
    environment: input.environment,
    operator: input.operator,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    outcome: aggregateOutcome(input.outcomes),
    failure_category: aggregateFailure(input.outcomes),
    cases,
    data_preparation: {
      status: recipeRefs.length === 0 ? 'not_run' : dataFailed ? 'failed' : 'passed',
      recipe_refs: recipeRefs,
      notes: recipeRefs.length === 0 ? '本次运行未引用数据配方' : `引用 ${recipeRefs.length} 个配方`,
    },
    cleanup: { status: cleanup, notes: cleanupNotes || '未执行清理' },
    evidence: [...new Set(input.outcomes.flatMap((outcome) => outcome.evidence))],
  };
}

export function validateReport(report: ExecutionReport): { valid: boolean; messages: string[] } {
  const result = validateData('execution-report', report, { target: report.run_id });
  return { valid: result.valid, messages: result.issues.map((issue) => `${issue.path} ${issue.message}`) };
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string);
}

const STATUS_LABEL: Record<RunStatus, string> = {
  passed: '通过',
  failed: '失败',
  blocked: '阻塞',
  skipped: '跳过',
  cancelled: '取消',
  error: '异常',
  pending: '待执行',
};

export function renderMarkdown(report: ExecutionReport): string {
  const passed = report.cases.filter((entry) => entry.status === 'passed').length;
  const lines = [
    `# 执行报告 ${report.run_id}`,
    '',
    `- 结论：**${STATUS_LABEL[report.outcome]}**`,
    `- 失败分类：${report.failure_category}`,
    `- 模块：${report.module_packs.map((pack) => `${pack.module_id}@${pack.version}`).join(', ') || '未指定'}`,
    `- 环境：${report.environment.name}（${report.environment.type}）`,
    `- 操作者：${report.operator}`,
    `- 时间：${report.started_at} → ${report.finished_at}`,
    `- 平台版本：${report.platform_version}`,
    `- 用例：${passed}/${report.cases.length} 通过`,
    '',
    '## 用例结果',
    '',
    '| 用例 | 状态 | 耗时(ms) | 断言 | 证据 |',
    '| --- | --- | --- | --- | --- |',
    ...report.cases.map((entry) => {
      const assertions = `${entry.assertions.filter((assertion) => assertion.passed).length}/${entry.assertions.length}`;
      return `| ${entry.case_id} | ${STATUS_LABEL[entry.status]} | ${entry.duration_ms} | ${assertions} | ${entry.evidence.length} |`;
    }),
    '',
    '## 断言明细',
    '',
    ...report.cases.flatMap((entry) =>
      entry.assertions.map(
        (assertion) =>
          `- [${assertion.passed ? 'x' : ' '}] ${entry.case_id} · ${assertion.name} · 期望「${assertion.expected}」实际「${assertion.actual}」· ${assertion.level} · 来源 ${assertion.source_ref.file_path}`,
      ),
    ),
    '',
    '## 数据准备与清理',
    '',
    `- 数据准备：${report.data_preparation.status}（${report.data_preparation.notes}）`,
    `- 清理：${report.cleanup.status}（${report.cleanup.notes}）`,
    '',
    '## 证据',
    '',
    ...(report.evidence.length > 0 ? report.evidence.map((file) => `- ${file}`) : ['- 无']),
    '',
  ];
  return `${lines.join('\n')}\n`;
}

export function renderHtml(report: ExecutionReport): string {
  const rows = report.cases
    .map((entry) => {
      const assertions = entry.assertions
        .map(
          (assertion) =>
            `<li class="${assertion.passed ? 'ok' : 'bad'}"><strong>${escapeHtml(assertion.name)}</strong>：期望「${escapeHtml(assertion.expected)}」实际「${escapeHtml(assertion.actual)}」<span class="meta">${escapeHtml(assertion.level)} · ${escapeHtml(assertion.source_ref.file_path)}</span></li>`,
        )
        .join('');
      return `<tr><td>${escapeHtml(entry.case_id)}</td><td class="s-${entry.status}">${STATUS_LABEL[entry.status]}</td><td>${entry.duration_ms}</td><td><ul>${assertions}</ul></td></tr>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>执行报告 ${escapeHtml(report.run_id)}</title>
<style>
  body { font-family: -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; margin: 32px; color: #1f2328; }
  h1 { font-size: 22px; }
  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin: 20px 0; }
  .summary div { border: 1px solid #d0d7de; border-radius: 8px; padding: 12px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid #d0d7de; padding: 8px; text-align: left; vertical-align: top; font-size: 13px; }
  ul { margin: 0; padding-left: 18px; }
  .ok { color: #1a7f37; }
  .bad { color: #cf222e; }
  .meta { color: #656d76; margin-left: 6px; }
  .s-passed { color: #1a7f37; } .s-failed, .s-error { color: #cf222e; } .s-blocked { color: #9a6700; } .s-cancelled, .s-skipped { color: #656d76; }
</style>
</head>
<body>
<h1>执行报告 ${escapeHtml(report.run_id)}</h1>
<div class="summary">
  <div><strong>结论</strong><br/>${STATUS_LABEL[report.outcome]}</div>
  <div><strong>失败分类</strong><br/>${escapeHtml(report.failure_category)}</div>
  <div><strong>用例</strong><br/>${report.cases.filter((entry) => entry.status === 'passed').length}/${report.cases.length} 通过</div>
  <div><strong>平台版本</strong><br/>${escapeHtml(report.platform_version)}</div>
  <div><strong>环境</strong><br/>${escapeHtml(report.environment.name)}（${escapeHtml(report.environment.type)}）</div>
  <div><strong>时间</strong><br/>${escapeHtml(report.started_at)} → ${escapeHtml(report.finished_at)}</div>
</div>
<table>
<thead><tr><th>用例</th><th>状态</th><th>耗时(ms)</th><th>断言</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>
<h2>数据准备与清理</h2>
<p>数据准备：${escapeHtml(report.data_preparation.status)}（${escapeHtml(report.data_preparation.notes)}）</p>
<p>清理：${escapeHtml(report.cleanup.status)}（${escapeHtml(report.cleanup.notes)}）</p>
<h2>证据</h2>
<ul>${report.evidence.map((file) => `<li>${escapeHtml(file)}</li>`).join('') || '<li>无</li>'}</ul>
</body>
</html>
`;
}

export function writeReports(directory: string, report: ExecutionReport): { json: string; markdown: string; html: string } {
  fs.mkdirSync(directory, { recursive: true });
  const json = path.join(directory, 'report.json');
  const markdown = path.join(directory, 'report.md');
  const html = path.join(directory, 'report.html');
  fs.writeFileSync(json, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  fs.writeFileSync(markdown, renderMarkdown(report), 'utf8');
  fs.writeFileSync(html, renderHtml(report), 'utf8');
  return { json, markdown, html };
}
