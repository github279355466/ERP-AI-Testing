import { loadKnowledgeBundle, recomputeCoverage } from '../prd/store';
import type { CoverageResult } from '../prd/link';
import type {
  Dependency,
  DocumentRecord,
  Entity,
  Evidence,
  Field,
  KnowledgeBundle,
  OpenQuestion,
  Rule,
  Scenario,
} from '../prd/types';

export interface PrdKnowledgeLoadOptions {
  knowledgeDir: string;
  sourceIndexDir?: string;
}

/**
 * Phase 1 知识模型（artifacts/knowledge/*.json）的只读查询适配层。
 * 与 legacy KnowledgeBase（knowledge/athena-*.json）并存，互不覆盖。
 */
export class PrdKnowledgeBase {
  private constructor(
    readonly bundle: KnowledgeBundle,
    readonly coverage: CoverageResult
  ) {}

  static load(options: PrdKnowledgeLoadOptions): PrdKnowledgeBase {
    const { bundle } = loadKnowledgeBundle(options.knowledgeDir, options.sourceIndexDir);
    return new PrdKnowledgeBase(bundle, recomputeCoverage(bundle));
  }

  documents(role: DocumentRecord['source_role'] = 'PRD'): DocumentRecord[] {
    return this.bundle.documents.filter((document) => document.source_role === role);
  }

  latestDocuments(): DocumentRecord[] {
    return this.bundle.documents.filter((document) => document.source_role === 'PRD' && document.is_latest);
  }

  findEntity(nameOrNo: string): Entity | undefined {
    return this.bundle.entities.find(
      (entity) => entity.label === nameOrNo || entity.name === nameOrNo || entity.entity_no === nameOrNo
    );
  }

  fieldsOfEntity(entityIdOrNo: string): Field[] {
    const entity = this.bundle.entities.find(
      (item) => item.id === entityIdOrNo || item.entity_no === entityIdOrNo || item.label === entityIdOrNo
    );
    if (!entity) return [];
    return this.bundle.fields.filter((field) => field.entity_id === entity.id || field.entity_no === entity.entity_no);
  }

  rulesOfEntity(entityIdOrNo: string, options: { explicitOnly?: boolean; latestOnly?: boolean } = {}): Rule[] {
    const entity = this.bundle.entities.find(
      (item) => item.id === entityIdOrNo || item.entity_no === entityIdOrNo || item.label === entityIdOrNo
    );
    if (!entity) return [];
    const latest = new Set(this.latestDocuments().map((document) => document.id));
    return this.bundle.rules.filter(
      (rule) =>
        rule.applies_to.includes(entity.id) &&
        (!options.explicitOnly || (rule.source_type === 'PRD_EXPLICIT' && rule.confidence === 'CONFIRMED')) &&
        (!options.latestOnly || latest.has(rule.document_id))
    );
  }

  scenariosForField(fieldNo: string): Scenario[] {
    return this.bundle.scenarios.filter((scenario) => {
      const rules = scenario.rule_ids
        .map((ruleId) => this.bundle.rules.find((rule) => rule.id === ruleId))
        .filter((rule): rule is Rule => Boolean(rule));
      return rules.some((rule) => rule.field_no === fieldNo);
    });
  }

  dependenciesFrom(entityIdOrNo: string): Dependency[] {
    const entity = this.bundle.entities.find(
      (item) => item.id === entityIdOrNo || item.entity_no === entityIdOrNo || item.label === entityIdOrNo
    );
    if (!entity) return [];
    return this.bundle.dependencies.filter(
      (dependency) => dependency.source_id === entity.id || dependency.target_id === entity.id
    );
  }

  evidenceFor(objectId: string): Evidence[] {
    return this.bundle.evidence.filter((evidence) => evidence.referenced_by.includes(objectId));
  }

  openQuestionsFor(objectId: string): OpenQuestion[] {
    return this.bundle.openQuestions.filter(
      (question) => question.id === objectId || question.document_ids.includes(objectId)
    );
  }

  missingSourceDocuments(): DocumentRecord[] {
    return this.bundle.documents.filter((document) => document.last_scan_status === 'SOURCE_MISSING');
  }
}

export type { KnowledgeBundle as PrdKnowledgeModel };
