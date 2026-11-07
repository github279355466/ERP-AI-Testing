import fs from 'node:fs';
import path from 'node:path';
import { validateBundleSchemas } from './schema';
import { Evidence, KnowledgeBundle, Rule, Scenario } from './types';

export interface ValidationIssue {
  code: string;
  severity: 'ERROR' | 'WARN';
  object_type: string;
  object_id: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  checked: {
    documents: number;
    entities: number;
    fields: number;
    rules: number;
    scenarios: number;
    dependencies: number;
    evidence: number;
  };
}

export interface ValidationOptions {
  /** 原始 PRD 根目录，用于逐字比对 excerpt */
  sourceRoot?: string | null;
  /** 明确规则必须带可定位证据（行号） */
  requireEvidenceForExplicitRules?: boolean;
  /** 场景必须带可观察断言（Phase 1 无 UI 证据时保持 NEEDS_UI_EXPLORATION） */
  requireObservableAssertions?: boolean;
  /** 使用 schemas/ 下的正式 JSON Schema 校验全部对象 */
  validateSchemas?: boolean;
}

function isNonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasEvidence(rule: Rule): boolean {
  return rule.source_refs.some((ref) => isNonEmpty(ref.document_id) && isNonEmpty(ref.file_path));
}

function stripTruncation(text: string): string {
  return text.replace(/…+$/, '').trim();
}

class LineIndex {
  private readonly cache = new Map<string, string[] | null>();

  constructor(
    private readonly sourceRoot: string | null,
    private readonly documentPaths: Map<string, string> = new Map()
  ) {}

  lines(documentId: string, relativePath: string): string[] | null {
    if (this.cache.has(documentId)) return this.cache.get(documentId) ?? null;
    const candidates: string[] = [];
    const absolute = this.documentPaths.get(documentId);
    if (absolute) candidates.push(absolute);
    if (this.sourceRoot) {
      const root = path.resolve(this.sourceRoot);
      const file = path.resolve(root, relativePath);
      if (file.startsWith(root)) candidates.push(file);
    }
    let lines: string[] | null = null;
    for (const file of candidates) {
      if (!fs.existsSync(file)) continue;
      try {
        lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        break;
      } catch {
        lines = null;
      }
    }
    this.cache.set(documentId, lines);
    return lines;
  }
}

export function validateRule(
  rule: Rule,
  entityIds: Set<string>,
  options: ValidationOptions = {},
  lineIndex?: LineIndex
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: string, severity: 'ERROR' | 'WARN', message: string): void => {
    issues.push({ code, severity, object_type: 'Rule', object_id: rule.id, message });
  };
  if (!isNonEmpty(rule.id)) push('RULE_ID_MISSING', 'ERROR', '规则缺少 id');
  if (!isNonEmpty(rule.name)) push('RULE_NAME_MISSING', 'ERROR', '规则缺少 name');
  if (!isNonEmpty(rule.description)) push('RULE_DESCRIPTION_MISSING', 'ERROR', '规则缺少 description');
  if (!isNonEmpty(rule.rule_type)) push('RULE_TYPE_MISSING', 'ERROR', '规则缺少 rule_type');
  if (!isNonEmpty(rule.source_type)) push('RULE_SOURCE_TYPE_MISSING', 'ERROR', '规则缺少 source_type');
  if (!isNonEmpty(rule.confidence)) push('RULE_CONFIDENCE_MISSING', 'ERROR', '规则缺少 confidence');
  if (!hasEvidence(rule)) push('RULE_EVIDENCE_MISSING', 'ERROR', '规则缺少可定位的证据引用');
  if (rule.source_type === 'PRD_EXPLICIT') {
    if (rule.source_refs.every((ref) => !ref.line_start)) {
      push(
        'RULE_LINE_MISSING',
        options.requireEvidenceForExplicitRules === false ? 'WARN' : 'ERROR',
        '明确规则缺少行号定位'
      );
    }
    if (rule.source_refs.some((ref) => !ref.doc_version)) {
      push('RULE_SOURCE_REF_NO_VERSION', 'WARN', '证据引用未内嵌文档版本');
    }
    if (rule.confidence !== 'CONFIRMED') {
      push('RULE_EXPLICIT_NOT_CONFIRMED', 'ERROR', 'PRD_EXPLICIT 规则必须为 CONFIRMED');
    }
  }
  for (const entityId of rule.applies_to) {
    if (!entityIds.has(entityId)) {
      push('RULE_ENTITY_UNRESOLVED', 'ERROR', `规则引用了不存在的实体 ${entityId}`);
    }
  }
  if (lineIndex) {
    for (const ref of rule.source_refs) {
      if (ref.line_start == null || !ref.excerpt) continue;
      const lines = lineIndex.lines(ref.document_id, ref.file_path);
      if (!lines) continue;
      const raw = lines[ref.line_start - 1];
      if (raw === undefined) {
        push('RULE_EVIDENCE_LINE_OUT_OF_RANGE', 'ERROR', `证据行号 ${ref.line_start} 超出原文范围`);
        continue;
      }
      const line = raw.trim();
      const excerpt = stripTruncation(ref.excerpt);
      if (excerpt.length === 0) continue;
      if (!line.includes(excerpt)) {
        push(
          'RULE_EXCERPT_NOT_VERBATIM',
          'ERROR',
          `证据片段与原文第 ${ref.line_start} 行不逐字一致：excerpt=「${excerpt.slice(0, 60)}」`
        );
      }
    }
  }
  return issues;
}

export function validateScenario(scenario: Scenario, ruleById: Map<string, Rule> = new Map()): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: string, severity: 'ERROR' | 'WARN', message: string): void => {
    issues.push({ code, severity, object_type: 'Scenario', object_id: scenario.id, message });
  };
  if (scenario.status !== 'DRAFT') {
    push('SCENARIO_STATUS_NOT_DRAFT', 'ERROR', `场景初始状态必须为 DRAFT，当前 ${scenario.status}`);
  }
  if (scenario.rule_ids.length === 0) push('SCENARIO_RULE_MISSING', 'ERROR', '场景未引用任何规则');
  if (scenario.source_refs.length === 0) push('SCENARIO_EVIDENCE_MISSING', 'ERROR', '场景缺少来源证据');
  if (scenario.steps.length === 0) push('SCENARIO_STEPS_MISSING', 'WARN', '场景没有操作步骤草案');
  if (scenario.assertions.length === 0) {
    push('SCENARIO_ASSERTION_MISSING', 'WARN', '场景没有可观察断言，应标记 NEEDS_CONFIRMATION');
  }
  if (scenario.assertions.length === 0 && scenario.automation_feasibility !== 'NEEDS_CONFIRMATION') {
    push('SCENARIO_FEASIBILITY_MISMATCH', 'ERROR', '无断言的场景必须标记 NEEDS_CONFIRMATION');
  }
  const referenced = scenario.rule_ids.map((ruleId) => ruleById.get(ruleId)).filter((rule): rule is Rule => Boolean(rule));
  const platformOnly = referenced.length > 0 && referenced.every((rule) => rule.source_type === 'PLATFORM_SERVICE');
  const unconfirmed = referenced.some((rule) => rule.source_type !== 'PRD_EXPLICIT' || rule.confidence !== 'CONFIRMED');
  if (unconfirmed && !platformOnly && scenario.automation_feasibility !== 'NEEDS_CONFIRMATION') {
    push(
      'SCENARIO_DERIVED_NOT_CONFIRMED',
      'ERROR',
      '场景引用了非明确规则，但可行性未标记 NEEDS_CONFIRMATION'
    );
  }
  if (scenario.automation_feasibility === 'UI_READY') {
    push(
      'SCENARIO_UI_READY_UNVERIFIED',
      'ERROR',
      'Phase 1 未做页面验证，场景不得标记 UI_READY，应为 NEEDS_UI_EXPLORATION 或 NEEDS_CONFIRMATION'
    );
  }
  if (scenario.preconditions.some((item) => /可进入新增\/编辑页面/.test(item))) {
    push('SCENARIO_GENERIC_PRECONDITION', 'WARN', '前置条件为通用模板，未给出可复现数据准备步骤');
  }
  if ((scenario.test_objective ?? '').trim().length === 0) {
    push('SCENARIO_OBJECTIVE_MISSING', 'WARN', '场景缺少测试目标');
  }
  if ((scenario.expected_result ?? '').trim().length === 0) {
    push('SCENARIO_EXPECTED_RESULT_MISSING', 'WARN', '场景缺少预期结果');
  }
  return issues;
}

function validateEvidence(evidence: Evidence): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const push = (code: string, severity: 'ERROR' | 'WARN', message: string): void => {
    issues.push({ code, severity, object_type: 'Evidence', object_id: evidence.id, message });
  };
  if (!evidence.document_id) push('EVIDENCE_DOCUMENT_MISSING', 'ERROR', '证据缺少文档引用');
  if (!/^[a-f0-9]{64}$/i.test(evidence.sha256)) push('EVIDENCE_HASH_MISSING', 'ERROR', '证据缺少文档 SHA-256');
  if (evidence.doc_version == null) push('EVIDENCE_VERSION_UNKNOWN', 'WARN', '证据无法确定文档版本');
  if (evidence.line_start == null) push('EVIDENCE_LINE_MISSING', 'ERROR', '证据缺少行号定位');
  if (!evidence.excerpt) push('EVIDENCE_EXCERPT_MISSING', 'WARN', '证据缺少原文片段');
  else if (!evidence.verbatim) push('EVIDENCE_NOT_VERBATIM', 'WARN', '证据片段不是逐字原文');
  if (evidence.referenced_by.length === 0) push('EVIDENCE_ORPHAN', 'WARN', '证据未被任何知识对象引用');
  return issues;
}

export function validateKnowledgeBundle(bundle: KnowledgeBundle, options: ValidationOptions = {}): ValidationResult {
  const issues: ValidationIssue[] = [];
  const entityIds = new Set(bundle.entities.map((entity) => entity.id));
  const documentIds = new Set(bundle.documents.map((document) => document.id));
  const ruleById = new Map(bundle.rules.map((rule) => [rule.id, rule]));
  const lineIndex = new LineIndex(
    options.sourceRoot ?? null,
    new Map(bundle.documents.map((document) => [document.id, document.file_path]))
  );
  const seeIds = new Set<string>();
  const duplicate = (type: string, id: string): void => {
    const key = `${type}:${id}`;
    if (seeIds.has(key)) {
      issues.push({ code: 'DUPLICATE_ID', severity: 'ERROR', object_type: type, object_id: id, message: 'ID 重复' });
    }
    seeIds.add(key);
  };

  for (const document of bundle.documents) {
    duplicate('Document', document.id);
    if (!/^[a-f0-9]{64}$/i.test(document.sha256)) {
      issues.push({ code: 'DOCUMENT_HASH_INVALID', severity: 'ERROR', object_type: 'Document', object_id: document.id, message: 'sha256 格式非法' });
    }
    if (!isNonEmpty(document.relative_path)) {
      issues.push({ code: 'DOCUMENT_PATH_MISSING', severity: 'ERROR', object_type: 'Document', object_id: document.id, message: '缺少相对路径' });
    }
    if (document.is_latest && document.last_scan_status === 'SOURCE_MISSING') {
      issues.push({
        code: 'DOCUMENT_LATEST_SOURCE_MISSING',
        severity: 'ERROR',
        object_type: 'Document',
        object_id: document.id,
        message: '源文件缺失的文档不能作为最新版参与场景生成',
      });
    }
  }
  for (const entity of bundle.entities) {
    duplicate('Entity', entity.id);
    for (const documentId of entity.document_ids) {
      if (!documentIds.has(documentId)) {
        issues.push({ code: 'ENTITY_DOC_UNRESOLVED', severity: 'ERROR', object_type: 'Entity', object_id: entity.id, message: `实体引用了不存在的文档 ${documentId}` });
      }
    }
  }
  for (const field of bundle.fields) {
    duplicate('Field', field.id);
    if (!documentIds.has(field.document_id)) {
      issues.push({ code: 'FIELD_DOC_UNRESOLVED', severity: 'ERROR', object_type: 'Field', object_id: field.id, message: '字段引用了不存在的文档' });
    }
    if (field.entity_id && !entityIds.has(field.entity_id)) {
      issues.push({ code: 'FIELD_ENTITY_UNRESOLVED', severity: 'ERROR', object_type: 'Field', object_id: field.id, message: '字段引用了不存在的实体' });
    }
    if (!field.field_no) {
      issues.push({ code: 'FIELD_NO_MISSING', severity: 'WARN', object_type: 'Field', object_id: field.id, message: '字段缺少字段码' });
    }
  }
  for (const rule of bundle.rules) {
    duplicate('Rule', rule.id);
    issues.push(...validateRule(rule, entityIds, options, lineIndex));
  }
  for (const dependency of bundle.dependencies) {
    duplicate('Dependency', dependency.id);
    if (dependency.relation_type === 'CANDIDATE_LINK' && !dependency.target_id) {
      issues.push({
        code: 'DEPENDENCY_CANDIDATE_UNRESOLVED',
        severity: 'ERROR',
        object_type: 'Dependency',
        object_id: dependency.id,
        message: `候选关联缺少 target_id：${dependency.target_ref}`,
      });
    }
    if ((dependency.relation_type === 'DERIVED_FROM' || dependency.relation_type === 'GENERATES') && !dependency.target_id) {
      issues.push({
        code: 'DEPENDENCY_TARGET_UNRESOLVED',
        severity: 'WARN',
        object_type: 'Dependency',
        object_id: dependency.id,
        message: `明确上下游关系未解析到实体：${dependency.target_ref}`,
      });
    }
    if (dependency.relation_type === 'DERIVED_FROM' && !dependency.mapping) {
      issues.push({
        code: 'DEPENDENCY_MAPPING_MISSING',
        severity: 'WARN',
        object_type: 'Dependency',
        object_id: dependency.id,
        message: '取单关系缺少字段映射',
      });
    }
  }
  for (const scenario of bundle.scenarios) {
    duplicate('Scenario', scenario.id);
    issues.push(...validateScenario(scenario, ruleById));
  }
  for (const evidence of bundle.evidence ?? []) {
    duplicate('Evidence', evidence.id);
    issues.push(...validateEvidence(evidence));
  }
  if (options.validateSchemas) {
    issues.push(...validateBundleSchemas(bundle));
  }

  const errors = issues.filter((issue) => issue.severity === 'ERROR');
  const warnings = issues.filter((issue) => issue.severity === 'WARN');
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    checked: {
      documents: bundle.documents.length,
      entities: bundle.entities.length,
      fields: bundle.fields.length,
      rules: bundle.rules.length,
      scenarios: bundle.scenarios.length,
      dependencies: bundle.dependencies.length,
      evidence: bundle.evidence?.length ?? 0,
    },
  };
}
