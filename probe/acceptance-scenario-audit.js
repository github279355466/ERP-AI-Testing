// Phase 1 acceptance: F (scenario quality) data audit.
// Reads delivered artifacts/knowledge/*.json read-only; writes result JSON to _snapshots/.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const K = path.join(ROOT, 'artifacts/knowledge');
const OUT = path.join(ROOT, 'artifacts/acceptance/_snapshots/06-data-audit.json');

function load(name) { return JSON.parse(fs.readFileSync(path.join(K, name), 'utf8')); }
const scenarios = load('scenarios.json');
const rules = load('rules.json');
const cases = load('existing-cases.json');
const docs = load('documents.json');

const R = {};
const tally = (arr, key) => {
  const m = {};
  for (const x of arr) { const k = String(x[key]); m[k] = (m[k] || 0) + 1; }
  return m;
};
const nonEmptyArr = (v) => Array.isArray(v) && v.length > 0;
const nonEmptyStr = (v) => typeof v === 'string' && v.trim().length > 0;

// ---------- 1. structure / status ----------
R.total_scenarios = scenarios.length;
R.total_rules = rules.length;
R.total_existing_cases = cases.length;
R.total_documents = docs.length;
const keySet = new Set();
for (const s of scenarios) for (const k of Object.keys(s)) keySet.add(k);
R.scenario_fields = [...keySet].sort();
R.field_presence = {};
for (const k of R.scenario_fields) R.field_presence[k] = scenarios.filter((s) => s[k] !== undefined).length;
R.status_dist = tally(scenarios, 'status');
R.review_required_dist = tally(scenarios, 'review_required');
R.feasibility_dist = tally(scenarios, 'automation_feasibility');
R.scenario_type_dist = tally(scenarios, 'scenario_type');
R.module_dist = tally(scenarios, 'module');
R.origin_dist = tally(scenarios, 'origin');
R.non_draft_scenarios = scenarios.filter((s) => s.status !== 'DRAFT').map((s) => s.id);
R.review_required_false = scenarios.filter((s) => s.review_required !== true).length;

// ---------- 2. completeness of five elements ----------
const elems = {
  preconditions: (s) => nonEmptyArr(s.preconditions),
  steps: (s) => nonEmptyArr(s.steps),
  expected: (s) => nonEmptyArr(s.assertions) && s.assertions.every((a) => nonEmptyStr(a.expected)),
  assertions: (s) => nonEmptyArr(s.assertions),
  evidence_source_refs: (s) => nonEmptyArr(s.source_refs) && s.source_refs.every((r) => nonEmptyStr(r.document_id) && nonEmptyStr(r.file_path)),
};
R.five_elements = {};
for (const [k, fn] of Object.entries(elems)) {
  const missing = scenarios.filter((s) => !fn(s));
  R.five_elements[k] = { present: scenarios.length - missing.length, missing: missing.length, sample_ids: missing.slice(0, 5).map((s) => s.id) };
}
R.has_dedicated_expected_field = R.scenario_fields.includes('expected') || R.scenario_fields.includes('expected_result');
R.has_dedicated_evidence_field = R.scenario_fields.some((k) => /evidence/i.test(k));
R.source_refs_with_line = scenarios.filter((s) => nonEmptyArr(s.source_refs) && s.source_refs.some((r) => typeof r.line_start === 'number')).length;
R.source_refs_with_excerpt = scenarios.filter((s) => nonEmptyArr(s.source_refs) && s.source_refs.some((r) => nonEmptyStr(r.excerpt))).length;
R.rule_ids_empty = scenarios.filter((s) => !nonEmptyArr(s.rule_ids)).length;
R.document_ids_empty = scenarios.filter((s) => !nonEmptyArr(s.document_ids)).length;
R.data_requirements_empty = scenarios.filter((s) => !nonEmptyArr(s.data_requirements)).length;
R.business_object_null = scenarios.filter((s) => !s.business_object).length;
R.assertion_types = {};
for (const s of scenarios) for (const a of (s.assertions || [])) { const k = String(a.type); R.assertion_types[k] = (R.assertion_types[k] || 0) + 1; }

// ---------- 3. rule reference resolution ----------
const ruleById = new Map(rules.map((r) => [r.id, r]));
const docIds = new Set(docs.map((d) => d.id));
let danglingRuleRefs = 0, scenariosWithDangling = 0, danglingDocRefs = 0;
for (const s of scenarios) {
  let bad = false;
  for (const id of (s.rule_ids || [])) if (!ruleById.has(id)) { danglingRuleRefs += 1; bad = true; }
  if (bad) scenariosWithDangling += 1;
  for (const id of (s.document_ids || [])) if (!docIds.has(id)) danglingDocRefs += 1;
}
R.dangling_rule_refs = danglingRuleRefs;
R.scenarios_with_dangling_rule_refs = scenariosWithDangling;
R.dangling_document_refs = danglingDocRefs;

// ---------- 4. F7: derived-rule scenarios must be NEEDS_CONFIRMATION ----------
const derived = rules.filter((r) => r.source_type === 'PRD_DERIVED');
R.derived_rule_count_all_versions = derived.length;
R.rule_source_type_dist = tally(rules, 'source_type');
let scWithDerived = 0, scDerivedAndNotNC = 0, scDerivedAndNC = 0, scDerivedAndUIReady = 0;
const derivedFeas = {}, derivedType = {};
const samples = [];
for (const s of scenarios) {
  const hit = (s.rule_ids || []).some((id) => { const r = ruleById.get(id); return r && r.source_type === 'PRD_DERIVED'; });
  if (!hit) continue;
  scWithDerived += 1;
  const f = s.automation_feasibility;
  derivedFeas[f] = (derivedFeas[f] || 0) + 1;
  derivedType[s.scenario_type] = (derivedType[s.scenario_type] || 0) + 1;
  if (f === 'NEEDS_CONFIRMATION') scDerivedAndNC += 1;
  else { scDerivedAndNotNC += 1; if (f === 'UI_READY') scDerivedAndUIReady += 1; if (samples.length < 8) samples.push({ id: s.id, type: s.scenario_type, feasibility: f, rule_ids: s.rule_ids.slice(0, 3) }); }
}
R.f7 = {
  scenarios_with_derived_rule: scWithDerived,
  marked_needs_confirmation: scDerivedAndNC,
  NOT_marked_needs_confirmation: scDerivedAndNotNC,
  of_which_UI_READY: scDerivedAndUIReady,
  feasibility_dist: derivedFeas,
  scenario_type_dist: derivedType,
  violation_samples: samples,
};
// also: total scenarios marked NEEDS_CONFIRMATION
R.total_needs_confirmation = scenarios.filter((s) => s.automation_feasibility === 'NEEDS_CONFIRMATION').length;
R.total_ui_ready = scenarios.filter((s) => s.automation_feasibility === 'UI_READY').length;

// ---------- 5. 8 coverage categories ----------
const byType = R.scenario_type_dist;
const sum = (types) => types.reduce((n, t) => n + (byType[t] || 0), 0);
R.eight_categories = [
  { name: '正常业务场景（正向流程 / HAPPY_PATH）', types: ['正向流程', '正常流程', 'HAPPY_PATH', '正向', '回归'], count: sum(['正向流程', '正常流程', 'HAPPY_PATH', '正向', '回归']) },
  { name: '必填与字段校验', types: ['必填校验', '只读校验', '隐藏校验', '禁用校验', '默认值', '开窗回填', '唯一性', '反向校验'], count: sum(['必填校验', '只读校验', '隐藏校验', '禁用校验', '默认值', '开窗回填', '唯一性', '反向校验']) },
  { name: '边界值', types: ['边界值'], count: sum(['边界值']) },
  { name: '异常输入 / 异常恢复', types: ['异常输入', '异常恢复', '异常'], count: sum(['异常输入', '异常恢复', '异常']) },
  { name: '状态变化（状态迁移）', types: ['状态迁移'], count: sum(['状态迁移']) },
  { name: '单据上下游关系', types: ['上下游关联'], count: sum(['上下游关联']) },
  { name: '数量与金额约束', types: ['数量与金额'], count: sum(['数量与金额']) },
  { name: '权限与操作限制', types: ['权限与数据范围'], count: sum(['权限与数据范围']) },
];
// keyword evidence (secondary, on title+name+steps)
const kw = {
  normal: /正向|正常流程|正常业务|保存成功|新增成功/,
  required: /必填|不可为空|只读|隐藏|禁用|默认值|开窗|唯一|重复/,
  boundary: /边界|精度|超限|最大|最小|取位/,
  exception: /异常|失败|错误|非法|无效|不允许/,
  state: /状态|审核|撤审|结案|过账|作废/,
  upstream: /上游|下游|取单|来源单据|回写|关联/,
  amount: /数量|金额|单价|税额|汇率|计算|合计/,
  permission: /权限|数据范围|不可用|操作限制/,
};
R.keyword_hits = {};
for (const [k, re] of Object.entries(kw)) {
  R.keyword_hits[k] = scenarios.filter((s) => re.test([s.title, s.name, ...(s.steps || []), ...(s.preconditions || [])].join(' '))).length;
}

// ---------- 6. scenario <-> existing case traceability ----------
const caseRuleIds = new Set();
for (const c of cases) for (const id of (c.rule_ids || [])) caseRuleIds.add(String(id));
const scenRuleIds = new Set();
for (const s of scenarios) for (const id of (s.rule_ids || [])) scenRuleIds.add(String(id));
let overlap = 0;
for (const id of caseRuleIds) if (scenRuleIds.has(id)) overlap += 1;
R.traceability = {
  case_rule_id_sample: [...caseRuleIds].slice(0, 8),
  scenario_rule_id_sample: [...scenRuleIds].slice(0, 5),
  case_rule_id_count: caseRuleIds.size,
  scenario_rule_id_count: scenRuleIds.size,
  shared_id_count: overlap,
  scenarios_have_case_ids_field: R.scenario_fields.some((k) => /case/i.test(k)),
  cases_have_scenario_ids_field: Object.keys(cases[0] || {}).some((k) => /scenario/i.test(k)),
};
R.case_fields = Object.keys(cases[0] || {}).sort();

// ---------- 7. coverage-rate arithmetic ----------
R.coverage_arithmetic = {
  covered: 854, considered: 4657, computed_pct: +(854 / 4657 * 100).toFixed(2), reported_pct: 18.3,
  matched_cases: 584, total_cases: cases.length, computed_case_match_pct: +(584 / cases.length * 100).toFixed(2), reported_case_match_pct: 39.5,
  scenario_count: scenarios.length,
  scenarios_over_considered_rules_pct: +(scenarios.length / 4657 * 100).toFixed(2),
};

fs.writeFileSync(OUT, JSON.stringify(R, null, 2), 'utf8');
console.log('=== F DATA AUDIT SUMMARY ===');
console.log(`scenarios=${R.total_scenarios} rules=${R.total_rules} cases=${R.total_existing_cases} docs=${R.total_documents}`);
console.log(`status=${JSON.stringify(R.status_dist)} review_required=${JSON.stringify(R.review_required_dist)} origin=${JSON.stringify(R.origin_dist)}`);
console.log(`feasibility=${JSON.stringify(R.feasibility_dist)}`);
console.log(`scenario_type=${JSON.stringify(R.scenario_type_dist)}`);
console.log(`non_draft=${R.non_draft_scenarios.length} review_required_false=${R.review_required_false}`);
console.log(`five_elements=${JSON.stringify(R.five_elements)}`);
console.log(`dedicated expected field=${R.has_dedicated_expected_field} dedicated evidence field=${R.has_dedicated_evidence_field}`);
console.log(`dangling_rule_refs=${R.dangling_rule_refs} scenarios_with_dangling=${R.scenarios_with_dangling_rule_refs} dangling_doc_refs=${R.dangling_document_refs}`);
console.log(`rule_source_type_dist=${JSON.stringify(R.rule_source_type_dist)}`);
console.log(`F7=${JSON.stringify(R.f7, null, 2)}`);
console.log(`total NEEDS_CONFIRMATION=${R.total_needs_confirmation} UI_READY=${R.total_ui_ready}`);
console.log(`eight_categories=${JSON.stringify(R.eight_categories, null, 2)}`);
console.log(`keyword_hits=${JSON.stringify(R.keyword_hits)}`);
console.log(`traceability=${JSON.stringify(R.traceability, null, 2)}`);
console.log(`coverage_arithmetic=${JSON.stringify(R.coverage_arithmetic, null, 2)}`);
console.log(`\nfull result -> ${OUT}`);
