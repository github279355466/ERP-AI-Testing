import { RunResult, summarize } from './types';

export function renderHtml(run: RunResult): string {
  const counts = summarize(run);
  const cases = run.cases.map(renderCase).join('\n');
  return `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<title>Athena ERP 测试报告 ${escapeHtml(run.runId)}</title>
<style>
body{font-family:"Segoe UI","Microsoft YaHei",sans-serif;margin:32px;color:#1f2330;background:#f6f7fb}
h1{font-size:22px;margin:0 0 8px}
.meta{color:#666;margin:0 0 20px}
.summary{display:flex;gap:12px;flex-wrap:wrap;margin-bottom:24px}
.card{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:12px 18px;min-width:96px}
.card b{display:block;font-size:22px}
.case{background:#fff;border:1px solid #e3e6ef;border-radius:10px;padding:16px;margin-bottom:16px}
.case.failed{border-left:4px solid #d64545}
.case.blocked{border-left:4px solid #d99b1f}
.case.passed{border-left:4px solid #2f9e5f}
.badge{font-size:12px;padding:2px 8px;border-radius:10px;background:#eef0f6;margin-left:8px}
table{width:100%;border-collapse:collapse;font-size:13px;margin-top:8px}
th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #eef0f6}
.pass{color:#2f9e5f;font-weight:600}
.fail{color:#d64545;font-weight:600}
.error{color:#d64545}
</style></head><body>
<h1>Athena ERP 测试执行报告</h1>
<p class="meta">runId: ${escapeHtml(run.runId)}　环境: ${escapeHtml(run.environment)}　租户: ${escapeHtml(run.tenant)}　${escapeHtml(run.startedAt)} → ${escapeHtml(run.finishedAt)}</p>
<div class="summary">
<div class="card">总数<b>${counts.total}</b></div>
<div class="card">通过<b>${counts.passed}</b></div>
<div class="card">失败<b>${counts.failed}</b></div>
<div class="card">阻塞<b>${counts.blocked}</b></div>
<div class="card">跳过<b>${counts.skipped}</b></div>
</div>
${cases}
</body></html>`;
}

function renderCase(item: RunResult['cases'][number]): string {
  const assertions = item.assertions
    .map(
      (assertion) => `<tr><td>${escapeHtml(assertion.level)}</td><td>${escapeHtml(assertion.name)}</td><td>${escapeHtml(assertion.expected)}</td><td>${escapeHtml(assertion.actual)}</td><td class="${assertion.passed ? 'pass' : 'fail'}">${assertion.passed ? 'PASS' : 'FAIL'}</td></tr>`,
    )
    .join('');
  const steps = item.steps
    .map(
      (step) => `<tr><td>${escapeHtml(step.action)}</td><td>${escapeHtml(step.expected)}</td><td>${escapeHtml(step.actual)}</td><td>${step.status}</td></tr>`,
    )
    .join('');
  const evidence = item.evidence.map((path) => `<li><a href="${escapeHtml(path)}">${escapeHtml(path)}</a></li>`).join('');
  const repro = item.repro.map((step) => `<li>${escapeHtml(step)}</li>`).join('');
  return `<section class="case ${item.status}">
<h3>${escapeHtml(item.id)} ${escapeHtml(item.name)} <span class="badge">${item.status}</span></h3>
<p class="meta">耗时 ${item.durationMs} ms</p>
${steps ? `<table><thead><tr><th>步骤</th><th>预期</th><th>实际</th><th>结果</th></tr></thead><tbody>${steps}</tbody></table>` : ''}
<table><thead><tr><th>级别</th><th>断言</th><th>预期</th><th>实际</th><th>结果</th></tr></thead><tbody>${assertions || '<tr><td colspan="5">无断言</td></tr>'}</tbody></table>
${evidence ? `<p>证据</p><ul>${evidence}</ul>` : ''}
${repro ? `<p>复现步骤</p><ol>${repro}</ol>` : ''}
${item.error ? `<p class="error">错误：${escapeHtml(item.error)}</p>` : ''}
</section>`;
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
