import { questionId } from './ids';
import {
  Dependency,
  DocumentRecord,
  Entity,
  Field,
  OpenQuestion,
  Rule,
  SCHEMA_VERSION,
  Scenario,
} from './types';

const NEGATION = /不提供|不作为|不适用|不生成|不含|无需|不支持|非来源|只作筛选|仅作筛选|不改变来源|参考来源/;
const NON_PRD_SOURCE = /条件写法体检|云端漂移|-v\d+(?:\.\d+)*-to-v|会议议程|审查报告|确认事项清单/;
const SEMANTIC_CELL = /[\u4e00-\u9fa5A-Za-z]/;
const COVERAGE_TARGETS: Array<[string, number]> = [
  ['正常业务场景', 20],
  ['异常输入', 20],
  ['边界值', 20],
  ['数量与金额', 20],
];

function isSemantic(excerpt: string | null | undefined): boolean {
  const text = (excerpt ?? '').replace(/\s+/g, ' ').trim();
  if (text.length === 0) return false;
  if (/^[{}[\],:;|/\-–—]+$/.test(text)) return false;
  const cells = text
    .replace(/^\||\|$/g, '')
    .split('|')
    .map((cell) => cell.trim())
    .filter((cell) => cell.length > 0 && !/^:?-{2,}:?$/.test(cell));
  if (cells.length === 0) return false;
  return cells.some((cell) => cell.length > 1 && SEMANTIC_CELL.test(cell));
}

function make(
  key: string,
  category: OpenQuestion['category'],
  question: string,
  count: number,
  documents: DocumentRecord[],
  evidence: string[],
  impact: string,
  owner: string,
  now: string
): OpenQuestion {
  return {
    id: questionId(`remediation:${key}`),
    object_type: 'OpenQuestion',
    schema_version: SCHEMA_VERSION,
    question,
    category,
    severity: count === 0 ? 'LOW' : 'MEDIUM',
    document_ids: documents.slice(0, 20).map((item) => item.id),
    evidence: evidence.slice(0, 10),
    impact,
    suggested_owner: owner,
    status: count === 0 ? 'CLOSED' : 'OPEN',
    created_at: now,
  };
}

/** 第二轮验收 12 类缺陷的自动登记：数字全部由本次知识库实时复算 */
export function buildRemediationQuestions(
  documents: DocumentRecord[],
  entities: Entity[],
  fields: Field[],
  rules: Rule[],
  dependencies: Dependency[],
  scenarios: Scenario[],
  now: string
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  const emptyRules = rules.filter((rule) => !rule.source_refs.some((ref) => isSemantic(ref.excerpt)));
  questions.push(
    make(
      'empty-evidence',
      'EMPTY_EVIDENCE',
      `OQ-R2-01 空证据规则复算为 ${emptyRules.length} 条（整改前 3693 条），空单元格与 JSON 首行 { 不再生成规则`,
      emptyRules.length,
      documents,
      emptyRules.slice(0, 5).map((rule) => `${rule.source_refs[0]?.file_path ?? ''}:${rule.source_refs[0]?.line_start ?? ''}`),
      '证据无业务语义会导致规则不可回溯',
      'PRD 解析器维护者',
      now
    )
  );

  const condAttr: Partial<Record<string, string>> = {
    REQUIRED: '必填条件',
    READONLY: '只读条件',
    HIDDEN: '隐藏条件',
    DISABLED: '禁用条件',
  };
  const fieldByKey = new Map(fields.filter((field) => field.field_no).map((field) => [`${field.document_id}|${field.field_no}`, field]));
  const orphanCondition = rules.filter((rule) => {
    const attr = condAttr[rule.rule_type];
    if (!attr) return false;
    const field = rule.field_no ? fieldByKey.get(`${rule.document_id}|${rule.field_no}`) : undefined;
    if (!field) return false;
    const condLine = field.attribute_lines?.[attr];
    const condText = (field.attributes[attr] ?? '').trim();
    if (!condLine || !condText) return false;
    const ref = rule.source_refs[0];
    return ref?.line_start !== condLine;
  });
  questions.push(
    make(
      'condition-evidence',
      'EVIDENCE_NOT_COVERING_CONDITION',
      `OQ-R2-03 条件型规则证据未覆盖条件行复算为 ${orphanCondition.length} 条（整改前 1411 条）`,
      orphanCondition.length,
      documents,
      orphanCondition.slice(0, 5).map((rule) => `${rule.source_refs[0]?.file_path ?? ''}:${rule.source_refs[0]?.line_start ?? ''}`),
      '条件没有出处时无法判断规则适用场景',
      'PRD 解析器维护者',
      now
    )
  );

  const contradicted = rules.filter((rule) => {
    const field = rule.field_no ? fieldByKey.get(`${rule.document_id}|${rule.field_no}`) : undefined;
    if (!field) return false;
    const attr = { REQUIRED: '是否必填', READONLY: '是否只读', HIDDEN: '是否隐藏', DISABLED: '是否禁用' }[rule.rule_type as string];
    if (!attr) return false;
    const state = (field.attributes[attr] ?? '').trim();
    return /否/.test(state) && !/是否/.test(state);
  });
  questions.push(
    make(
      'rule-contradicts-source',
      'RULE_CONTRADICTS_SOURCE',
      `OQ-R2-02 规则与状态行矛盾的规则复算为 ${contradicted.length} 条（整改前 322 条），已按状态行降级为 VALIDATION 并逐字段登记`,
      contradicted.length,
      documents,
      contradicted.slice(0, 5).map((rule) => `${rule.source_refs[0]?.file_path ?? ''}:${rule.source_refs[0]?.line_start ?? ''}`),
      '状态型规则若与状态行矛盾会生成错误断言',
      'PRD 作者',
      now
    )
  );

  const negatedRelations = dependencies.filter(
    (dependency) => NEGATION.test(dependency.source_refs[0]?.excerpt ?? '')
  );
  questions.push(
    make(
      'relation-contradicts-source',
      'RELATION_CONTRADICTS_SOURCE',
      `OQ-R2-04 证据含否定表述的确认关系复算为 ${negatedRelations.length} 条（整改前 4 条）`,
      negatedRelations.length,
      documents,
      negatedRelations.slice(0, 5).map((item) => `${item.source_refs[0]?.file_path ?? ''}:${item.source_refs[0]?.line_start ?? ''}`),
      '否定语义会被误判为取单关系',
      'PRD 作者',
      now
    )
  );

  const mergedEntities = entities.filter((entity) => (entity.superseded_entity_ids ?? []).length > 0);
  questions.push(
    make(
      'entity-split',
      'ENTITY_SPLIT',
      `OQ-R2-07 已归并的同名实体 ${mergedEntities.reduce((sum, entity) => sum + (entity.superseded_entity_ids?.length ?? 0), 0)} 个（整改前 15 组同名分裂）`,
      mergedEntities.length,
      documents,
      mergedEntities.slice(0, 5).map((entity) => `${entity.label} -> ${entity.id}`),
      '同名实体分裂会导致关系与场景挂错对象',
      'PRD 解析器维护者',
      now
    )
  );

  const entityIds = new Set(entities.map((entity) => entity.id));
  const subjectNotEntity = dependencies.filter((dependency) => !entityIds.has(dependency.source_id));
  questions.push(
    make(
      'relation-subject',
      'RELATION_SUBJECT_NOT_ENTITY',
      `OQ-R2-08 关系来源主体不是实体的条数复算为 ${subjectNotEntity.length}（平台服务/表结构引用，需补实体映射）`,
      subjectNotEntity.length,
      documents,
      subjectNotEntity.slice(0, 5).map((item) => `${item.id}:${item.source_id}`),
      '来源主体不是实体时无法做上下游断言',
      'PRD 作者 / 平台',
      now
    )
  );

  const byType = new Map<string, number>();
  for (const scenario of scenarios) byType.set(scenario.scenario_type, (byType.get(scenario.scenario_type) ?? 0) + 1);
  const gaps = COVERAGE_TARGETS.filter(([type, target]) => (byType.get(type) ?? 0) < target);
  questions.push(
    make(
      'scenario-gap',
      'SCENARIO_COVERAGE_GAP',
      gaps.length === 0
        ? `OQ-R2-09 场景覆盖缺口已清零：正常业务 ${byType.get('正常业务场景') ?? 0} / 异常输入 ${byType.get('异常输入') ?? 0} / 边界值 ${byType.get('边界值') ?? 0} / 数量与金额 ${byType.get('数量与金额') ?? 0}`
        : `OQ-R2-09 场景覆盖缺口：${gaps.map(([type, target]) => `${type} ${byType.get(type) ?? 0}/${target}`).join('、')}`,
      gaps.length,
      documents,
      gaps.map(([type]) => `scenario_type=${type}`),
      '覆盖缺口会导致 Phase 2 断言缺失',
      '测试设计',
      now
    )
  );

  const mergedScenarios = scenarios.filter((scenario) => (scenario.merged_scenario_ids ?? []).length > 0);
  questions.push(
    make(
      'duplicate-scenario',
      'DUPLICATE_SCENARIO',
      `OQ-R2-10 重复场景已合并 ${mergedScenarios.reduce((sum, scenario) => sum + (scenario.merged_scenario_ids?.length ?? 0), 0)} 条（整改前 898 条）`,
      mergedScenarios.length,
      documents,
      mergedScenarios.slice(0, 5).map((scenario) => scenario.id),
      '重复场景会放大执行成本并掩盖覆盖缺口',
      '测试设计',
      now
    )
  );

  const nonPrd = documents.filter((document) => NON_PRD_SOURCE.test(document.file_name));
  questions.push(
    make(
      'non-prd-source',
      'NON_PRD_SOURCE_MODELED',
      `OQ-R2-11 审查报告 / 变更对比等非 PRD 产物 ${nonPrd.length} 份已排除实体建模，仍保留在文档登记表中`,
      nonPrd.length,
      nonPrd,
      nonPrd.slice(0, 5).map((document) => document.relative_path),
      '非 PRD 产物参与建模会污染实体与关系',
      'PRD 负责人',
      now
    )
  );

  return questions;
}
