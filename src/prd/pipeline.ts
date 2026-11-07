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
  versionFromFileName,
} from './link';
import { buildEntityRelations, buildMasterDataRelations, buildRelationQuestions } from './relations';
import { buildEvidence } from './evidence';
import { renderAllReports } from './reports';
import { generateScenarios } from './scenarios';
import { scanSources, ScanResult, writeScanState } from './scanner';
import { KnowledgeBundle, OpenQuestion, PARSER_VERSION, SCHEMA_VERSION } from './types';
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

function buildSourceQuestions(
  documents: KnowledgeBundle['documents'],
  rules: KnowledgeBundle['rules'],
  scan: ScanResult,
  now: string
): KnowledgeBundle['openQuestions'] {
  const questions: KnowledgeBundle['openQuestions'] = [];
  const ruleCount = new Map<string, number>();
  for (const rule of rules) ruleCount.set(rule.document_id, (ruleCount.get(rule.document_id) ?? 0) + 1);

  for (const document of documents) {
    if (document.source_role !== 'PRD') continue;
    const fileNameVersion = versionFromFileName(document.file_name);
    if (fileNameVersion && document.doc_version && fileNameVersion !== document.doc_version) {
      questions.push({
        id: `OQ-SRC-CONFLICT-${document.id}`,
        object_type: 'OpenQuestion' as const,
        question: `${document.title} 文件名版本 v${fileNameVersion} 与正文元数据版本 v${document.doc_version} 不一致，需确认以哪个为准`,
        category: 'SOURCE_CONFLICT',
        severity: 'HIGH',
        document_ids: [document.id],
        evidence: [`${document.relative_path}:1`],
        impact: '版本判定与最新版选择可能错误，进而影响规则生效范围',
        suggested_owner: 'PRD 负责人',
        status: 'OPEN',
        created_at: now,
      });
    }
    if (document.is_latest && (ruleCount.get(document.id) ?? 0) === 0) {
      questions.push({
        id: `OQ-NO-RULE-${document.id}`,
        object_type: 'OpenQuestion' as const,
        question: `${document.title} 未抽取到任何规则，需确认是章节缺失、格式不识别，还是本作业确实不含规则`,
        category: 'MISSING_EVIDENCE',
        severity: 'MEDIUM',
        document_ids: [document.id],
        evidence: [document.relative_path],
        impact: '该作业无法生成任何可断言场景',
        suggested_owner: 'PRD 作者',
        status: 'OPEN',
        created_at: now,
      });
    }
  }

  const byHash = new Map<string, KnowledgeBundle['documents']>();
  for (const document of documents) {
    if (document.source_role !== 'PRD') continue;
    const list = byHash.get(document.sha256) ?? [];
    list.push(document);
    byHash.set(document.sha256, list);
  }
  for (const [hash, list] of byHash) {
    if (list.length < 2) continue;
    questions.push({
      id: `OQ-DUP-${hash.slice(0, 12)}`,
      object_type: 'OpenQuestion' as const,
      question: `${list.length} 份 PRD 内容完全相同（SHA-256 相同），需确认保留哪一份作为权威来源`,
      category: 'DUPLICATE_SOURCE',
      severity: 'LOW',
      document_ids: list.map((item) => item.id),
      evidence: list.map((item) => item.relative_path),
      impact: '重复内容会放大规则数量，并在冲突检测中产生噪声',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }

  for (const file of scan.unsupported) {
    questions.push({
      id: `OQ-UNSUPPORTED-${file.document_id}`,
      object_type: 'OpenQuestion' as const,
      question: `文件 ${file.relative_path} 的格式 ${file.extension} 当前未实现解析器，未纳入建模`,
      category: 'UNSUPPORTED_FORMAT',
      severity: 'MEDIUM',
      document_ids: [],
      evidence: [file.relative_path],
      impact: '该文件的业务规则不会进入知识库',
      suggested_owner: '平台',
      status: 'OPEN',
      created_at: now,
    });
  }

  const explicitWithService = rules.filter(
    (rule) => rule.source_type === 'PRD_EXPLICIT' && (rule.service_refs?.length ?? 0) > 0
  );
  if (explicitWithService.length > 0) {
    questions.push({
      id: 'OQ-SVC-EXPLICIT-CALIBER',
      object_type: 'OpenQuestion' as const,
      question: `${explicitWithService.length} 条 PRD_EXPLICIT 规则的描述中引用了平台服务（开窗/默认值/只读/必填），需确认按「字段行为」还是「平台服务契约」归类`,
      category: 'MISSING_DEFINITION',
      severity: 'LOW',
      document_ids: [...new Set(explicitWithService.map((rule) => rule.document_id))],
      evidence: explicitWithService
        .slice(0, 3)
        .map((rule) => `${rule.source_refs[0]?.file_path ?? ''}:${rule.source_refs[0]?.line_start ?? ''}`),
      impact: '影响 source_type 统计口径与场景可执行性判定，当前按「字段行为」保留 PRD_EXPLICIT',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }

  return questions;
}

function buildDependencyQuestions(
  dependencies: KnowledgeBundle['dependencies'],
  now: string
): KnowledgeBundle['openQuestions'] {
  const byDocument = new Map<string, KnowledgeBundle['dependencies']>();
  for (const dependency of dependencies) {
    if (dependency.target_id) continue;
    const list = byDocument.get(dependency.document_id) ?? [];
    list.push(dependency);
    byDocument.set(dependency.document_id, list);
  }
  const questions: KnowledgeBundle['openQuestions'] = [];
  for (const [documentId, list] of byDocument) {
    const refs = [...new Set(list.map((item) => item.target_ref))];
    questions.push({
      id: `OQ-DEP-UNRESOLVED-${documentId}`,
      object_type: 'OpenQuestion' as const,
      question: `${list.length} 条依赖的目标未解析为实体或字段，需确认其含义：${refs.slice(0, 8).join('、')}`,
      category: 'MISSING_DEFINITION',
      severity: 'LOW',
      document_ids: [documentId],
      evidence: list.slice(0, 5).map((item) => `${item.source_refs[0]?.file_path ?? ''}:${item.source_refs[0]?.line_start ?? ''}`),
      impact: '上下游 DAG 存在悬空边，流程类场景可能缺前置条件',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
}

function buildExclusionQuestions(
  documents: KnowledgeBundle['documents'],
  fields: KnowledgeBundle['fields'],
  rules: KnowledgeBundle['rules'],
  now: string
): KnowledgeBundle['openQuestions'] {
  const questions: KnowledgeBundle['openQuestions'] = [];
  const fieldDocs = new Set(fields.map((field) => field.document_id));
  const ruleDocs = new Set(rules.map((rule) => rule.document_id));
  for (const document of documents) {
    if (document.source_role !== 'PRD') continue;
    const hasKnowledge = fieldDocs.has(document.id) || ruleDocs.has(document.id);
    if (hasKnowledge) continue;
    const reason = !document.job_directory
      ? '根级文档未归入任何作业目录'
      : /\/_(diff|history|review|upload)\//.test(document.relative_path)
        ? '历史/差异文档，仅登记不建模'
        : '未识别到字段或规则';
    questions.push({
      id: `OQ-EXCLUDED-${document.id}`,
      object_type: 'OpenQuestion' as const,
      question: `${document.relative_path} 未参与建模：${reason}`,
      category: 'EXCLUDED_SOURCE',
      severity: !document.job_directory ? 'MEDIUM' : 'LOW',
      document_ids: [document.id],
      evidence: [document.relative_path],
      impact: '该文档内容不会进入规则与场景，需确认是否为有效需求来源',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
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
  if (config.policy.allowErpConnectionInPhase1) {
    throw new Error('Phase 1 禁止连接 ERP：allowErpConnectionInPhase1 必须为 false');
  }
  if (config.policy.allowExternalModelCalls) {
    throw new Error('Phase 1 禁止外部模型调用：allowExternalModelCalls 必须为 false');
  }
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
  const openQuestions: KnowledgeBundle['openQuestions'] = [];
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

  for (const entry of scan.missing) {
    const cached = readCache(config, entry.document_id, entry.sha256) as ReturnType<typeof extractPrdDocument> | null;
    if (!cached) {
      issues.push({
        file_path: entry.document_id,
        document_id: entry.document_id,
        parser: 'cache',
        stage: 'restore',
        message: '源文件已缺失且无可用解析缓存，历史知识无法恢复',
        line: null,
      });
      continue;
    }
    cached.document.last_scan_status = 'SOURCE_MISSING';
    cached.document.status = 'MISSING_SOURCE';
    documents.push(cached.document);
    entities.push(...cached.entities);
    pages.push(...cached.pages);
    fields.push(...cached.fields);
    controls.push(...cached.controls);
    rules.push(...cached.rules);
    actions.push(...cached.actions);
    workflows.push(...cached.workflows);
    dependencies.push(...cached.dependencies);
    openQuestions.push({
      id: `OQ-SRC-MISSING-${entry.document_id}`,
      object_type: 'OpenQuestion',
      question: `源文件已缺失，${cached.document.title} 的历史解析结果被保留但不再更新`,
      category: 'SOURCE_MISSING',
      severity: 'HIGH',
      document_ids: [entry.document_id],
      evidence: [cached.document.relative_path],
      impact: '该文档知识可能已过时，场景与依赖需人工复核',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }

  const mergedEntities = mergeEntities(entities);
  const latestDocumentIds = markLatestDocuments(documents, new Set(fields.map((field) => field.document_id)));
  const knownFieldNos = new Set(fields.map((field) => field.field_no).filter((item): item is string => Boolean(item)));
  const relationQuestions: OpenQuestion[] = [];
  const relationDependencies = [
    ...buildEntityRelations(documents, mergedEntities, now, relationQuestions),
    ...buildMasterDataRelations(documents, mergedEntities, now),
  ];
  dependencies.push(...relationDependencies);
  const entityNoById = new Map(mergedEntities.filter((item) => item.entity_no).map((item) => [item.entity_no!, item]));
  for (const dependency of dependencies) {
    if (dependency.target_id) continue;
    const apiMatch = /^bm\.([a-z][a-z0-9_]*)\./i.exec(dependency.target_ref);
    const baseRef = dependency.target_ref.replace(/_(d|h|\d{3})$/i, '');
    const target =
      entityNoById.get(dependency.target_ref) ??
      (apiMatch ? entityNoById.get(apiMatch[1]) : undefined) ??
      entityNoById.get(baseRef);
    if (!target) continue;
    dependency.target_id = target.id;
    if (apiMatch || dependency.target_ref.endsWith('_d') || /_\d{3}$/.test(dependency.target_ref)) {
      dependency.relation_type = 'USES_MASTER_DATA';
      dependency.source_type = 'PLATFORM_SERVICE';
      dependency.confidence = 'CONFIRMED';
      dependency.mapping = null;
    }
  }
  const allQuestions = [
    ...openQuestions,
    ...detectVersionConflicts(documents, now),
    ...detectConflictingRules(rules, mergedEntities, now, latestDocumentIds),
    ...detectBrokenFlows(dependencies, workflows, mergedEntities, now, knownFieldNos),
    ...relationQuestions,
    ...buildRelationQuestions(documents, relationDependencies, now),
    ...buildSourceQuestions(documents, rules, scan, now),
    ...buildDependencyQuestions(dependencies, now),
    ...buildExclusionQuestions(documents, fields, rules, now),
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
  const questionsByLocation = new Map<string, string[]>();
  for (const question of allQuestions) {
    for (const evidence of question.evidence) {
      const match = /^(.*):(\d+)$/.exec(evidence);
      if (!match) continue;
      const key = `${match[1]}:${match[2]}`;
      const list = questionsByLocation.get(key) ?? [];
      if (!list.includes(question.id)) list.push(question.id);
      questionsByLocation.set(key, list);
    }
  }
  for (const rule of rules) {
    const ref = rule.source_refs[0];
    if (!ref || ref.line_start == null) continue;
    rule.open_question_ids = questionsByLocation.get(`${ref.file_path}:${ref.line_start}`) ?? [];
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
    evidence: [],
    issues,
    scan: { ...scan.summary, parse_errors: issues.length },
  };
  const allObjects: Array<{ schema_version?: string }> = [
    ...bundle.documents,
    ...bundle.entities,
    ...bundle.pages,
    ...bundle.fields,
    ...bundle.controls,
    ...bundle.rules,
    ...bundle.actions,
    ...bundle.workflows,
    ...bundle.dependencies,
    ...bundle.existingCases,
    ...bundle.openQuestions,
  ];
  for (const item of allObjects) {
    if (!item.schema_version) item.schema_version = SCHEMA_VERSION;
  }
  const latestRules = bundle.rules.filter((rule) => latestDocumentIds.has(rule.document_id));
  const coverage = computeCoverage(latestRules, bundle.existingCases, bundle.entities);
  const ruleIdsByCase = new Map<string, string[]>();
  for (const [ruleId, caseIds] of coverage.case_ids_by_rule) {
    for (const caseId of caseIds) {
      const list = ruleIdsByCase.get(caseId) ?? [];
      list.push(ruleId);
      ruleIdsByCase.set(caseId, list);
    }
  }
  for (const testCase of bundle.existingCases) {
    testCase.rule_ids = [...new Set(ruleIdsByCase.get(testCase.case_id) ?? [])];
  }
  bundle.scenarios = generateScenarios(bundle, latestDocumentIds, 12000, coverage.case_ids_by_rule);
  bundle.evidence = buildEvidence(bundle, now);

  const validation = validateKnowledgeBundle(bundle, {
    sourceRoot: config.prd.inputDir,
    requireEvidenceForExplicitRules: config.policy.requireEvidenceForExplicitRules,
    validateSchemas: true,
  });

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
    ['evidence.json', bundle.evidence],
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
      evidence: bundle.evidence.length,
      parse_issues: bundle.issues.length,
    },
    scan: bundle.scan,
    validation_codes: {
      errors: [...new Set(validation.errors.map((issue) => issue.code))].sort(),
      warnings: [...new Set(validation.warnings.map((issue) => issue.code))].sort(),
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
    modeled_document_count: bundle.documents.length,
    scanned_file_count: scan.files.length,
    documents: bundle.documents.map((document) => ({
      document_id: document.id,
      relative_path: document.relative_path,
      file_name: document.file_name,
      sha256: document.sha256,
      size_bytes: document.size_bytes,
      modified_at: document.modified_at,
      scanned_at: document.scanned_at,
      title: document.title,
      module: document.module,
      business_object: document.business_object,
      doc_version: document.doc_version ?? 'UNKNOWN',
      doc_version_raw: document.doc_version,
      doc_date: document.doc_date,
      doc_status: document.doc_status ?? 'UNKNOWN',
      biz_model_no: document.biz_model_no,
      application: document.application,
      source_role: document.source_role,
      parser: document.parser,
      created_by_parser_version: document.created_by_parser_version,
      status: document.last_scan_status,
      is_latest: document.is_latest,
      supersedes: document.supersedes,
      superseded_by: document.superseded_by,
      related_document_ids: document.related_document_ids,
      section_count: document.section_count,
      table_count: document.table_count,
    })),
    scanned_but_not_modeled: scan.files
      .filter(
        (file) =>
          !bundle.documents.some(
            (document) => document.relative_path === file.relative_path && document.source_role === file.role
          )
      )
      .map((file) => ({
        relative_path: file.relative_path,
        file_name: file.file_name,
        sha256: file.sha256,
        size_bytes: file.size_bytes,
        scanned_at: scan.summary.scanned_at,
        source_role: file.role,
        reason:
          file.role === 'TEST_CASE_LIBRARY'
            ? '用例库辅助文件（断言/逻辑模型/待确认/自检/索引/README），当前阶段只登记不建模'
            : '未参与建模（无字段或解析器未覆盖）',
      })),
    unsupported_files: scan.unsupported.map((file) => ({
      relative_path: file.relative_path,
      extension: file.extension,
      sha256: file.sha256,
      scanned_at: scan.summary.scanned_at,
      unsupported_reason: file.unsupported_reason,
      reason:
        file.unsupported_reason === 'RESERVED_FORMAT'
          ? `预留格式 ${file.extension}：已登记，Phase 1 未实现解析器`
          : `扩展名 ${file.extension} 不在 includeExtensions，未纳入扫描`,
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
