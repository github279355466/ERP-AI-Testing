import { expect, test } from '@playwright/test';
import { renderHtml } from '../../src/reporting/html-reporter';
import { renderMarkdown } from '../../src/reporting/markdown-reporter';
import { RunResult } from '../../src/reporting/types';

const run: RunResult = {
  runId: 'test-run',
  environment: 'athena-test',
  tenant: 'digichannel',
  startedAt: '2026-11-06T10:00:00+08:00',
  finishedAt: '2026-11-06T10:01:00+08:00',
  cases: [
    {
      id: 'TC-001',
      name: '列表加载 <script>',
      status: 'failed',
      startedAt: '2026-11-06T10:00:00+08:00',
      durationMs: 1200,
      steps: [{ action: '打开列表', expected: '加载完成', actual: '超时', status: 'fail' }],
      assertions: [{ level: 'ui', name: '行数', expected: '>=1', actual: '0', passed: false }],
      evidence: ['shots/a.png'],
      error: '超时',
      repro: ['打开列表'],
    },
  ],
};

test('Markdown 报告包含统计与用例', () => {
  const text = renderMarkdown(run);
  expect(text).toContain('总数 1');
  expect(text).toContain('TC-001');
  expect(text).toContain('| ui | 行数 |');
});

test('HTML 报告转义脚本标签', () => {
  const html = renderHtml(run);
  expect(html).toContain('&lt;script&gt;');
  expect(html).not.toContain('<script>');
  expect(html).toContain('TC-001');
});
