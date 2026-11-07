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
  assertion: (rule: Rule, label: string) => ScenarioAssertion;
  feasibility: AutomationFeasibility;
}

const DEFAULT_TEMPLATE: ScenarioTemplate = {
  scenarioType: '反向校验',
  steps: (label) => [`进入新增页面`, `按规则操作字段「${label}」`, `保存并观察结果`],
  assertion: (rule) => ({
    type: 'business',
    target: rule.field_name ?? rule.name,
    expected: rule.expected_result ?? '按规则执行',
  }),
  feasibility: 'NEEDS_CONFIRMATION',
};

const TEMPLATES: Record<string, ScenarioTemplate> = {
  REQUIRED: {
    scenarioType: '必填校验',
    steps: (label) => ['进入新增页面', `清空字段「${label}」`, '点击保存'],
    assertion: (rule, label) => ({ type: 'error_message', target: label, expected: '提示不可为空' }),
    feasibility: 'UI_READY',
  },
  READONLY: {
    scenarioType: '只读校验',
    steps: (label) => ['打开任意新增/详情页', `尝试编辑字段「${label}」`],
    assertion: (_rule, label) => ({ type: 'ui_state', target: label, expected: '只读' }),
    feasibility: 'UI_READY',
  },
  HIDDEN: {
    scenarioType: '隐藏校验',
    steps: (label) => ['打开任意新增/详情页', `观察字段「${label}」是否渲染`],
    assertion: (_rule, label) => ({ type: 'ui_state', target: label, expected: '隐藏' }),
    feasibility: 'UI_READY',
  },
  DISABLED: {
    scenarioType: '禁用校验',
    steps: (label) => ['构造条件成立的数据', `观察字段「${label}」可编辑态`],
    assertion: (_rule, label) => ({ type: 'ui_state', target: label, expected: '禁用' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  DEFAULT_VALUE: {
    scenarioType: '默认值',
    steps: (label) => ['进入新增页面', `读取字段「${label}」初始值`],
    assertion: (rule) => ({ type: 'data_value', target: rule.field_name ?? rule.name, expected: rule.expected_result ?? '按默认值规则' }),
    feasibility: 'UI_READY',
  },
  LOOKUP: {
    scenarioType: '开窗回填',
    steps: (label) => ['进入新增页面', `在字段「${label}」按 F2 打开开窗`, '选择一笔后确认回填'],
    assertion: (rule) => ({ type: 'window_data', target: rule.field_name ?? rule.name, expected: '开窗数据与回填符合说明' }),
    feasibility: 'UI_READY',
  },
  VALIDATION: {
    scenarioType: '反向校验',
    steps: (label) => ['进入新增页面', `输入不满足规则的「${label}」`, '保存并观察提示'],
    assertion: (rule) => ({ type: 'error_message', target: rule.field_name ?? rule.name, expected: rule.expected_result ?? '按校验规则提示' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  UNIQUENESS: {
    scenarioType: '唯一性',
    steps: (label) => ['新增一笔已存在的记录', `重复录入「${label}」`, '保存'],
    assertion: (rule) => ({ type: 'error_message', target: rule.field_name ?? rule.name, expected: '提示重复' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  PRECISION: {
    scenarioType: '边界值',
    steps: (label) => [`输入超出精度的「${label}」`, '离焦或保存'],
    assertion: (rule) => ({ type: 'data_value', target: rule.field_name ?? rule.name, expected: '按精度取位' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  STATE_TRANSITION: {
    scenarioType: '状态迁移',
    steps: (label) => ['查询一笔满足起始状态的单据', `执行「${label}」`, '查询单据状态'],
    assertion: (rule) => ({ type: 'record_status', target: '单据状态', expected: rule.expected_result ?? '按状态机变化' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  API_CONTRACT: {
    scenarioType: '接口契约',
    steps: (label) => [`录制执行「${label}」时的接口调用`, '比对接口名与关键入参'],
    assertion: (rule) => ({ type: 'api_called', target: rule.field_name ?? rule.name, expected: '按规格调用接口' }),
    feasibility: 'NOT_UI_OBSERVABLE',
  },
  PERMISSION: {
    scenarioType: '权限与数据范围',
    steps: (label) => ['以不具备条件的数据进入页面', `观察「${label}」是否可用`],
    assertion: (rule) => ({ type: 'ui_state', target: rule.field_name ?? rule.name, expected: rule.expected_result ?? '不可用' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  LINKAGE: {
    scenarioType: '字段联动',
    steps: (label) => [`修改触发字段以影响「${label}」`, '观察目标字段变化'],
    assertion: (rule) => ({ type: 'data_value', target: rule.field_name ?? rule.name, expected: '联动结果符合规则' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  CALCULATION: {
    scenarioType: '数量与金额',
    steps: (label) => [`录入「${label}」相关数量与单价`, '观察计算结果'],
    assertion: (rule) => ({ type: 'data_value', target: rule.field_name ?? rule.name, expected: '计算口径符合规则' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
  WORKFLOW: {
    scenarioType: '上下游关联',
    steps: (label) => ['准备来源单据', `执行「${label}」相关取单或回写`, '核对数量与状态'],
    assertion: (rule) => ({ type: 'business', target: rule.field_name ?? rule.name, expected: '上下游数据一致' }),
    feasibility: 'NEEDS_CONFIRMATION',
  },
};

function scenarioKey(rule: Rule): string {
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

function toScenario(
  key: string,
  rules: Rule[],
  entityById: Map<string, Entity>,
  caseIdsByRule: Map<string, string[]>
): Scenario {
  const primary = rules[0];
  const template = TEMPLATES[primary.rule_type] ?? DEFAULT_TEMPLATE;
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
  const assertion = template.assertion(primary, label);
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
    title: `${entity?.label ?? primary.module} / ${label} / ${template.scenarioType}`,
    test_objective: `验证${entity?.label ?? primary.module}「${label}」的${template.scenarioType}规则：${primary.description}`,
    module: primary.module,
    status: 'DRAFT',
    source_refs: primary.source_refs,
    created_by_parser_version: PARSER_VERSION,
    updated_at: primary.updated_at,
    scenario_type: template.scenarioType,
    automation_feasibility: feasibility,
    business_object: entity?.label ?? null,
    preconditions,
    data_requirements: [`字段 ${label}(${fieldNo}) 需存在于表单并可操作`, ...conditions.map((condition) => `条件数据：${condition}`)],
    steps: template.steps(label, fieldNo),
    assertions: [assertion],
    expected_result: primary.expected_result ?? assertion.expected,
    evidence_requirements: ['运行时截图', 'DOM 快照', '关键请求与响应日志'],
    rule_ids: rules.map((rule) => rule.id),
    document_ids: [...new Set(rules.map((rule) => rule.document_id))],
    case_ids: caseIds,
    review_required: true,
    origin: 'GENERATED',
  };
}

export function generateScenarios(
  bundle: KnowledgeBundle,
  latestDocumentIds: Set<string>,
  maxScenarios = 12000,
  caseIdsByRule: Map<string, string[]> = new Map()
): Scenario[] {
  const entityById = new Map<string, Entity>(bundle.entities.map((entity) => [entity.id, entity]));
  const grouped = new Map<string, Rule[]>();
  for (const rule of bundle.rules) {
    if (rule.source_type === 'PENDING' || rule.confidence === 'AMBIGUOUS') continue;
    if (!latestDocumentIds.has(rule.document_id)) continue;
    const key = scenarioKey(rule);
    const list = grouped.get(key) ?? [];
    list.push(rule);
    grouped.set(key, list);
  }

  const byType = new Map<string, Array<[string, Rule[]]>>();
  for (const [key, rules] of grouped) {
    const type = rules[0].rule_type;
    const list = byType.get(type) ?? [];
    list.push([key, rules]);
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
      scenarios.push(toScenario(entry[0], entry[1], entityById, caseIdsByRule));
      added = true;
      if (scenarios.length >= maxScenarios) break;
    }
    if (!added) break;
  }
  return scenarios;
}
