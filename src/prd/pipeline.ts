import fs from 'node:fs';
import path from 'node:path';
import { PrdModelingConfig } from './config';
import { extractCaseLibrary } from './cases';
import { extractPrdDocument } from './extract';
import {
  computeCoverage,
  CoverageResult,
  detectBrokenFlows,
  detectConflictingRules,
  detectVersionConflicts,
  markLatestDocuments,
  mergeEntities,
} from './link';
import { renderAllReports } from './reports';
import { generateScenarios } from './scenarios';
import { scanSources, ScanResult, writeScanState } from './scanner';
import { KnowledgeBundle, PARSER_VERSION, SCHEMA_VERSION } from './types';
import { validateKnowledgeBundle, ValidationResult } from './validate';

export interface PipelineResult {
  bundle: KnowledgeBundle;
  scan: ScanResult;
  validation: ValidationResult;
  coverage: CoverageResult;
  outputs: {
    knowledge_dir: string;
    report_dir: string;
    source_index_dir: string;
    files: string[];
  };
}

interface CacheEnvelope {
  parser_version: string;
  sha256: string;
  extracted_at: string;
  payload: unknown;
}

function cacheDir(config: PrdModelingConfig): string {
  return path.join(config.output.sourceIndexDir, '.parse-cache');
}

function readCache(config: PrdModelingConfig, documentId: string, sha256: string): unknown | null {
  const file = path.join(cacheDir(config), `${documentId}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const envelope = JSON.parse(fs.readFileSync(file, 'utf8')) as CacheEnvelope;
    if (envelope.parser_version !== PARSER_VERSION || envelope.sha256 !== sha256) return null;
    return envelope.payload;
  } catch {
    return null;
  }
}

function writeCache(config: PrdModelingConfig, documentId: string, sha256: string, payload: unknown, now: string): void {
  fs.mkdirSync(cacheDir(config), { recursive: true });
  const envelope: CacheEnvelope = { parser_version: PARSER_VERSION, sha256, extracted_at: now, payload };
  fs.writeFileSync(path.join(cacheDir(config), `${documentId}.json`), JSON.stringify(envelope), 'utf8');
}

function ensureDir(directory: string): void {
  fs.mkdirSync(directory, { recursive: true });
}

function writeJson(filePath: string, value: unknown): void {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function buildKnowledge(
  config: PrdModelingConfig,
  mode: 'FULL' | 'INCREMENTAL',
  options: { useCache?: boolean } = {}
): PipelineResult {
  const now = new Date().toISOString();
  const scan = scanSources(config, mode);
  const useCache = options.useCache ?? mode === 'INCREMENTAL';
  const supported = scan.files.filter((file) => file.supported);
  const skippedAuxiliary = supported
    .filter((file) => file.role === 'TEST_CASE_LIBRARY' && !/test-cases\.json$/i.test(file.file_name))
    .map((file) => file.relative_path);

  const documents = [];
  const entities = [];
  const pages = [];
  const fields = [];
  const controls = [];
  const rules = [];
  const actions = [];
  const workflows = [];
  const dependencies = [];
  const openQuestions = [];
  const issues = [];
  const existingCases = [];

  for (const file of supported) {
    if (file.role === 'TEST_CASE_LIBRARY') {
      const extracted = extractCaseLibrary(file, now);
      if (!extracted) continue;
      documents.push(extracted.document);
      existingCases.push(...extracted.cases);
      issues.push(...extracted.issues);
      continue;
    }
    let extraction = useCache && file.status === 'UNCHANGED'
      ? (readCache(config, file.document_id, file.sha256) as ReturnType<typeof extractPrdDocument> | null)
      : null;
    if (!extraction) {
      extraction = extractPrdDocument(file, config, now);
      writeCache(config, file.document_id, file.sha256, extraction, now);
    }
    extraction.document.last_scan_status = file.status;
    documents.push(extraction.document);
    entities.push(...extraction.entities);
    pages.push(...extraction.pages);
    fields.push(...extraction.fields);
    controls.push(...extraction.controls);
    rules.push(...extraction.rules);
    actions.push(...extraction.actions);
    workflows.push(...extraction.workflows);
    dependencies.push(...extraction.dependencies);
    openQuestions.push(...extraction.openQuestions);
    issues.push(...extraction.issues);
  }

  const mergedEntities = mergeEntities(entities);
  const latestDocumentIds = markLatestDocuments(documents, new Set(fields.map((field) => field.document_id)));
  const knownFieldNos = new Set(fields.map((field) => field.field_no).filter((item): item is string => Boolean(item)));
  const allQuestions = [
    ...openQuestions,
    ...detectVersionConflicts(documents, now),
    ...detectConflictingRules(rules, mergedEntities, now, latestDocumentIds),
    ...detectBrokenFlows(dependencies, workflows, mergedEntities, now, knownFieldNos),
  ];
  for (const issue of issues) {
    allQuestions.push({
      id: `OQ-PARSE-${issue.document_id ?? 'UNKNOWN'}-${issues.indexOf(issue)}`,
      object_type: 'OpenQuestion',
      question: `解析失败：${issue.message}`,
      category: 'PARSE_ERROR',
      severity: 'HIGH',
      document_ids: issue.document_id ? [issue.document_id] : [],
      evidence: [`${issue.file_path}${issue.line ? `:${issue.line}` : ''}`],
      impact: '该文档部分或全部知识未进入模型',
      suggested_owner: 'PRD 作者 / 平台',
      status: 'OPEN',
      created_at: now,
    });
  }

  const bundle: KnowledgeBundle = {
    documents,
    entities: mergedEntities,
    pages,
    fields,
    controls,
    rules,
    actions,
    workflows,
    dependencies,
    scenarios: [],
    existingCases,
    openQuestions: allQuestions,
    issues,
    scan: { ...scan.summary, parse_errors: issues.length },
  };
  bundle.scenarios = generateScenarios(bundle, latestDocumentIds);

  const validation = validateKnowledgeBundle(bundle);
  const latestRules = bundle.rules.filter((rule) => latestDocumentIds.has(rule.document_id));
  const coverage = computeCoverage(latestRules, bundle.existingCases, bundle.entities);

  const knowledgeDir = config.output.knowledgeDir;
  const reports = renderAllReports(
    bundle,
    validation,
    coverage,
    scan.unsupported.map((file) => file.relative_path),
    skippedAuxiliary
  );
  const written: string[] = [];

  const knowledgeFiles: Array<[string, unknown]> = [
    ['documents.json', bundle.documents],
    ['entities.json', bundle.entities],
    ['pages.json', bundle.pages],
    ['fields.json', bundle.fields],
    ['controls.json', bundle.controls],
    ['rules.json', bundle.rules],
    ['actions.json', bundle.actions],
    ['workflows.json', bundle.workflows],
    ['dependencies.json', bundle.dependencies],
    ['scenarios.json', bundle.scenarios],
    ['existing-cases.json', bundle.existingCases],
    ['open-questions.json', bundle.openQuestions],
  ];
  for (const [name, value] of knowledgeFiles) {
    const target = path.join(knowledgeDir, name);
    writeJson(target, value);
    written.push(target);
  }

  const covered = bundle.rules.filter((rule) => coverage.covered_rule_ids.has(rule.id)).length;
  const summary = {
    schema_version: SCHEMA_VERSION,
    parser_version: PARSER_VERSION,
    generated_at: now,
    mode: bundle.scan.mode,
    source_root: bundle.scan.source_root,
    counts: {
      documents: bundle.documents.length,
      prd_documents: bundle.documents.filter((document) => document.source_role === 'PRD').length,
      test_case_documents: bundle.documents.filter((document) => document.source_role === 'TEST_CASE_LIBRARY').length,
      entities: bundle.entities.length,
      pages: bundle.pages.length,
      fields: bundle.fields.length,
      controls: bundle.controls.length,
      rules: bundle.rules.length,
      actions: bundle.actions.length,
      workflows: bundle.workflows.length,
      dependencies: bundle.dependencies.length,
      scenarios: bundle.scenarios.length,
      existing_cases: bundle.existingCases.length,
      open_questions: bundle.openQuestions.length,
      parse_issues: bundle.issues.length,
    },
    validation: {
      valid: validation.valid,
      errors: validation.errors.length,
      warnings: validation.warnings.length,
    },
    coverage: {
      rules: coverage.rules_considered,
      covered_by_existing_cases: covered,
      rate: coverage.rules_considered === 0 ? 0 : Number((covered / coverage.rules_considered).toFixed(4)),
    },
  };
  writeJson(path.join(knowledgeDir, 'summary.json'), summary);
  written.push(path.join(knowledgeDir, 'summary.json'));

  ensureDir(config.output.reportDir);
  for (const [name, content] of Object.entries(reports)) {
    const target = name === 'scan-report.md'
      ? path.join(config.output.sourceIndexDir, name)
      : path.join(config.output.reportDir, name);
    ensureDir(path.dirname(target));
    fs.writeFileSync(target, content, 'utf8');
    written.push(target);
  }

  writeJson(path.join(config.output.sourceIndexDir, 'DOCUMENT_REGISTER.json'), {
    generated_at: now,
    mode: bundle.scan.mode,
    source_root: bundle.scan.source_root,
    summary: bundle.scan,
    documents: bundle.documents.map((document) => ({
      document_id: document.id,
      relative_path: document.relative_path,
      file_name: document.file_name,
      sha256: document.sha256,
      size_bytes: document.size_bytes,
      modified_at: document.modified_at,
      title: document.title,
      module: document.module,
      doc_version: document.doc_version,
      doc_date: document.doc_date,
      biz_model_no: document.biz_model_no,
      application: document.application,
      source_role: document.source_role,
      parser: document.parser,
      status: document.last_scan_status,
      section_count: document.section_count,
      table_count: document.table_count,
    })),
  });
  written.push(path.join(config.output.sourceIndexDir, 'DOCUMENT_REGISTER.json'));

  writeScanState(config, scan.state);

  return {
    bundle,
    scan,
    validation,
    coverage,
    outputs: {
      knowledge_dir: knowledgeDir,
      report_dir: config.output.reportDir,
      source_index_dir: config.output.sourceIndexDir,
      files: written,
    },
  };
}
