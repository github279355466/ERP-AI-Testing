import fs from 'node:fs';
import { dependencyId, questionId } from './ids';
import { PARSER_VERSION } from './types';
import type { Dependency, DocumentRecord, Entity, OpenQuestion, SourceRef } from './types';

const RELATION_DOC_NAMES = [
  '采购退货出库单',
  '采购退货单',
  '采购入库单',
  '采购到货单',
  '采购订单',
  '请购单',
  '询价单',
];

const SECTION_PATTERN = /取单|来源单据|来源类型|上下游|关联单据/;
const MASTER_DATA_API = /\bbm\.([a-z][a-z0-9_]*)\.([a-z][a-z0-9_]*)\b/gi;
/** 命中行及其相邻行出现否定表述时，不得建 PRD_EXPLICIT 关系 */
const NEGATION_PATTERN = /不提供|不作为|不适用|不生成|不含|无需|不支持|非来源|无需对齐|只作筛选|仅作筛选|不改变来源|不作为来源|仅当|只当|参考来源|若把|如果将|假如|改为/;
/** 排版/格式声明不属于来源关系证据 */
const FORMAT_DECLARATION = /五段式|重写样式|样式对齐|重写/;

interface RelationHit {
  targetName: string;
  line: number;
  text: string;
  explicit: boolean;
  negated: boolean;
  formatOnly: boolean;
}

function resolveEntity(entities: Entity[], name: string): Entity | null {
  return (
    entities.find((entity) => entity.label === name || entity.name === name) ??
    entities.find((entity) => (entity.label ?? '').includes(name) || (entity.name ?? '').includes(name)) ??
    null
  );
}

/** 排除「采购订单号」「采购订单编号」等字段名，只保留真正的单据引用 */
function mentionsDocument(text: string, name: string): boolean {
  let index = text.indexOf(name);
  while (index >= 0) {
    const next = text[index + name.length] ?? '';
    if (!/[号编]/.test(next)) return true;
    index = text.indexOf(name, index + name.length);
  }
  return false;
}

function readLines(document: DocumentRecord): string[] {
  try {
    return fs.readFileSync(document.file_path, 'utf8').split(/\r?\n/);
  } catch {
    return [];
  }
}

function sectionRanges(lines: string[]): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  let current: { start: number; level: number } | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const heading = /^(#{2,4})\s+(.+)$/.exec(line);
    if (!heading) continue;
    const level = heading[1].length;
    if (SECTION_PATTERN.test(heading[2])) {
      if (current) ranges.push({ start: current.start, end: index });
      current = { start: index, level };
      continue;
    }
    if (current && level <= current.level) {
      ranges.push({ start: current.start, end: index });
      current = null;
    }
  }
  if (current) ranges.push({ start: current.start, end: lines.length });
  return ranges;
}

function collectHits(document: DocumentRecord, lines: string[], selfName: string): RelationHit[] {
  const hits: RelationHit[] = [];
  for (const range of sectionRanges(lines)) {
    for (let index = range.start; index < Math.min(range.end, range.start + 60); index += 1) {
      const text = lines[index] ?? '';
      const segments = text
        .split(/[。；;]|<br\s*\/?>/i)
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
      for (const name of RELATION_DOC_NAMES) {
        if (name === selfName) continue;
        if (!mentionsDocument(text, name)) continue;
        const candidates = segments
          .filter((segment) => mentionsDocument(segment, name))
          .map((segment) => ({
            segment,
            explicit: /取单|来源|暂时只有|上游|依据.*选择|引用/.test(segment),
            negated: NEGATION_PATTERN.test(segment),
            formatOnly: FORMAT_DECLARATION.test(segment),
          }));
        if (candidates.length === 0) continue;
        const formatMention = segments.some(
          (segment) => FORMAT_DECLARATION.test(segment) && mentionsDocument(segment, name)
        );
        const chosen =
          candidates.find((item) => item.explicit && !item.negated && !item.formatOnly) ?? candidates[0];
        hits.push({
          targetName: name,
          line: index + 1,
          text: chosen.segment.slice(0, 240),
          explicit: chosen.explicit,
          negated: chosen.negated,
          formatOnly: chosen.formatOnly || formatMention,
        });
      }
    }
  }
  return hits;
}

function toRef(document: DocumentRecord, line: number, text: string): SourceRef {
  return {
    document_id: document.id,
    file_path: document.relative_path,
    doc_version: document.doc_version,
    sha256: document.sha256,
    line_start: line,
    excerpt: text.slice(0, 240),
    table: '业务流程/取单',
  };
}

export function buildEntityRelations(
  documents: DocumentRecord[],
  entities: Entity[],
  now: string,
  questions: OpenQuestion[] = []
): Dependency[] {
  const relations: Dependency[] = [];
  const seen = new Set<string>();
  for (const document of documents) {
    if (document.source_role !== 'PRD' || !document.is_latest) continue;
    const lines = readLines(document);
    if (lines.length === 0) continue;
    const selfEntity =
      entities.find((entity) => document.entity_names.includes(entity.label)) ??
      entities.find((entity) => entity.document_ids.includes(document.id)) ??
      null;
    const selfName = selfEntity?.label ?? document.title;
    const hits = collectHits(document, lines, selfName);
    const byTarget = new Map<string, RelationHit>();
    for (const hit of hits) {
      const existing = byTarget.get(hit.targetName);
      if (!existing || (!existing.explicit && hit.explicit)) byTarget.set(hit.targetName, hit);
    }
    for (const [targetName, hit] of byTarget) {
      const target = resolveEntity(entities, targetName);
      if (!target || target.id === selfEntity?.id) continue;
      if (hit.negated || hit.formatOnly) {
        questions.push({
          id: questionId(`negated-relation:${document.id}:${targetName}`),
          object_type: 'OpenQuestion',
          question: `${selfName} 与 ${targetName} 的命中行包含否定或格式声明表述，未建确认关系：${hit.text.slice(0, 80)}`,
          category: 'NEGATED_RELATION',
          severity: 'MEDIUM',
          document_ids: [document.id],
          evidence: [`${document.relative_path}:${hit.line}`],
          impact: '该来源关系未被确认为 DERIVED_FROM，需业务确认是否存在取单关系',
          suggested_owner: 'PRD 作者 / 业务',
          status: 'OPEN',
          created_at: now,
        });
        continue;
      }
      const key = `${selfEntity?.entity_no ?? document.id}->${target.entity_no ?? target.label}`;
      if (seen.has(key)) continue;
      seen.add(key);
      relations.push({
        id: dependencyId(document.id, `rel:${key}`),
        object_type: 'Dependency',
        name: `${selfName} ← ${targetName}`,
        module: document.module,
        status: 'ACTIVE',
        schema_version: document.schema_version,
        source_refs: [toRef(document, hit.line, hit.text)],
        created_by_parser_version: PARSER_VERSION,
        updated_at: now,
        source_id: selfEntity?.id ?? document.id,
        target_id: target.id,
        target_ref: target.entity_no ?? target.label,
        relation_type: hit.explicit ? 'DERIVED_FROM' : 'CANDIDATE_LINK',
        mapping: hit.explicit ? '取单带入来源单据字段（详见原文取单章节）' : null,
        source_type: hit.explicit ? 'PRD_EXPLICIT' : 'PRD_DERIVED',
        confidence: hit.explicit ? 'CONFIRMED' : 'DERIVED',
        document_id: document.id,
      });
    }
  }
  return relations;
}

export function buildMasterDataRelations(
  documents: DocumentRecord[],
  entities: Entity[],
  now: string
): Dependency[] {
  const relations: Dependency[] = [];
  const entityByNo = new Map(entities.filter((entity) => entity.entity_no).map((entity) => [entity.entity_no!, entity]));
  const seen = new Set<string>();
  for (const document of documents) {
    if (document.source_role !== 'PRD' || !document.is_latest) continue;
    const lines = readLines(document);
    if (lines.length === 0) continue;
    const selfEntity = entities.find((entity) => entity.document_ids.includes(document.id)) ?? null;
    lines.forEach((text, index) => {
      for (const match of text.matchAll(MASTER_DATA_API)) {
        const target = entityByNo.get(match[1]);
        if (!target || target.id === selfEntity?.id) continue;
        const key = `${document.id}:${target.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        relations.push({
          id: dependencyId(document.id, `master:${target.entity_no}`),
          object_type: 'Dependency',
          name: `${document.title} 引用 ${target.label}`,
          module: document.module,
          status: 'ACTIVE',
          schema_version: document.schema_version,
          source_refs: [toRef(document, index + 1, text.trim())],
          created_by_parser_version: PARSER_VERSION,
          updated_at: now,
          source_id: selfEntity?.id ?? document.id,
          target_id: target.id,
          target_ref: target.entity_no ?? target.label,
          relation_type: 'USES_MASTER_DATA',
          mapping: `${match[0]}（平台服务读取）`,
          source_type: 'PLATFORM_SERVICE',
          confidence: 'CONFIRMED',
          document_id: document.id,
        });
      }
    });
  }
  return relations;
}

const CONFIRM_KEYWORDS: Array<{ category: 'quantity' | 'status' | 'writeback'; pattern: RegExp; label: string }> = [
  { category: 'quantity', pattern: /数量|可退|未入库|允收/, label: '数量口径' },
  { category: 'status', pattern: /状态|已审核|未审核|结束码/, label: '状态条件' },
  { category: 'writeback', pattern: /回写|写回|更新|带入|映射/, label: '回写与字段映射' },
];

export function buildRelationQuestions(
  documents: DocumentRecord[],
  relations: Dependency[],
  now: string
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const relationDocs = new Set(relations.filter((item) => item.relation_type !== 'USES_MASTER_DATA').map((item) => item.document_id));
  for (const document of documents) {
    if (!relationDocs.has(document.id)) continue;
    const lines = readLines(document);
    if (lines.length === 0) continue;
    const ranges = sectionRanges(lines);
    if (ranges.length === 0) continue;
    const text = ranges
      .flatMap((range) => lines.slice(range.start, Math.min(range.end, range.start + 60)))
      .join('\n');
    for (const keyword of CONFIRM_KEYWORDS) {
      if (!keyword.pattern.test(text)) continue;
      questions.push({
        id: questionId(`relation-${keyword.category}:${document.id}`),
        object_type: 'OpenQuestion',
        question: `${document.title} 的${keyword.label}仅以自然语言出现在取单/来源章节，尚未结构化，需业务确认判定规则`,
        category: 'MISSING_DEFINITION',
        severity: 'MEDIUM',
        document_ids: [document.id],
        evidence: [`${document.relative_path}:${ranges[0].start + 1}`],
        impact: '取单与回写场景无法生成可观察断言，只能保持候选状态',
        suggested_owner: 'PRD 负责人',
        status: 'OPEN',
        created_at: now,
      });
    }
  }
  return questions;
}
