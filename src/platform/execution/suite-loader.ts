import fs from 'node:fs';
import path from 'node:path';
import { readStructured, validateData } from '../contracts/validator';
import { PlatformTestCase, PlatformTestSuite } from '../plan/compile';

export interface ModuleTestSuiteLoadResult {
  directory: string;
  suites: PlatformTestSuite[];
  issues: Array<{ file: string; messages: string[] }>;
}

export function loadModuleTestSuites(repoRoot: string, moduleId: string): ModuleTestSuiteLoadResult {
  const directory = path.join(repoRoot, 'business-modules', moduleId, 'test-suites');
  if (!fs.existsSync(directory)) return { directory, suites: [], issues: [] };
  const files = fs.readdirSync(directory).filter((file) => /\.ya?ml$/i.test(file)).sort();
  const suites: PlatformTestSuite[] = [];
  const issues: ModuleTestSuiteLoadResult['issues'] = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const data = readStructured(target);
    const result = validateData('test-suite', data, { target });
    if (!result.valid) {
      issues.push({ file, messages: result.issues.map((issue) => `${issue.path} ${issue.message}`) });
      continue;
    }
    const suite = data as PlatformTestSuite;
    if (suite.module_id !== moduleId) {
      issues.push({ file, messages: [`module_id=${suite.module_id} 与模块包 ${moduleId} 不一致`] });
      continue;
    }
    const declared = [...suite.case_ids].sort().join(',');
    const ordered = [...suite.execution_order].sort().join(',');
    if (declared !== ordered) {
      issues.push({ file, messages: ['execution_order 必须与 case_ids 完全一致'] });
      continue;
    }
    suites.push(suite);
  }
  return { directory, suites, issues };
}

export function requireTestSuite(repoRoot: string, moduleId: string, suiteId: string): PlatformTestSuite {
  const loaded = loadModuleTestSuites(repoRoot, moduleId);
  if (loaded.issues.length > 0) {
    throw new Error(
      `[SUITE_CONTRACT_INVALID] ${loaded.issues.map((entry) => `${entry.file}: ${entry.messages.join('; ')}`).join(' | ')}`,
    );
  }
  const suite = loaded.suites.find((entry) => entry.id === suiteId);
  if (!suite) {
    throw new Error(`[SUITE_NOT_FOUND] 模块 ${moduleId} 未找到套件 ${suiteId}；可用: ${loaded.suites.map((entry) => entry.id).join(', ') || '(无)'}`);
  }
  if (suite.status === 'deprecated') {
    throw new Error(`[SUITE_DEPRECATED] 套件 ${suiteId} 已废弃，拒绝执行`);
  }
  return suite;
}

export function resolveSuiteCases(suite: PlatformTestSuite, cases: PlatformTestCase[]): PlatformTestCase[] {
  const byId = new Map(cases.map((entry) => [entry.id, entry]));
  const missing = suite.case_ids.filter((id) => !byId.has(id));
  if (missing.length > 0) {
    throw new Error(`[SUITE_CASE_MISSING] 套件 ${suite.id} 引用的用例不存在: ${missing.join(', ')}`);
  }
  return suite.execution_order
    .filter((id) => byId.has(id))
    .map((id) => byId.get(id) as PlatformTestCase);
}
