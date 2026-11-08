import { KnowledgeBundle, SourceRef } from '../../prd/types';

export type GlossaryKind = 'ENTITY' | 'FIELD' | 'CODE';

export interface GlossarySource {
  file_path: string;
  section?: string;
  line_start?: number;
}

export interface GlossaryTerm {
  term: string;
  normalized: string;
  kind: GlossaryKind;
  definition: string;
  source_refs: GlossarySource[];
}

function toSource(ref: SourceRef): GlossarySource {
  return {
    file_path: ref.file_path,
    ...(ref.section ? { section: ref.section } : {}),
    ...(ref.line_start ? { line_start: ref.line_start } : {}),
  };
}

function add(
  map: Map<string, GlossaryTerm>,
  term: string | null | undefined,
  kind: GlossaryKind,
  definition: string,
  refs: SourceRef[],
): void {
  const value = (term ?? '').trim();
  if (value.length < 1) return;
  const normalized = value.toLowerCase().replace(/\s+/g, '');
  const key = `${kind}:${normalized}`;
  const existing = map.get(key);
  if (existing) {
    for (const ref of refs.slice(0, 3)) {
      const source = toSource(ref);
      if (!existing.source_refs.some((item) => item.file_path === source.file_path && item.line_start === source.line_start)) {
        existing.source_refs.push(source);
      }
    }
    return;
  }
  map.set(key, {
    term: value,
    normalized,
    kind,
    definition,
    source_refs: refs.slice(0, 3).map(toSource),
  });
}

export function buildGlossary(bundle: KnowledgeBundle): GlossaryTerm[] {
  const map = new Map<string, GlossaryTerm>();
  for (const entity of bundle.entities) {
    add(map, entity.label || entity.name, 'ENTITY', `业务实体${entity.entity_no ? ` ${entity.entity_no}` : ''}`, entity.source_refs);
    add(map, entity.entity_no, 'CODE', `实体编码，对应 ${entity.label || entity.name}`, entity.source_refs);
  }
  for (const field of bundle.fields) {
    const owner = field.entity_label ?? field.entity_no ?? '';
    add(map, field.label, 'FIELD', `${owner ? `${owner} ` : ''}字段${field.field_no ? ` ${field.field_no}` : ''}`, field.source_refs);
    add(map, field.field_no, 'CODE', `字段编码，对应 ${field.label}`, field.source_refs);
  }
  return [...map.values()].sort((left, right) => left.kind.localeCompare(right.kind) || left.term.localeCompare(right.term));
}
