import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

const ROOT = process.cwd();
const OUT = path.join(ROOT, 'business-modules', 'foundation');
const CSV = path.join(ROOT, 'reports', 'foundation', 'FIELD-RULE-MATRIX.csv');

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { row.push(cell); cell = ''; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; }
    else if (ch !== '\r') cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const PAGES = [
  { key: 'trans-obj-attr', name: '交易对象属性', group: '交易对象管理', code: 'HDWWlvaQVWIS', codeField: 'trans_obj_attr.attr_no', codeLabel: '属性编号', unique: 'verified' },
  { key: 'warehouse', name: '仓库信息', group: '公共信息', code: 'RwlRpYjDJXNF', codeField: 'whse.whse_no', codeLabel: '仓库编号', unique: 'candidate' },
  { key: 'currency', name: '货币信息', group: '公共信息', code: 'BNiXNsoxHMSu', codeField: 'ccy.ccy_no', codeLabel: '货币编号', unique: 'verified' },
  { key: 'meas-unit', name: '计量单位', group: '公共信息', code: 'uyaxVfhglsZN', codeField: 'meas_unit.unit_no', codeLabel: '单位编号', unique: 'verified' },
  { key: 'customer', name: '客户通用信息', group: '客户信息', code: 'xwpefqwlWQqi', codeField: 'cust_base_info.cust_no', codeLabel: '客户编号', unique: 'candidate' },
  { key: 'supplier', name: '供应商通用信息', group: '供应商信息', code: 'AgmFoWLpurdf', codeField: 'supp_base_info.supp_no', codeLabel: '供应商编号', unique: 'candidate' },
  { key: 'financial-institution', name: '金融机构', group: '公共信息', code: 'dUDSckVJMbpD', codeField: 'fi.fi_no', codeLabel: '金融机构编号', unique: 'verified' },
  { key: 'transport-mode', name: '运输方式', group: '公共信息', code: 'XlKvvozLmhCl', codeField: 'trasp_mode.trasp_mode_no', codeLabel: '运输方式编号', unique: 'verified' },
  { key: 'project', name: '项目信息', group: '公共信息', code: 'VTdUTYFuHOdI', codeField: 'proj.proj_no', codeLabel: '项目编号', unique: 'verified' },
];

const rows = parseCsv(fs.readFileSync(CSV, 'utf8'));
const header = rows[0];
const index = Object.fromEntries(header.map((name, i) => [name, i]));
const records = rows.slice(1).filter((row) => row.length > index['字段路径']).map((row) => ({
  group: row[index['模块分组']], page: row[index['页面']], code: row[index['workItemCode']],
  path: row[index['字段路径']], label: row[index['字段名称']], required: row[index['必填']] === '是',
  control: row[index['控件类型']], readonly: row[index['只读']] === '是', disabled: row[index['禁用']] === '是',
  value: row[index['默认值']], maxLength: row[index['最大长度']], source: row[index['来源对象/联动规则']],
}));

const controlType = (control) => {
  if (control === '开窗选择') return 'LOOKUP';
  if (control === '下拉') return 'DROPDOWN';
  if (control === '复选框') return 'CHECKBOX';
  if (control === '只读文本') return 'TEXT_INPUT';
  return 'TEXT_INPUT';
};

for (const dir of ['page-mappings', 'field-rules', 'testcases', 'source-index']) {
  fs.mkdirSync(path.join(OUT, dir), { recursive: true });
}

fs.writeFileSync(path.join(OUT, 'module.yaml'), YAML.stringify({
  schema_version: '1.0',
  module: {
    id: 'foundation',
    name: '基础管理（关键对象）',
    version: '0.1.0',
    status: 'draft',
    owner: 'qa',
    description: '基础管理 9 个关键对象的字段规则包；规则来源 Gate C 真实 UI 盘点',
  },
  compatibility: { platform_api: '>=1.0.0 <2.0.0' },
  sources: { prd_index: 'source-index/index.yaml' },
  assets: {
    knowledge: 'knowledge/',
    page_mappings: 'page-mappings/',
    scenarios: 'scenarios/',
    testcases: 'testcases/',
    data_recipes: 'data-recipes/',
    test_suites: 'test-suites/',
  },
}, { lineWidth: 0, aliasDuplicateObjects: false }), 'utf8');

fs.writeFileSync(path.join(OUT, 'source-index', 'index.yaml'), YAML.stringify({
  schema_version: '1.0',
  module_id: 'foundation',
  module_name: '基础管理（关键对象）',
  notes: '规则来源 reports/foundation/FIELD-RULE-MATRIX.csv（Gate C 真实 UI 采集），不含 PRD 推断。',
}, { lineWidth: 0, aliasDuplicateObjects: false }), 'utf8');

let totalRules = 0;
for (const page of PAGES) {
  const fields = records.filter((row) => row.code === page.code && !row.page.includes('子表'));
  const menuPath = ['基础管理', page.group, page.name];
  const sourceRef = (excerpt) => ({
    document_id: `FDN-${page.code}`,
    file_path: 'reports/foundation/FIELD-RULE-MATRIX.csv',
    source_type: 'UI_OBSERVED',
    section: page.name,
    excerpt,
  });

  const nameFields = fields.filter((row) => /名称|简称|描述/.test(row.label) && row.path !== page.codeField).slice(0, 2);
  const mappingFields = [page.codeField, ...nameFields.map((row) => row.path)].map((fieldPath) => {
    const row = fields.find((entry) => entry.path === fieldPath);
    return {
      name: fieldPath,
      label: row?.label ?? page.codeLabel,
      control_type: controlType(row?.control ?? '文本'),
      locator: { strategy: 'css', value: `[id="${fieldPath}"]`, unique: false },
      required: Boolean(row?.required),
      readonly: Boolean(row?.readonly),
      verified: false,
      source_ref: sourceRef(`${page.name} / ${row?.label ?? page.codeLabel}（Gate C 页面盘点）`),
    };
  });

  fs.writeFileSync(path.join(OUT, 'page-mappings', `${page.key}.yaml`), YAML.stringify({
    schema_version: '1.0',
    module_id: 'foundation',
    page_key: page.key,
    page_name: page.name,
    navigation: { menu_path: menuPath, work_item_code: page.code, route: page.key },
    status: 'candidate',
    review_status: 'needs_review',
    locator_priority: ['css', 'label', 'role'],
    fields: mappingFields,
  }, { lineWidth: 0, aliasDuplicateObjects: false }), 'utf8');

  const rules = [];
  let seq = 0;
  const push = (rule) => { seq += 1; totalRules += 1; rules.push({ id: `FR-FDN-${page.key.toUpperCase().replace(/-/g, '')}-${String(seq).padStart(3, '0')}`, ...rule }); };
  for (const row of fields) {
    const base = { field: row.path, trigger: 'FORM_OPEN', status: 'verified', source_ref: sourceRef(`${page.name} / ${row.path} / ${row.label}`) };
    if (row.required) push({ type: 'REQUIRED', ...base, expected: { required: true } });
    if (row.readonly) push({ type: 'READONLY', ...base, expected: { readonly: true } });
    if (row.disabled) push({ type: 'DISABLED', ...base, expected: { disabled: true } });
    if (row.value && !/^请(选择|输入)/.test(row.value.trim()) && !row.value.includes('点击右侧图标') && row.value.trim() !== '-') {
      push({ type: 'DEFAULT_VALUE', ...base, expected: { value_mode: 'equals', value: row.value.trim() } });
    }
    if (row.maxLength && Number(row.maxLength) > 0) {
      push({ type: 'MAX_LENGTH', ...base, expected: { max_length: Number(row.maxLength) } });
    }
  }
  push({
    type: 'UNIQUE', field: page.codeField, trigger: 'SAVE', status: page.unique,
    expected: { unique: true, message_contains: '重复' },
    source_ref: sourceRef(`${page.name} / ${page.codeField} / 编码唯一性`),
    notes: '由 foundation-field-rules 流程填入列表已有编码并观察保存按钮/悬浮提示',
  });
  if (page.code === 'xwpefqwlWQqi') {
    push({
      type: 'DEFAULT_VALUE', field: 'cust_base_info.brach_count', trigger: 'FORM_OPEN', status: 'candidate',
      expected: { value_mode: 'not_empty' },
      source_ref: sourceRef('客户通用信息 / 分店数 / DEF-02 默认空值'),
      notes: 'Gate C DEF-02：默认空值提交会触发后端 ConversionException，候选规则违反记 warning',
    });
  }

  fs.writeFileSync(path.join(OUT, 'field-rules', `${page.key}.yaml`), YAML.stringify({
    schema_version: '1.0',
    module_id: 'foundation',
    page_key: page.key,
    rules,
  }, { lineWidth: 0, aliasDuplicateObjects: false }), 'utf8');

  fs.writeFileSync(path.join(OUT, 'testcases', `SMOKE-FOUNDATION-${page.key.toUpperCase().replace(/-/g, '')}-FIELD-RULES.yaml`), YAML.stringify({
    schema_version: '1.0',
    id: `SMOKE-FOUNDATION-${page.key.toUpperCase().replace(/-/g, '')}-FIELD-RULES`,
    module_id: 'foundation',
    version: '0.1.0',
    title: `${page.name}字段规则`,
    objective: `在真实新增表单上验证${page.name}的必填、默认值、只读、禁用、长度与唯一性规则`,
    scenario_refs: [`SCN-FOUNDATION-${page.key.toUpperCase().replace(/-/g, '')}`],
    source_refs: [sourceRef(`${page.name} 字段规则集合（Gate C 采集）`)],
    preconditions: ['已登录测试环境并具备基础管理查看权限', '仅打开新增表单，不保存业务数据'],
    data_recipe_refs: [],
    dependencies: [],
    steps: [
      { action: 'navigate', target: page.key, timeout_ms: 60000, evidence: true },
      { action: 'invoke_flow', target: 'foundation-field-rules', value: JSON.stringify({ pageKey: page.key }), evidence: true },
    ],
    assertions: [{
      type: 'status',
      target: `${page.name}字段规则`,
      expected: '规则无失败（候选规则警告允许）',
      level: 'business',
      source_ref: sourceRef(`${page.name} 字段规则汇总`),
    }],
    cleanup_policy: 'keep',
    status: 'reviewed',
    timeout_ms: 300000,
    retry_policy: { max_attempts: 1, retry_safe_actions_only: true },
  }, { lineWidth: 0, aliasDuplicateObjects: false }), 'utf8');

  console.log(`${page.key}: fields=${fields.length} rules=${rules.length}`);
}
console.log('TOTAL_RULES=' + totalRules);
