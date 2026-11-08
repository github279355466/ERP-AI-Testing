import fs from 'node:fs';
import path from 'node:path';
import { readStructured, validateData } from '../contracts/validator';
import { PlatformTestCase } from '../plan/compile';

export interface ModuleTestCaseLoadResult {
  directory: string;
  cases: PlatformTestCase[];
  issues: Array<{ file: string; messages: string[] }>;
}

export function loadModuleTestCases(repoRoot: string, moduleId: string): ModuleTestCaseLoadResult {
  const directory = path.join(repoRoot, 'business-modules', moduleId, 'testcases');
  if (!fs.existsSync(directory)) return { directory, cases: [], issues: [] };
  const files = fs.readdirSync(directory).filter((file) => /\.ya?ml$/i.test(file)).sort();
  const cases: PlatformTestCase[] = [];
  const issues: ModuleTestCaseLoadResult['issues'] = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const data = readStructured(target);
    const result = validateData('test-case', data, { target });
    if (!result.valid) {
      issues.push({ file, messages: result.issues.map((issue) => `${issue.path} ${issue.message}`) });
      continue;
    }
    const testCase = data as PlatformTestCase;
    if (testCase.module_id !== moduleId) {
      issues.push({ file, messages: [`module_id=${testCase.module_id} 与模块包 ${moduleId} 不一致`] });
      continue;
    }
    cases.push(testCase);
  }
  return { directory, cases, issues };
}

export function requireTestCase(repoRoot: string, moduleId: string, caseId: string): PlatformTestCase {
  const loaded = loadModuleTestCases(repoRoot, moduleId);
  if (loaded.issues.length > 0) {
    throw new Error(`[CASE_CONTRACT_INVALID] ${loaded.issues.map((entry) => `${entry.file}: ${entry.messages.join('; ')}`).join(' | ')}`);
  }
  const testCase = loaded.cases.find((entry) => entry.id === caseId);
  if (!testCase) {
    throw new Error(`[CASE_NOT_FOUND] 模块 ${moduleId} 未找到用例 ${caseId}；可用: ${loaded.cases.map((entry) => entry.id).join(', ') || '(无)'}`);
  }
  return testCase;
}
