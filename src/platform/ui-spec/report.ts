import fs from 'node:fs';
import path from 'node:path';
import { UiFinding, UiPageResult, UiRunSummary } from './types';

export interface UiRunMeta {
  run_id: string;
  module_ids: string[];
  environment: { name: string; tenant_id: string; base_url: string };
  started_at: string;
  finished_at: string;
  operator: string;
}

function conclusion(status: UiFinding['status']): string {
  switch (status) {
    case 'pass':
      return '通过';
    case 'fail':
      return '**不符合**';
    case 'unknown':
      return '待确认';
    default:
      return '跳过';
  }
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

function renderFindings(findings: UiFinding[]): string {
  if (findings.length === 0) return '（无）\n';
  const lines = ['| 规则 | 检查项 | 期望 | 实测 | 结论 | 说明 |', '| --- | --- | --- | --- | --- | --- |'];
  for (const finding of findings) {
    lines.push(
      `| ${finding.rule} | ${escapeCell(finding.title)} | ${escapeCell(finding.expectation)} | ${escapeCell(finding.observed)} | ${conclusion(finding.status)} | ${escapeCell(finding.note ?? '')} |`,
    );
  }
  return `${lines.join('\n')}\n`;
}

function pageVerdict(result: UiPageResult): string {
  if (result.error) return '**执行失败**';
  const failed = result.findings.filter((finding) => finding.status === 'fail').length;
  return failed === 0 ? '通过' : `**不符合（${failed} 项）**`;
}

export function renderRunReport(meta: UiRunMeta, results: UiPageResult[], summary: UiRunSummary): string {
  const lines: string[] = [];
  lines.push('# ERP 界面规范测试报告');
  lines.push('');
  lines.push(`- 运行编号：\`${meta.run_id}\``);
  lines.push(`- 环境：${meta.environment.name} / ${meta.environment.tenant_id} / ${meta.environment.base_url}`);
  lines.push(`- 范围：${meta.module_ids.join('、')} 模块的界面规范（字段排列、顺序、显示格式）`);
  lines.push(`- 时间：${meta.started_at} → ${meta.finished_at}`);
  lines.push(`- 操作者：${meta.operator}`);
  lines.push('');
  lines.push('> 本报告只校验界面规范：字段/列的排列与顺序、分组结构、显示格式（如「名称（编号）」）、按钮排列。');
  lines.push('> 颜色、字体、字号、间距由统一平台组件负责，不在本次校验范围。');
  lines.push('');
  lines.push('## 1. 总览');
  lines.push('');
  lines.push(`- 页面：${summary.total} 个，通过 ${summary.passed}，不符合 ${summary.failed}`);
  lines.push(`- 规则：${summary.rules} 条，待确认 ${summary.unknown}，跳过 ${summary.skipped}`);
  lines.push('');
  lines.push('| 页面 | 类型 | 结论 | 规则数 | 不符合 | 待确认 |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const result of results) {
    const failed = result.findings.filter((finding) => finding.status === 'fail').length;
    const unknown = result.findings.filter((finding) => finding.status === 'unknown').length;
    lines.push(
      `| ${result.page_name}（\`${result.page_key}\`） | ${result.page_type === 'document' ? '单据类' : '基础资料'} | ${pageVerdict(result)} | ${result.findings.length} | ${failed} | ${unknown} |`,
    );
  }
  lines.push('');

  const failures = results.flatMap((result) =>
    result.findings.filter((finding) => finding.status === 'fail').map((finding) => ({ page: result.page_name, pageKey: result.page_key, finding })),
  );
  lines.push('## 2. 不符合项汇总');
  lines.push('');
  if (failures.length === 0) {
    lines.push('无不符合项。');
  } else {
    lines.push('| 页面 | 规则 | 检查项 | 期望 | 实测 |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const entry of failures) {
      lines.push(
        `| ${entry.page} | ${entry.finding.rule} | ${escapeCell(entry.finding.title)} | ${escapeCell(entry.finding.expectation)} | ${escapeCell(entry.finding.observed)} |`,
      );
    }
  }
  lines.push('');

  lines.push('## 3. 逐页结果');
  for (const result of results) {
    lines.push('');
    lines.push(`### ${result.page_name}`);
    lines.push('');
    lines.push(`- page_key：\`${result.page_key}\``);
    lines.push(`- 规范来源：\`${result.source_ref.file_path}\``);
    if (result.error) lines.push(`- 执行异常：${result.error}`);
    if (result.screenshots && result.screenshots.length > 0) {
      lines.push(`- 截图：${result.screenshots.map((shot) => `\`${shot}\``).join('、')}`);
    }
    lines.push('');
    lines.push('#### 列表页');
    lines.push('');
    lines.push(renderFindings(result.findings.filter((finding) => finding.rule.startsWith('L'))));
    lines.push('#### 详情页');
    lines.push('');
    lines.push(renderFindings(result.findings.filter((finding) => finding.rule.startsWith('D'))));
  }
  lines.push('');
  lines.push('## 4. 口径说明');
  lines.push('');
  lines.push('- 列顺序按「规范字段在实测列中出现且相对顺序一致」判定，未在规范中列出的扩展列不判失败。');
  lines.push('- 行内按钮与批量按钮按「规范顺序」判定；被列宽收纳进「…」的按钮记为待确认。');
  lines.push('- 开窗字段格式按「名称（编号）」全角括号判定；空值字段不参与该条断言。');
  lines.push('');
  return lines.join('\n');
}

export function writeRunArtifacts(
  root: string,
  meta: UiRunMeta,
  results: UiPageResult[],
  summary: UiRunSummary,
): { directory: string; markdown: string; json: string } {
  const directory = path.join(root, 'artifacts', meta.run_id, 'ui-spec');
  fs.mkdirSync(directory, { recursive: true });
  const markdownPath = path.join(directory, 'report.md');
  const jsonPath = path.join(directory, 'report.json');
  fs.writeFileSync(markdownPath, renderRunReport(meta, results, summary), 'utf8');
  fs.writeFileSync(jsonPath, `${JSON.stringify({ meta, summary, results }, null, 2)}\n`, 'utf8');
  return { directory, markdown: markdownPath, json: jsonPath };
}
