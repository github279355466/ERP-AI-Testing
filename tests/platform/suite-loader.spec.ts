import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadModuleTestSuites, requireTestSuite, resolveSuiteCases } from '../../src/platform/execution/suite-loader';
import { PlatformTestCase } from '../../src/platform/plan/compile';

function tempRepo(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'athena-suite-'));
}

function writeSuite(root: string, id: string, moduleId: string, caseIds: string[], order: string[], status = 'approved'): void {
  const dir = path.join(root, 'business-modules', moduleId, 'test-suites');
  fs.mkdirSync(dir, { recursive: true });
  const lines = [
    'schema_version: "1.0"',
    `id: ${id}`,
    `module_id: ${moduleId}`,
    'name: 测试套件',
    'version: 0.1.0',
    `status: ${status}`,
    'case_ids:',
    ...caseIds.map((entry) => `  - ${entry}`),
    'execution_order:',
    ...order.map((entry) => `  - ${entry}`),
    'tags: [test]',
    '',
  ];
  fs.writeFileSync(path.join(dir, `${id}.yaml`), lines.join('\n'), 'utf8');
}

const caseStub = (id: string): PlatformTestCase =>
  ({
    id,
    module_id: 'demo',
    steps: [],
    assertions: [],
  }) as unknown as PlatformTestCase;

test('套件按 execution_order 解析用例', () => {
  const root = tempRepo();
  writeSuite(root, 'SUITE-DEMO', 'demo', ['A', 'B'], ['B', 'A']);
  const suite = requireTestSuite(root, 'demo', 'SUITE-DEMO');
  expect(resolveSuiteCases(suite, [caseStub('A'), caseStub('B')]).map((entry) => entry.id)).toEqual(['B', 'A']);
});

test('execution_order 与 case_ids 不一致时拒绝加载', () => {
  const root = tempRepo();
  writeSuite(root, 'SUITE-BAD', 'demo', ['A'], ['A', 'B']);
  const loaded = loadModuleTestSuites(root, 'demo');
  expect(loaded.issues.length).toBe(1);
  expect(loaded.issues[0].messages.join(';')).toContain('execution_order');
});

test('套件引用不存在的用例时拒绝执行', () => {
  const root = tempRepo();
  writeSuite(root, 'SUITE-MISSING', 'demo', ['A', 'B'], ['A', 'B']);
  const suite = requireTestSuite(root, 'demo', 'SUITE-MISSING');
  expect(() => resolveSuiteCases(suite, [caseStub('A')])).toThrow(/SUITE_CASE_MISSING/);
});
