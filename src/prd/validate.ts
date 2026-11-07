import { KnowledgeBundle, Rule, Scenario } from './types';

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
  };
}

function isNonEmpty(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasEvidence(rule: Rule): boolean {
  return rule.source_refs.some((ref) => isNonEmpty(ref.document_id) && isNonEmpty(ref.file_path));
}

export function validateRule(rule: Rule, entityIds: Set<string>): ValidationIssue[] {
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
  if (rule.source_type === 'PRD_EXPLICIT' && rule.source_refs.every((ref) => !ref.line_start)) {
    push('RULE_LINE_MISSING', 'WARN', '明确规则缺少行号定位');
  }
  for (const entityId of rule.applies_to) {
    if (!entityIds.has(entityId)) {
      push('RULE_ENTITY_UNRESOLVED', 'ERROR', `规则引用了不存在的实体 ${entityId}`);
    }
  }
  return issues;
}

export function validateScenario(scenario: Scenario): ValidationIssue[] {
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
  return issues;
}

export function validateKnowledgeBundle(bundle: KnowledgeBundle): ValidationResult {
  const issues: ValidationIssue[] = [];
  const entityIds = new Set(bundle.entities.map((entity) => entity.id));
  const documentIds = new Set(bundle.documents.map((document) => document.id));
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
    issues.push(...validateRule(rule, entityIds));
  }
  for (const scenario of bundle.scenarios) {
    duplicate('Scenario', scenario.id);
    issues.push(...validateScenario(scenario));
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
    },
  };
}
