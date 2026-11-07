import { entityId, questionId } from './ids';
import { CATEGORY_RULE_TYPES } from './cases';
import {
  Dependency,
  DocumentRecord,
  Entity,
  ExistingCaseRecord,
  OpenQuestion,
  PARSER_VERSION,
  Rule,
  Workflow,
} from './types';

export function compareVersions(left: string, right: string): number {
  const a = left.split('.').map((item) => Number(item) || 0);
  const b = right.split('.').map((item) => Number(item) || 0);
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    const x = a[index] ?? 0;
    const y = b[index] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}

export function mergeEntities(entities: Entity[]): Entity[] {
  const merged = new Map<string, Entity>();
  for (const entity of entities) {
    const key = entity.entity_no ?? entity.label;
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, { ...entity, document_ids: [...new Set(entity.document_ids)] });
      continue;
    }
    existing.document_ids = [...new Set([...existing.document_ids, ...entity.document_ids])];
    existing.field_count += entity.field_count;
    existing.page_count += entity.page_count;
    existing.rule_count += entity.rule_count;
    if (!existing.parent_entity_no && entity.parent_entity_no) existing.parent_entity_no = entity.parent_entity_no;
  }
  return [...merged.values()].sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
}

export function detectVersionConflicts(documents: DocumentRecord[], now: string): OpenQuestion[] {
  const groups = new Map<string, DocumentRecord[]>();
  for (const document of documents) {
    if (document.source_role !== 'PRD') continue;
    const key = document.job_directory || document.relative_path.split('/')[0];
    if (!key) continue;
    const list = groups.get(key) ?? [];
    list.push(document);
    groups.set(key, list);
  }
  const questions: OpenQuestion[] = [];
  for (const [key, list] of groups) {
    const versions = [...new Set(list.map((item) => item.doc_version).filter((item): item is string => Boolean(item)))];
    if (versions.length < 2) continue;
    const sorted = [...versions].sort(compareVersions);
    const latest = sorted[sorted.length - 1];
    questions.push({
      id: questionId(`version:${key}`),
      object_type: 'OpenQuestion',
      question: `${key} 存在多个文档版本：${sorted.join(', ')}，候选最新版本为 v${latest}，需确认生效版本`,
      category: 'VERSION_CONFLICT',
      severity: 'HIGH',
      document_ids: list.map((item) => item.id),
      evidence: list.map((item) => `${item.relative_path} (v${item.doc_version ?? 'UNKNOWN'})`),
      impact: '规则可能随版本变化，按旧版建模会产生过期断言',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
}

export function detectConflictingRules(
  rules: Rule[],
  entities: Entity[],
  now: string,
  latestDocumentIds: Set<string> = new Set()
): OpenQuestion[] {
  const entityNoById = new Map(entities.map((entity) => [entity.id, entity.entity_no ?? entity.label]));
  const groups = new Map<string, Map<string, Rule>>();
  for (const rule of rules) {
    if (!rule.field_no) continue;
    if (latestDocumentIds.size > 0 && !latestDocumentIds.has(rule.document_id)) continue;
    const filePath = rule.source_refs[0]?.file_path ?? '';
    if (/\/_(history|diff|review|upload)\//.test(filePath)) continue;
    const entityNo = rule.applies_to.map((id) => entityNoById.get(id)).find(Boolean) ?? '';
    if (!entityNo) continue;
    const key = `${entityNo}|${rule.field_no}|${rule.rule_type}`;
    const byDescription = groups.get(key) ?? new Map<string, Rule>();
    const descriptionKey = normalizeName(rule.description);
    if (!byDescription.has(descriptionKey)) byDescription.set(descriptionKey, rule);
    groups.set(key, byDescription);
  }
  const questions: OpenQuestion[] = [];
  for (const [key, byDescription] of groups) {
    if (byDescription.size < 2) continue;
    const candidates = [...byDescription.entries()];
    const list = candidates
      .filter(([descriptionKey]) =>
        !candidates.some(([otherKey]) => otherKey !== descriptionKey && otherKey.includes(descriptionKey))
      )
      .map(([, rule]) => rule);
    if (list.length < 2) continue;
    const [entityNo, fieldNo, ruleType] = key.split('|');
    const documentIds = [...new Set(list.map((item) => item.document_id))];
    const crossDocument = documentIds.length > 1;
    questions.push({
      id: questionId(`conflict-rule:${key}`),
      object_type: 'OpenQuestion',
      question: crossDocument
        ? `${entityNo || '未知实体'} 的字段 ${fieldNo} 在 ${documentIds.length} 份文档中存在 ${list.length} 种不同的 ${ruleType} 描述，需确认以哪份为准`
        : `${entityNo || '未知实体'} 的字段 ${fieldNo} 在同一文档内有 ${list.length} 种 ${ruleType} 表述，需确认是否等价`,
      category: 'RULE_CONFLICT',
      severity: crossDocument ? 'MEDIUM' : 'LOW',
      document_ids: documentIds,
      evidence: list.map((item) => `${item.source_refs[0]?.file_path ?? ''}:${item.source_refs[0]?.line_start ?? ''}`),
      impact: '同一字段同一类型规则存在冲突定义，断言口径不确定',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
}

export function detectBrokenFlows(
  dependencies: Dependency[],
  workflows: Workflow[],
  entities: Entity[],
  now: string,
  knownFieldNos: Set<string> = new Set()
): OpenQuestion[] {
  const known = new Set(entities.map((entity) => entity.entity_no).filter((item): item is string => Boolean(item)));
  const brokenByDoc = new Map<string, Dependency[]>();
  for (const dependency of dependencies) {
    const target = dependency.target_ref;
    if (known.has(target)) continue;
    if (knownFieldNos.has(target)) continue;
    if (!/^[a-z][a-z0-9_]*$/.test(target)) continue;
    const list = brokenByDoc.get(dependency.document_id) ?? [];
    list.push(dependency);
    brokenByDoc.set(dependency.document_id, list);
  }
  const questions: OpenQuestion[] = [];
  for (const [documentId, list] of brokenByDoc) {
    questions.push({
      id: questionId(`broken-flow:${documentId}`),
      object_type: 'OpenQuestion',
      question: `文档引用了未建模的上下游对象：${[...new Set(list.map((item) => item.target_ref))].slice(0, 5).join(', ')}`,
      category: 'BROKEN_FLOW',
      severity: 'LOW',
      document_ids: [documentId],
      evidence: list.slice(0, 5).map((item) => `${item.source_refs[0]?.file_path ?? ''}:${item.source_refs[0]?.line_start ?? ''}`),
      impact: '上下游链路不完整，流程类场景可能缺前置条件',
      suggested_owner: 'PRD 负责人',
      status: 'OPEN',
      created_at: now,
    });
  }
  const incomplete = workflows.filter((workflow) => workflow.steps.length < 2);
  for (const workflow of incomplete) {
    questions.push({
      id: questionId(`incomplete-workflow:${workflow.id}`),
      object_type: 'OpenQuestion',
      question: `${workflow.name} 识别到的流程步骤少于 2 个，需确认流程图是否缺失`,
      category: 'INCOMPLETE_STATE_MACHINE',
      severity: 'LOW',
      document_ids: [workflow.document_id],
      evidence: [workflow.source_refs[0]?.file_path ?? ''],
      impact: '无法生成端到端流程场景',
      suggested_owner: 'PRD 作者',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
}

export interface CoverageResult {
  covered_rule_ids: Set<string>;
  case_ids_by_rule: Map<string, string[]>;
  covered_by_category: Map<string, number>;
  unmatched_cases: string[];
  matched_case_ids: Set<string>;
  considered_rule_ids: Set<string>;
  rules_considered: number;
}

export function markLatestDocuments(documents: DocumentRecord[], fieldDocumentIds: Set<string>): Set<string> {
  const groups = new Map<string, DocumentRecord[]>();
  for (const document of documents) {
    if (document.source_role !== 'PRD') {
      document.is_latest = false;
      continue;
    }
    const key = document.job_directory || document.relative_path.split('/')[0];
    const list = groups.get(key) ?? [];
    list.push(document);
    groups.set(key, list);
  }
  const latest = new Set<string>();
  for (const [, list] of groups) {
    const withFields = list.filter((document) => fieldDocumentIds.has(document.id));
    if (withFields.length === 0) {
      for (const document of list) document.is_latest = false;
      continue;
    }
    const pool = withFields;
    const sorted = [...pool].sort((left, right) => {
      const versionCompare = compareVersions(left.doc_version ?? '0', right.doc_version ?? '0');
      if (versionCompare !== 0) return versionCompare;
      const dateCompare = (left.doc_date ?? '').localeCompare(right.doc_date ?? '');
      if (dateCompare !== 0) return dateCompare;
      const leftAux = /\/_(history|diff|review|upload)\//.test(left.relative_path) ? 0 : 1;
      const rightAux = /\/_(history|diff|review|upload)\//.test(right.relative_path) ? 0 : 1;
      return leftAux - rightAux;
    });
    const winner = sorted[sorted.length - 1];
    if (!winner) continue;
    latest.add(winner.id);
    for (const document of list) document.is_latest = document.id === winner.id;
  }
  return latest;
}

export function computeCoverage(
  rules: Rule[],
  existingCases: ExistingCaseRecord[],
  entities: Entity[]
): CoverageResult {
  const coveredRuleIds = new Set<string>();
  const caseIdsByRule = new Map<string, string[]>();
  const coveredByCategory = new Map<string, number>();
  const unmatchedCases: string[] = [];
  const matchedCaseIds = new Set<string>();
  const entityNoById = new Map(entities.map((entity) => [entity.id, entity.entity_no]));
  const consideredRuleIds = new Set(rules.map((rule) => rule.id));

  for (const testCase of existingCases) {
    const ruleTypes = CATEGORY_RULE_TYPES[testCase.category] ?? [];
    const fieldNos = new Set([
      ...(testCase.field_nos ?? []),
      ...(testCase.field_no ? [testCase.field_no] : []),
    ]);
    const fieldLabel = testCase.field ?? null;
    if ((fieldNos.size === 0 && !fieldLabel) || ruleTypes.length === 0) {
      unmatchedCases.push(testCase.case_id);
      continue;
    }
    const objectEntityNo = testCase.object_path ? testCase.object_path.split('.').pop() ?? null : null;
    const fieldKey = fieldLabel ? normalizeCaseField(fieldLabel) : null;
    const matched = rules.filter(
      (rule) =>
        ruleTypes.includes(rule.rule_type) &&
        (fieldNos.size > 0
          ? Boolean(rule.field_no && fieldNos.has(rule.field_no))
          : Boolean(rule.field_name && fieldKey && normalizeCaseField(rule.field_name) === fieldKey)) &&
        (!objectEntityNo ||
          rule.applies_to.length === 0 ||
          rule.applies_to.some((id) => entityNoById.get(id) === objectEntityNo))
    );
    if (matched.length === 0) {
      unmatchedCases.push(testCase.case_id);
      continue;
    }
    for (const rule of matched) {
      coveredRuleIds.add(rule.id);
      const list = caseIdsByRule.get(rule.id) ?? [];
      list.push(testCase.case_id);
      caseIdsByRule.set(rule.id, list);
    }
    matchedCaseIds.add(testCase.case_id);
    coveredByCategory.set(testCase.category, (coveredByCategory.get(testCase.category) ?? 0) + 1);
  }
  return {
    covered_rule_ids: coveredRuleIds,
    case_ids_by_rule: caseIdsByRule,
    covered_by_category: coveredByCategory,
    unmatched_cases: unmatchedCases,
    matched_case_ids: matchedCaseIds,
    considered_rule_ids: consideredRuleIds,
    rules_considered: rules.length,
  };
}

export function normalizeCaseField(field: string): string {
  return field
    .replace(/[\s（）()【】\[\]：:]/g, '')
    .replace(/(编号|单号)$/u, '')
    .toLowerCase();
}

export function normalizeName(text: string): string {
  return text
    .replace(/\.(md|markdown|json)$/i, '')
    .replace(/PRD[.\-_]?v?\d+(\.\d+)*.*$/i, '')
    .replace(/[\s（）()【】\-—_]/g, '')
    .toLowerCase();
}

export function rebuildEntityIndex(entities: Entity[]): Entity[] {
  return entities.map((entity) => ({ ...entity, id: entityId(entity.entity_no ?? entity.label) }));
}
