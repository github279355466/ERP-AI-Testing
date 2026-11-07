import { stableId } from './ids';
import { PARSER_VERSION } from './types';
import type { Evidence, KnowledgeBundle, SourceRef } from './types';

type EvidenceKind = Evidence['kind'];

interface EvidenceInput {
  kind: EvidenceKind;
  ownerId: string;
  refs: SourceRef[];
}

function verbatimOf(ref: SourceRef): boolean {
  return typeof ref.excerpt === 'string' && ref.excerpt.trim().length > 0;
}

export function buildEvidence(bundle: Pick<
  KnowledgeBundle,
  'rules' | 'actions' | 'workflows' | 'dependencies' | 'fields' | 'documents'
>, now: string): Evidence[] {
  const inputs: EvidenceInput[] = [
    ...bundle.rules.map((rule) => ({ kind: 'RULE' as const, ownerId: rule.id, refs: rule.source_refs })),
    ...bundle.actions.map((action) => ({ kind: 'ACTION' as const, ownerId: action.id, refs: action.source_refs })),
    ...bundle.workflows.map((workflow) => ({ kind: 'WORKFLOW' as const, ownerId: workflow.id, refs: workflow.source_refs })),
    ...bundle.dependencies.map((dependency) => ({
      kind: 'DEPENDENCY' as const,
      ownerId: dependency.id,
      refs: dependency.source_refs,
    })),
    ...bundle.fields.map((field) => ({ kind: 'FIELD' as const, ownerId: field.id, refs: field.source_refs })),
  ];
  const documentById = new Map(bundle.documents.map((document) => [document.id, document]));
  const byKey = new Map<string, Evidence>();
  for (const input of inputs) {
    for (const ref of input.refs) {
      if (!ref.document_id) continue;
      const document = documentById.get(ref.document_id);
      if (!document) continue;
      const key = `${ref.document_id}|${ref.line_start ?? 0}|${(ref.excerpt ?? '').slice(0, 80)}`;
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.referenced_by.includes(input.ownerId)) existing.referenced_by.push(input.ownerId);
        if (!existing.kind.split('+').includes(input.kind)) existing.kind = `${existing.kind}+${input.kind}` as EvidenceKind;
        continue;
      }
      byKey.set(key, {
        id: stableId('EVD', key),
        evidence_id: stableId('EVD', key),
        object_type: 'Evidence',
        name: `${document.title} ${ref.line_start ?? ''}`.trim(),
        module: document.module,
        status: document.last_scan_status === 'SOURCE_MISSING' ? 'MISSING_SOURCE' : 'ACTIVE',
        source_refs: [ref],
        created_by_parser_version: PARSER_VERSION,
        updated_at: now,
        document_id: ref.document_id,
        doc_version: ref.doc_version ?? document.doc_version,
        sha256: ref.sha256 ?? document.sha256,
        file_path: ref.file_path,
        section: ref.section ?? null,
        line_start: ref.line_start ?? null,
        line_end: ref.line_end ?? ref.line_start ?? null,
        page: ref.page ?? null,
        paragraph_index: ref.paragraph_index ?? null,
        excerpt: ref.excerpt ?? null,
        verbatim: verbatimOf(ref),
        kind: input.kind,
        referenced_by: [input.ownerId],
      });
    }
  }
  return [...byKey.values()];
}
