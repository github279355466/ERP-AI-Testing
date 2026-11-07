import { scenarioId } from './ids';
import {
  KnowledgeBundle,
  PARSER_VERSION,
  Rule,
  Scenario,
  ScenarioAssertion,
  AutomationFeasibility,
  Entity,
} from './types';

interface ScenarioTemplate {
  scenarioType: string;
  steps: (label: string, fieldNo: string) => string[];
  assertionType: string;
  feasibility: AutomationFeasibility;
}

const TEMPLATES: Record<string, ScenarioTemplate> = {
  REQUIRED: {
    scenarioType: '必填校验',
    steps: (label) => ['进入新增页面', `清空字段「${label}」`, '点击保存并读取校验提示'],
    assertionType: 'error_message',
    feasibility: 'UI_READY',
  },
  READONLY: {
    scenarioType: '只读校验',
    steps: (label) => ['打开新增或详情页', `尝试编辑字段「${label}」`, '读取字段可编辑态'],
    assertionType: 'ui_state',
    feasibility: 'UI_READY',
  },
  HIDDEN: {
    scenarioType: '隐藏校验',
    steps: (label) => ['打开新增或详情页', `观察字段「${label}」是否渲染`, '记录 DOM 是否包含该字段'],
    assertionType: 'ui_state',
    feasibility: 'UI_READY',
  },
  DISABLED: {
    scenarioType: '禁用校验',
    steps: (label) => ['构造条件成立的数据', `观察字段「${label}」可编辑态`, '读取控件 disabled 属性'],
    assertionType: 'ui_state',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  DEFAULT_VALUE: {
    scenarioType: '默认值',
    steps: (label) => ['进入新增页面', `读取字段「${label}」初始值`, '与规则默认值比对'],
    assertionType: 'data_value',
    feasibility: 'UI_READY',
  },
  LOOKUP: {
    scenarioType: '开窗回填',
    steps: (label) => ['进入新增页面', `在字段「${label}」按 F2 打开开窗`, '选择一笔后确认回填'],
    assertionType: 'window_data',
    feasibility: 'UI_READY',
  },
  VALIDATION: {
    scenarioType: '反向校验',
    steps: (label) => ['进入新增页面', `输入不满足规则的「${label}」`, '保存并读取提示'],
    assertionType: 'error_message',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  UNIQUENESS: {
    scenarioType: '唯一性',
    steps: (label) => ['新增一笔已存在的记录', `重复录入「${label}」`, '保存并读取提示'],
    assertionType: 'error_message',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  PRECISION: {
    scenarioType: '边界值',
    steps: (label) => [`输入超出精度的「${label}」`, '离焦或保存', '读取取位结果'],
    assertionType: 'data_value',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  STATE_TRANSITION: {
    scenarioType: '状态迁移',
    steps: (label) => ['查询一笔满足起始状态的单据', `执行「${label}」`, '查询单据状态'],
    assertionType: 'record_status',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  API_CONTRACT: {
    scenarioType: '接口契约',
    steps: (label) => [`录制执行「${label}」时的接口调用`, '比对接口名与关键入参'],
    assertionType: 'api_called',
    feasibility: 'NOT_UI_OBSERVABLE',
  },
  PERMISSION: {
    scenarioType: '权限与数据范围',
    steps: (label) => ['以不具备条件的数据进入页面', `观察「${label}」是否可用`],
    assertionType: 'ui_state',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  LINKAGE: {
    scenarioType: '字段联动',
    steps: (label) => [`修改触发字段以影响「${label}」`, '观察目标字段变化'],
    assertionType: 'data_value',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  CALCULATION: {
    scenarioType: '数量与金额',
    steps: (label) => [`录入「${label}」相关数量与单价`, '观察计算结果'],
    assertionType: 'data_value',
    feasibility: 'NEEDS_CONFIRMATION',
  },
  WORKFLOW: {
    scenarioType: '上下游关联',
    steps: (label) => ['准备来源单据', `执行「${label}」相关取单或回写`, '核对数量与状态'],
    assertionType: 'business',
    feasibility: 'NEEDS_CONFIRMATION',
  },
};

const DEFAULT_TEMPLATE: ScenarioTemplate = {
  scenarioType: '反向校验',
  steps: (label) => ['进入新增页面', `按规则操作字段「${label}」`, '保存并读取结果'],
  assertionType: 'business',
  feasibility: 'NEEDS_CONFIRMATION',
};

const PLACEHOLDER_EXPECTATION = /^(按规则执行|上下游数据一致|按校验规则提示|按默认值规则|联动结果符合规则|计算口径符合规则|开窗数据与回填符合说明|按状态机变化|按规格调用接口|按精度取位|提示不可为空|提示重复|只读|隐藏|禁用|不可用)$/;

/**
 * 断言必须取自规则原文：优先取原文引号内的提示消息，其次取规则描述片段。
 * 不使用「按规则执行」这类模板串。
 */
function expectedFromRule(rule: Rule): string {
  const quoted = /[「"“]([^」"”]{2,120})[」"”]/.exec(rule.description);
  if (quoted && !PLACEHOLDER_EXPECTATION.test(quoted[1].trim())) return quoted[1].trim();
  const body = rule.description.replace(/^【[^】]*】/, '').trim();
  if (body.length > 0) return body.slice(0, 120);
  return rule.name.slice(0, 120);
}

function normalizeFingerprint(text: string): string {
  return text
    .replace(/【[^】]*】/g, '')
    .replace(/[（(][^）)]*[）)]/g, '')
    .replace(/[`"'“”‘’]/g, '')
    .replace(/[\s，。；、：:;,.!?！？\-—_/\\|]/g, '')
    .slice(0, 48);
}

/** 去重键：业务对象 + 字段/动作 + 规则语义指纹，不含文档 ID */
function scenarioKey(rule: Rule, entityLabel: string | null): string {
  const target = rule.field_no ?? rule.name;
  return `${entityLabel ?? rule.module}|${target}|${rule.rule_type}|${normalizeFingerprint(rule.description)}`;
}

function legacyKey(rule: Rule): string {
  return `${rule.document_id}|${rule.rule_type}|${rule.field_no ?? rule.name}`;
}

const TYPE_PRIORITY = [
  'REQUIRED',
  'VALIDATION',
  'STATE_TRANSITION',
  'LOOKUP',
  'LINKAGE',
  'CALCULATION',
  'PRECISION',
  'UNIQUENESS',
  'PERMISSION',
  'WORKFLOW',
  'API_CONTRACT',
  'DISABLED',
  'DEFAULT_VALUE',
  'READONLY',
  'HIDDEN',
];

/** 上下游关联按原文动作再判定，避免关键词误分类 */
function resolveWorkflowType(rule: Rule): string {
  const text = `${rule.name} ${rule.description}`;
  if (/取单|上引|来源单据|来源类型/.test(text)) return '上下游关联';
  if (/回写|写回|带入|映射/.test(text)) return '上下游关联';
  if (/审核|反审核|撤审|过账|结账|生效|作废/.test(text)) return '状态迁移';
  if (/删除|移除/.test(text)) return '反向校验';
  if (/保存|提交/.test(text)) return '必填校验';
  return '上下游关联';
}

function toScenario(
  key: string,
  rules: Rule[],
  entityById: Map<string, Entity>,
  caseIdsByRule: Map<string, string[]>,
  mergedScenarioIds: string[]
): Scenario {
  const primary = rules[0];
  const template = TEMPLATES[primary.rule_type] ?? DEFAULT_TEMPLATE;
  const scenarioType = primary.rule_type === 'WORKFLOW' ? resolveWorkflowType(primary) : template.scenarioType;
  const label = primary.field_name ?? primary.name;
  const fieldNo = primary.field_no ?? '';
  const entity = primary.applies_to.map((id) => entityById.get(id)).find((item): item is Entity => Boolean(item));
  const platformOnly = rules.every((rule) => rule.source_type === 'PLATFORM_SERVICE');
  const unconfirmed = rules.some((rule) => rule.source_type !== 'PRD_EXPLICIT' || rule.confidence !== 'CONFIRMED');
  const feasibility: AutomationFeasibility = platformOnly
    ? 'NOT_UI_OBSERVABLE'
    : unconfirmed
      ? 'NEEDS_CONFIRMATION'
      : 'NEEDS_UI_EXPLORATION';
  const expected = expectedFromRule(primary);
  const assertion: ScenarioAssertion = { type: template.assertionType, target: label, expected };
  const caseIds = [...new Set(rules.flatMap((rule) => caseIdsByRule.get(rule.id) ?? []))];
  const conditions = [...new Set(rules.flatMap((rule) => rule.conditions))].slice(0, 3);
  const preconditions = [
    `准备业务对象「${entity?.label ?? primary.module}」的可编辑数据（新增态或未审核态）`,
    ...conditions.map((condition) => `满足前置条件：${condition}`),
    `使用具备该作业操作权限的账号进入页面`,
  ];
  return {
    id: scenarioId(key),
    object_type: 'Scenario',
    name: primary.name,
    title: `${entity?.label ?? primary.module} / ${label} / ${scenarioType}`,
    test_objective: `验证${entity?.label ?? primary.module}「${label}」的${scenarioType}规则：${primary.description}`,
    module: primary.module,
    status: 'DRAFT',
    source_refs: primary.source_refs,
    created_by_parser_version: PARSER_VERSION,
    updated_at: primary.updated_at,
    scenario_type: scenarioType,
    automation_feasibility: feasibility,
    business_object: entity?.label ?? null,
    preconditions,
    data_requirements: [`字段 ${label}(${fieldNo}) 需存在于表单并可操作`, ...conditions.map((condition) => `条件数据：${condition}`)],
    steps: template.steps(label, fieldNo),
    assertions: [assertion],
    expected_result: expected,
    evidence_requirements: ['运行时截图', 'DOM 快照', '关键请求与响应日志'],
    rule_ids: rules.map((rule) => rule.id),
    document_ids: [...new Set(rules.map((rule) => rule.document_id))],
    case_ids: caseIds,
    review_required: true,
    origin: 'GENERATED',
    merged_scenario_ids: mergedScenarioIds,
  } as Scenario;
}

interface FamilySpec {
  type: string;
  matcher: RegExp;
  steps: (label: string) => string[];
  assertionType: string;
  minimum: number;
}

const FAMILIES: FamilySpec[] = [
  {
    type: '异常输入',
    matcher: /必填|不可为空|为空时|超长|长度|格式|非法|超可退|可退量|未审核|不可重复/,
    steps: (label) => ['进入新增页面', `构造异常输入：${label} 不满足规则约束`, '保存并读取拦截提示'],
    assertionType: 'error_message',
    minimum: 20,
  },
  {
    type: '边界值',
    matcher: /等于 0|为 0|等于 1|上限|超上限|尾差|最后一批|不得大于|不超过|小于等于|大于等于|精度|取位/,
    steps: (label) => [`取「${label}」的边界样本（0 / 1 / 上限 / 超上限）`, '逐值保存并记录判定结果'],
    assertionType: 'data_value',
    minimum: 20,
  },
  {
    type: '数量与金额',
    matcher: /可退|已入库|未入库|入库量|折算|换算|数量|金额|税额|合计|单价/,
    steps: (label) => [`录入「${label}」相关数量、单价与折扣`, '读取系统计算结果并与规则口径比对'],
    assertionType: 'data_value',
    minimum: 20,
  },
];

const PURCHASE_NODES = ['请购单', '询价单', '采购订单', '采购到货单', '采购入库单', '采购退货单', '采购退货出库单', '应付单', '应收单'];

export function generateScenarios(
  bundle: KnowledgeBundle,
  latestDocumentIds: Set<string>,
  maxScenarios = 12000,
  caseIdsByRule: Map<string, string[]> = new Map()
): Scenario[] {
  const entityById = new Map<string, Entity>(bundle.entities.map((entity) => [entity.id, entity]));
  const entityLabelOf = (rule: Rule): string | null =>
    rule.applies_to.map((id) => entityById.get(id)?.label).find((label): label is string => Boolean(label)) ?? null;

  const grouped = new Map<string, Rule[]>();
  for (const rule of bundle.rules) {
    if (rule.source_type === 'PENDING' || rule.confidence === 'AMBIGUOUS') continue;
    if (!latestDocumentIds.has(rule.document_id)) continue;
    const key = scenarioKey(rule, entityLabelOf(rule));
    const list = grouped.get(key) ?? [];
    list.push(rule);
    grouped.set(key, list);
  }

  const byType = new Map<string, Array<[string, Rule[]]>>();
  for (const [key, rules] of grouped) {
    const sorted = [...rules].sort((left, right) => left.document_id.localeCompare(right.document_id));
    const type = sorted[0].rule_type;
    const list = byType.get(type) ?? [];
    list.push([key, sorted]);
    byType.set(type, list);
  }
  const orderedTypes = [...byType.keys()].sort((a, b) => {
    const left = TYPE_PRIORITY.indexOf(a);
    const right = TYPE_PRIORITY.indexOf(b);
    return (left < 0 ? 99 : left) - (right < 0 ? 99 : right);
  });

  const scenarios: Scenario[] = [];
  for (let round = 0; scenarios.length < maxScenarios; round += 1) {
    let added = false;
    for (const type of orderedTypes) {
      const entry = (byType.get(type) ?? [])[round];
      if (!entry) continue;
      const [key, rules] = entry;
      const mergedIds = rules.length > 1 ? rules.slice(1).map((rule) => scenarioId(legacyKey(rule))) : [];
      scenarios.push(toScenario(key, rules, entityById, caseIdsByRule, mergedIds));
      added = true;
      if (scenarios.length >= maxScenarios) break;
    }
    if (!added) break;
  }

  scenarios.push(...buildFamilyScenarios(bundle, latestDocumentIds, entityById, caseIdsByRule, grouped));
  return dedupeScenarios(scenarios);
}

/** 第二道去重：同业务对象 + 同标题 + 同场景类型只保留一条，其余 ID 记入 merged_scenario_ids */
function dedupeScenarios(scenarios: Scenario[]): Scenario[] {
  const byKey = new Map<string, Scenario>();
  const order: string[] = [];
  for (const scenario of scenarios) {
    const key = `${scenario.scenario_type}|${scenario.business_object ?? ''}|${scenario.title}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, { ...scenario, merged_scenario_ids: [...(scenario.merged_scenario_ids ?? [])] });
      order.push(key);
      continue;
    }
    const merged = new Set([...(existing.merged_scenario_ids ?? []), scenario.id, ...(scenario.merged_scenario_ids ?? [])]);
    merged.delete(existing.id);
    existing.merged_scenario_ids = [...merged];
    existing.rule_ids = [...new Set([...existing.rule_ids, ...scenario.rule_ids])];
    existing.document_ids = [...new Set([...existing.document_ids, ...scenario.document_ids])];
    existing.case_ids = [...new Set([...existing.case_ids, ...scenario.case_ids])];
  }
  return order.map((key) => byKey.get(key) as Scenario);
}

function buildFamilyScenarios(
  bundle: KnowledgeBundle,
  latestDocumentIds: Set<string>,
  entityById: Map<string, Entity>,
  caseIdsByRule: Map<string, string[]>,
  existing: Map<string, Rule[]>
): Scenario[] {
  const scenarios: Scenario[] = [];
  const used = new Set<string>();
  const pick = (matcher: RegExp, limit: number): Rule[] => {
    const chosen: Rule[] = [];
    for (const rule of bundle.rules) {
      if (chosen.length >= limit) break;
      if (!latestDocumentIds.has(rule.document_id)) continue;
      if (rule.source_type !== 'PRD_EXPLICIT' || rule.confidence !== 'CONFIRMED') continue;
      if (!matcher.test(rule.description)) continue;
      const key = `${rule.document_id}|${rule.field_no ?? rule.name}`;
      if (used.has(key)) continue;
      used.add(key);
      chosen.push(rule);
    }
    return chosen;
  };

  for (const family of FAMILIES) {
    const rules = pick(family.matcher, family.minimum * 2);
    for (const [index, rule] of rules.entries()) {
      const entity = rule.applies_to.map((id) => entityById.get(id)).find((item): item is Entity => Boolean(item));
      const label = rule.field_name ?? rule.name;
      const key = `family:${family.type}:${rule.document_id}:${rule.field_no ?? rule.name}:${index}`;
      scenarios.push({
        id: scenarioId(key),
        object_type: 'Scenario',
        name: `${family.type}：${rule.name}`,
        title: `${entity?.label ?? rule.module} / ${label} / ${family.type}`,
        test_objective: `${family.type}用例，依据规则原文：${rule.description}`,
        module: rule.module,
        status: 'DRAFT',
        source_refs: rule.source_refs,
        created_by_parser_version: PARSER_VERSION,
        updated_at: rule.updated_at,
        scenario_type: family.type,
        automation_feasibility: 'NEEDS_UI_EXPLORATION',
        business_object: entity?.label ?? null,
        preconditions: [`准备业务对象「${entity?.label ?? rule.module}」的可编辑数据`, '使用具备该作业操作权限的账号进入页面'],
        data_requirements: [`字段 ${label}(${rule.field_no ?? ''}) 需存在于表单并可操作`],
        steps: family.steps(label),
        assertions: [{ type: family.assertionType, target: label, expected: expectedFromRule(rule) }],
        expected_result: expectedFromRule(rule),
        evidence_requirements: ['运行时截图', 'DOM 快照', '关键请求与响应日志'],
        rule_ids: [rule.id],
        document_ids: [rule.document_id],
        case_ids: caseIdsByRule.get(rule.id) ?? [],
        review_required: true,
        origin: 'GENERATED',
      } as Scenario);
    }
  }

  // 正常业务场景：每个采购链路单据节点 ≥1 条主流程（保存 / 取单 / 审核）
  const seenNodes = new Set<string>();
  for (const document of bundle.documents) {
    if (!latestDocumentIds.has(document.id)) continue;
    const node = PURCHASE_NODES.find((item) => document.title.includes(item) || document.file_name.includes(item));
    if (!node || seenNodes.has(node)) continue;
    const candidates = bundle.rules.filter(
      (rule) =>
        rule.document_id === document.id &&
        rule.source_type === 'PRD_EXPLICIT' &&
        /保存|取单|上引|审核/.test(`${rule.name} ${rule.description}`)
    );
    const fallback = bundle.rules.find(
      (rule) => rule.document_id === document.id && rule.source_type === 'PRD_EXPLICIT' && rule.confidence === 'CONFIRMED'
    );
    const phases = ['保存', '取单', '审核'];
    let created = 0;
    for (const phase of phases) {
      const rule =
        candidates.find((item) => new RegExp(phase).test(`${item.name} ${item.description}`)) ?? fallback;
      if (!rule) continue;
      const label = rule.field_name ?? rule.name;
      scenarios.push({
        id: scenarioId(`flow:${node}:${phase}`),
        object_type: 'Scenario',
        name: `${node} ${phase}主流程`,
        title: `${node} / ${phase} / 正常业务场景`,
        test_objective: `验证${node}的${phase}主流程：${rule.description}`,
        module: rule.module,
        status: 'DRAFT',
        source_refs: rule.source_refs,
        created_by_parser_version: PARSER_VERSION,
        updated_at: rule.updated_at,
        scenario_type: '正常业务场景',
        automation_feasibility: 'NEEDS_UI_EXPLORATION',
        business_object: node,
        preconditions: [`准备${node}可编辑数据`, '使用具备该作业操作权限的账号进入页面'],
        data_requirements: [`${node}存在可操作的${phase}场景数据`],
        steps:
          phase === '保存'
            ? ['新增或打开一笔未审核单据', '录入必填字段', '点击保存并核对结果']
            : phase === '取单'
              ? ['新增一笔未审核单据', '点击取单并选择来源单据', '确认回填并对账数量与金额']
              : ['查询一笔满足审核条件的单据', '点击审核', '查询单据状态与下游影响'],
        assertions: [{ type: phase === '取单' ? 'business' : 'record_status', target: label, expected: expectedFromRule(rule) }],
        expected_result: expectedFromRule(rule),
        evidence_requirements: ['运行时截图', 'DOM 快照', '关键请求与响应日志'],
        rule_ids: [rule.id],
        document_ids: [document.id],
        case_ids: caseIdsByRule.get(rule.id) ?? [],
        review_required: true,
        origin: 'GENERATED',
      } as Scenario);
      created += 1;
    }
    if (created > 0) seenNodes.add(node);
  }
  return scenarios;
}
