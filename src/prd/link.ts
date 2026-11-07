import { entityId, questionId } from './ids';
import { CATEGORY_RULE_TYPES } from './cases';
import {
  Dependency,
  DocumentRecord,
  Entity,
  ExistingCaseRecord,
  Field,
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

function normalizeEntityLabel(label: string | null | undefined): string {
  return (label ?? '')
    .replace(/[`'"“”‘’]/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export interface EntityMergeResult {
  entities: Entity[];
  /** 被归并实体 ID -> 主实体 ID，供字段/规则/页面/关系重指向 */
  idMap: Map<string, string>;
}

export function mergeEntities(
  entities: Entity[],
  documents: DocumentRecord[] = [],
  fields: Field[] = []
): EntityMergeResult {
  const latestDocuments = new Set(documents.filter((item) => item.is_latest).map((item) => item.id));
  const parent = new Map<string, string>();
  const find = (key: string): string => {
    let current = key;
    while (parent.has(current) && parent.get(current) !== current) current = parent.get(current) as string;
    return current;
  };
  const union = (left: string, right: string): void => {
    const a = find(left);
    const b = find(right);
    if (a === b) return;
    parent.set(a, b);
  };
  const keysOf = (entity: Entity): string[] => {
    const keys = [`id:${entity.id}`];
    if (entity.entity_no) keys.push(`no:${entity.entity_no}`);
    const label = normalizeEntityLabel(entity.label ?? entity.name);
    if (label) keys.push(`label:${label}`);
    return keys;
  };
  for (const entity of entities) {
    const keys = keysOf(entity);
    for (const key of keys) {
      if (!parent.has(key)) parent.set(key, key);
      union(keys[0], key);
    }
  }
  // 零字段实体：若其全部文档的字段都归属唯一另一个实体，视为误建并归并
  const ownerByDocument = new Map<string, Set<string>>();
  const entityById = new Map(entities.map((item) => [item.id, item]));
  for (const field of fields) {
    const owner = field.entity_id ? entityById.get(field.entity_id) : undefined;
    if (!owner) continue;
    const set = ownerByDocument.get(field.document_id) ?? new Set<string>();
    set.add(find(`id:${owner.id}`));
    ownerByDocument.set(field.document_id, set);
  }
  for (const entity of entities) {
    if (entity.field_count > 0) continue;
    const owners = new Set<string>();
    for (const documentId of entity.document_ids) {
      for (const owner of ownerByDocument.get(documentId) ?? []) owners.add(owner);
    }
    if (owners.size !== 1) continue;
    const [owner] = [...owners];
    if (owner !== find(`id:${entity.id}`)) union(`id:${entity.id}`, owner);
  }
  const groups = new Map<string, Entity[]>();
  for (const entity of entities) {
    const root = find(`id:${entity.id}`);
    const list = groups.get(root) ?? [];
    list.push(entity);
    groups.set(root, list);
  }
  const idMap = new Map<string, string>();
  const merged: Entity[] = [];
  for (const list of groups.values()) {
    const score = (entity: Entity): number =>
      (entity.document_ids.some((id) => latestDocuments.has(id)) ? 1_000_000 : 0) + entity.field_count * 100 + entity.document_ids.length;
    const survivor = [...list].sort((left, right) => score(right) - score(left))[0];
    const result: Entity = {
      ...survivor,
      document_ids: [...new Set(list.flatMap((item) => item.document_ids))],
      field_count: list.reduce((sum, item) => sum + item.field_count, 0),
      page_count: list.reduce((sum, item) => sum + item.page_count, 0),
      rule_count: list.reduce((sum, item) => sum + item.rule_count, 0),
      superseded_entity_ids: [
        ...new Set([
          ...(survivor.superseded_entity_ids ?? []),
          ...list.filter((item) => item.id !== survivor.id).map((item) => item.id),
          ...list.flatMap((item) => item.superseded_entity_ids ?? []),
        ]),
      ].filter((id) => id !== survivor.id),
    };
    if (!result.parent_entity_no) {
      result.parent_entity_no = list.map((item) => item.parent_entity_no).find(Boolean) ?? null;
    }
    if (result.field_count > 0) {
      result.entity_kind = 'BUSINESS';
    } else if (/_(d|dtl|detail)$/i.test(result.entity_no ?? '')) {
      result.entity_kind = 'DETAIL';
    } else {
      result.entity_kind = 'HEADER_ONLY';
    }
    for (const item of list) idMap.set(item.id, survivor.id);
    merged.push(result);
  }
  merged.sort((left, right) => left.name.localeCompare(right.name, 'zh-CN'));
  return { entities: merged, idMap };
}

export function versionFromFileName(fileName: string): string | null {
  const prdNamed = /PRD[.\-_]v(\d+(?:\.\d+)*)/i.exec(fileName);
  if (prdNamed) return prdNamed[1];
  const docNamed = /_V(\d+(?:\.\d+)*)\.(?:md|markdown|txt)$/i.exec(fileName);
  return docNamed ? docNamed[1] : null;
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
    const formal = list.filter((item) => !/\/_(diff|upload|review)\//.test(item.relative_path));
    const versions = [...new Set(formal.map((item) => item.doc_version).filter((item): item is string => Boolean(item)))];
    if (versions.length < 2) continue;
    const sorted = [...versions].sort(compareVersions);
    const latest = sorted[sorted.length - 1];
    questions.push({
      id: questionId(`version:${key}`),
      object_type: 'OpenQuestion',
      question: `${key} 存在多个文档版本：${sorted.join(', ')}，候选最新版本为 v${latest}，需确认生效版本`,
      category: 'VERSION_CONFLICT',
      severity: 'HIGH',
      document_ids: formal.map((item) => item.id),
      evidence: formal.map((item) => `${item.relative_path} (v${item.doc_version ?? 'UNKNOWN'})`),
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
      const leftPresent = left.last_scan_status === 'SOURCE_MISSING' ? 0 : 1;
      const rightPresent = right.last_scan_status === 'SOURCE_MISSING' ? 0 : 1;
      if (leftPresent !== rightPresent) return leftPresent - rightPresent;
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
    if (winner.last_scan_status === 'SOURCE_MISSING') {
      for (const document of list) {
        document.is_latest = false;
        document.superseded_by = null;
        document.supersedes = [];
      }
      continue;
    }
    latest.add(winner.id);
    winner.supersedes = list.filter((item) => item.id !== winner.id).map((item) => item.id);
    winner.superseded_by = null;
    for (const document of list) {
      if (document.id === winner.id) continue;
      document.superseded_by = winner.id;
      document.supersedes = [];
    }
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
