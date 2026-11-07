import { RunResult, summarize } from './types';

export function renderMarkdown(run: RunResult): string {
  const counts = summarize(run);
  const lines: string[] = [];
  lines.push(`# Athena ERP 测试执行报告`);
  lines.push('');
  lines.push(`- runId: ${run.runId}`);
  lines.push(`- 环境: ${run.environment}（租户 ${run.tenant}）`);
  lines.push(`- 时间: ${run.startedAt} → ${run.finishedAt}`);
  lines.push(`- 结果: 总数 ${counts.total}，通过 ${counts.passed}，失败 ${counts.failed}，阻塞 ${counts.blocked}，跳过 ${counts.skipped}`);
  lines.push('');

  for (const item of run.cases) {
    lines.push(`## ${item.id} ${item.name}`);
    lines.push('');
    lines.push(`- 状态: ${item.status}`);
    lines.push(`- 耗时: ${item.durationMs} ms`);
    if (item.error) lines.push(`- 错误: ${item.error}`);
    lines.push('');
    if (item.steps.length > 0) {
      lines.push('| 步骤 | 预期 | 实际 | 结果 |');
      lines.push('| --- | --- | --- | --- |');
      for (const step of item.steps) {
        lines.push(`| ${escapeCell(step.action)} | ${escapeCell(step.expected)} | ${escapeCell(step.actual)} | ${step.status} |`);
      }
      lines.push('');
    }
    if (item.assertions.length > 0) {
      lines.push('| 级别 | 断言 | 预期 | 实际 | 结果 |');
      lines.push('| --- | --- | --- | --- | --- |');
      for (const assertion of item.assertions) {
        lines.push(
          `| ${assertion.level} | ${escapeCell(assertion.name)} | ${escapeCell(assertion.expected)} | ${escapeCell(assertion.actual)} | ${assertion.passed ? 'PASS' : 'FAIL'} |`,
        );
      }
      lines.push('');
    }
    if (item.evidence.length > 0) {
      lines.push('证据:');
      for (const path of item.evidence) lines.push(`- ${path}`);
      lines.push('');
    }
    if (item.repro.length > 0) {
      lines.push('复现步骤:');
      item.repro.forEach((step, index) => lines.push(`${index + 1}. ${step}`));
      lines.push('');
    }
  }

  if (run.notes?.length) {
    lines.push('## 备注');
    for (const note of run.notes) lines.push(`- ${note}`);
    lines.push('');
  }
  return lines.join('\n');
}

function escapeCell(value: string): string {
  return String(value).replace(/\|/g, '\\|').replace(/\n+/g, ' ');
}
