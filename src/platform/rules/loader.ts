import fs from 'node:fs';
import path from 'node:path';
import { readStructured, validateData } from '../contracts/validator';
import { FieldRule } from './engine';

export interface FieldRuleSet {
  schema_version: '1.0';
  module_id: string;
  page_key: string;
  rules: FieldRule[];
}

export interface FieldRuleLoadResult {
  directory: string;
  sets: FieldRuleSet[];
  issues: Array<{ file: string; messages: string[] }>;
}

export function fieldRuleDirectory(repoRoot: string, moduleId: string): string {
  return path.join(repoRoot, 'business-modules', moduleId, 'field-rules');
}

export function loadFieldRuleSets(repoRoot: string, moduleId: string): FieldRuleLoadResult {
  const directory = fieldRuleDirectory(repoRoot, moduleId);
  if (!fs.existsSync(directory)) return { directory, sets: [], issues: [] };
  const files = fs.readdirSync(directory).filter((file) => /\.ya?ml$/i.test(file)).sort();
  const sets: FieldRuleSet[] = [];
  const issues: FieldRuleLoadResult['issues'] = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const data = readStructured(target);
    const result = validateData('field-rule', data, { target });
    if (!result.valid) {
      issues.push({ file, messages: result.issues.map((issue) => `${issue.path} ${issue.message}`) });
      continue;
    }
    const set = data as FieldRuleSet;
    if (set.module_id !== moduleId) {
      issues.push({ file, messages: [`module_id=${set.module_id} 与模块包 ${moduleId} 不一致`] });
      continue;
    }
    sets.push(set);
  }
  return { directory, sets, issues };
}

export function rulesForPage(sets: FieldRuleSet[], pageKey: string): FieldRule[] {
  return sets.filter((set) => set.page_key === pageKey).flatMap((set) => set.rules);
}
