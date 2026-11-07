import fs from 'node:fs';
import path from 'node:path';
import { computeCoverage, CoverageResult } from './link';
import {
  SCHEMA_VERSION,
  Action,
  Control,
  Dependency,
  DocumentRecord,
  Entity,
  Evidence,
  ExistingCaseRecord,
  Field,
  KnowledgeBundle,
  OpenQuestion,
  Page,
  Rule,
  Scenario,
  Workflow,
} from './types';

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
}

export interface LoadedKnowledge {
  bundle: KnowledgeBundle;
  summary: Record<string, unknown>;
  register: Record<string, unknown> | null;
}

export function loadKnowledgeBundle(knowledgeDir: string, sourceIndexDir?: string): LoadedKnowledge {
  const documentsFile = path.join(knowledgeDir, 'documents.json');
  if (!fs.existsSync(documentsFile)) {
    throw new Error(`知识库不存在：${documentsFile}。请先执行 npm run prd:scan 生成基线。`);
  }
  const summary = readJson<Record<string, unknown>>(path.join(knowledgeDir, 'summary.json'), {
    schema_version: SCHEMA_VERSION,
    generated_at: new Date().toISOString(),
    mode: 'FULL',
  });
  const counts = (summary.counts as Record<string, number> | undefined) ?? {};
  const scan = (summary.scan as KnowledgeBundle['scan'] | undefined) ?? {
    scanned_at: String(summary.generated_at ?? new Date().toISOString()),
    source_root: String(summary.source_root ?? ''),
    total_files: Number(counts.documents ?? 0),
    supported_files: Number(counts.documents ?? 0),
    unsupported_files: 0,
    new_documents: 0,
    modified_documents: 0,
    unchanged_documents: 0,
    missing_documents: 0,
    parse_errors: Number(counts.parse_issues ?? 0),
    mode: 'FULL' as const,
  };
  const bundle: KnowledgeBundle = {
    documents: readJson<DocumentRecord[]>(documentsFile, []),
    entities: readJson<Entity[]>(path.join(knowledgeDir, 'entities.json'), []),
    pages: readJson<Page[]>(path.join(knowledgeDir, 'pages.json'), []),
    fields: readJson<Field[]>(path.join(knowledgeDir, 'fields.json'), []),
    controls: readJson<Control[]>(path.join(knowledgeDir, 'controls.json'), []),
    rules: readJson<Rule[]>(path.join(knowledgeDir, 'rules.json'), []),
    actions: readJson<Action[]>(path.join(knowledgeDir, 'actions.json'), []),
    workflows: readJson<Workflow[]>(path.join(knowledgeDir, 'workflows.json'), []),
    dependencies: readJson<Dependency[]>(path.join(knowledgeDir, 'dependencies.json'), []),
    scenarios: readJson<Scenario[]>(path.join(knowledgeDir, 'scenarios.json'), []),
    existingCases: readJson<ExistingCaseRecord[]>(path.join(knowledgeDir, 'existing-cases.json'), []),
    openQuestions: readJson<OpenQuestion[]>(path.join(knowledgeDir, 'open-questions.json'), []),
    evidence: readJson<Evidence[]>(path.join(knowledgeDir, 'evidence.json'), []),
    issues: [],
    scan,
  };
  const register = sourceIndexDir
    ? readJson<Record<string, unknown> | null>(path.join(sourceIndexDir, 'DOCUMENT_REGISTER.json'), null)
    : null;
  return { bundle, summary, register };
}

/** 与 pipeline 相同口径：只对最新版文档的规则计算覆盖率 */
export function recomputeCoverage(bundle: KnowledgeBundle): CoverageResult {
  const latest = new Set(bundle.documents.filter((document) => document.is_latest).map((document) => document.id));
  return computeCoverage(
    bundle.rules.filter((rule) => latest.has(rule.document_id)),
    bundle.existingCases,
    bundle.entities
  );
}

export function unsupportedFromRegister(register: Record<string, unknown> | null): string[] {
  if (!register) return [];
  const list = (register.unsupported_files as Array<{ relative_path?: string }> | undefined) ?? [];
  return list.map((item) => String(item.relative_path ?? '')).filter(Boolean);
}

export function skippedFromRegister(register: Record<string, unknown> | null): string[] {
  if (!register) return [];
  const list = (register.scanned_but_not_modeled as Array<{ relative_path?: string }> | undefined) ?? [];
  return list.map((item) => String(item.relative_path ?? '')).filter(Boolean);
}
