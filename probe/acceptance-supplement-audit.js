// Supplementary audits requested by team-lead:
//  A) .scan-state.json historical keys / .parse-cache orphan files (KNOWN_LIMITATIONS §四.3/§四.4)
//  B) 02 §10 13-field scenario contract vs delivered scenarios.json
//  C) schema_version recorded in reports (04 §7)
//  D) status enum (EXECUTABLE/APPROVED) check
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const ROOT = path.resolve(__dirname, '..');
const K = path.join(ROOT, 'artifacts/knowledge');
const SI = path.join(ROOT, 'artifacts/source-index');
const OUT = path.join(ROOT, 'artifacts/acceptance/_snapshots/08-supplement-audit.json');
const { loadPrdConfig } = require(path.join(ROOT, 'dist/prd/config.js'));
const { scanSources } = require(path.join(ROOT, 'dist/prd/scanner.js'));

const R = {};

// ---- A) scan-state / parse-cache ----
const config = loadPrdConfig({ repoRoot: ROOT });
const fresh = scanSources(config, 'INCREMENTAL'); // READ ONLY: does not write state
const freshKeys = new Set(Object.keys(fresh.state.files));
const onDisk = JSON.parse(fs.readFileSync(path.join(SI, '.scan-state.json'), 'utf8'));
const diskKeys = new Set(Object.keys(onDisk.files));
const staleKeys = [...diskKeys].filter((k) => !freshKeys.has(k));
const missingKeys = [...freshKeys].filter((k) => !diskKeys.has(k));
R.scan_state = {
  on_disk_keys: diskKeys.size,
  fresh_computed_keys: freshKeys.size,
  stale_keys_not_in_current_source: staleKeys.length,
  stale_key_samples: staleKeys.slice(0, 10),
  missing_keys_in_disk: missingKeys.length,
  missing_key_samples: missingKeys.slice(0, 10),
  fresh_incremental_summary: {
    total_files: fresh.summary.total_files,
    supported_files: fresh.summary.supported_files,
    new_documents: fresh.summary.new_documents,
    modified_documents: fresh.summary.modified_documents,
    unchanged_documents: fresh.summary.unchanged_documents,
    missing_documents: fresh.summary.missing_documents,
    mode: fresh.summary.mode,
  },
};

const documents = JSON.parse(fs.readFileSync(path.join(K, 'documents.json'), 'utf8'));
const docIds = new Set(documents.map((d) => d.id));
const cacheDir = path.join(SI, '.parse-cache');
const cacheFiles = fs.readdirSync(cacheDir).filter((f) => f.endsWith('.json'));
const orphanCaches = [];
const staleSha = [];
const shaByDoc = new Map(Object.entries(onDisk.files).map(([k, v]) => [v.document_id, v.sha256]));
for (const f of cacheFiles) {
  const docId = f.replace(/\.json$/, '');
  if (!docIds.has(docId)) orphanCaches.push(f);
  try {
    const env = JSON.parse(fs.readFileSync(path.join(cacheDir, f), 'utf8'));
    const expected = shaByDoc.get(docId);
    if (expected && env.sha256 !== expected) staleSha.push({ file: f, cache_sha: env.sha256, state_sha: expected });
  } catch (e) { /* ignore unreadable */ }
}
R.parse_cache = {
  cache_files: cacheFiles.length,
  document_count: docIds.size,
  orphan_cache_files_not_in_documents: orphanCaches.length,
  orphan_samples: orphanCaches.slice(0, 10),
  cache_entries_with_sha_mismatch_vs_state: staleSha.length,
  mismatch_samples: staleSha.slice(0, 5),
};

// ---- B) 02 §10 13-field scenario contract ----
const scenarios = JSON.parse(fs.readFileSync(path.join(K, 'scenarios.json'), 'utf8'));
const fields = new Set();
for (const s of scenarios) for (const k of Object.keys(s)) fields.add(k);
const contract = [
  ['scenario_id', ['scenario_id', 'id'], 'OK(字段名为 id)'],
  ['标题', ['title'], null],
  ['所属模块', ['module'], null],
  ['业务对象', ['business_object'], null],
  ['测试目标', ['test_goal', 'objective', 'test_objective', 'goal'], null],
  ['场景类型', ['scenario_type'], null],
  ['前置条件', ['preconditions'], null],
  ['测试数据需求', ['data_requirements'], null],
  ['操作步骤草案', ['steps'], null],
  ['预期结果与断言点', ['expected_result', 'expected'], '仅嵌在 assertions[].expected'],
  ['关联规则 ID', ['rule_ids'], null],
  ['关联文档及证据', ['document_ids', 'source_refs'], null],
  ['自动化可行性', ['automation_feasibility'], null],
];
R.contract_02_section10 = {
  scenario_fields: [...fields].sort(),
  fields_check: contract.map(([label, candidates, note]) => ({
    item: label,
    present_as: candidates.filter((c) => fields.has(c)),
    status: candidates.some((c) => fields.has(c)) ? 'PRESENT' : 'MISSING',
    note: note || '',
  })),
  missing_items: contract.filter(([, c]) => !c.some((x) => fields.has(x))).map(([l]) => l),
};
// 02 §10: 规则未确认/前置数据不明/断言不可观察时不得标为可直接执行
const rules = JSON.parse(fs.readFileSync(path.join(K, 'rules.json'), 'utf8'));
const ruleById = new Map(rules.map((r) => [r.id, r]));
let uiReady = 0, uiReadyDerived = 0, uiReadyNoAssertion = 0, uiReadyPrecondGeneric = 0;
for (const s of scenarios) {
  if (s.automation_feasibility !== 'UI_READY') continue;
  uiReady += 1;
  if ((s.rule_ids || []).some((id) => { const r = ruleById.get(id); return r && r.source_type === 'PRD_DERIVED'; })) uiReadyDerived += 1;
  if (!s.assertions || s.assertions.length === 0) uiReadyNoAssertion += 1;
  if ((s.preconditions || []).every((p) => /^前置数据：/.test(p))) uiReadyPrecondGeneric += 1;
}
R.contract_02_section10.executable_rule_check = {
  ui_ready_total: uiReady,
  ui_ready_with_derived_rule: uiReadyDerived,
  ui_ready_without_assertion: uiReadyNoAssertion,
  ui_ready_with_generic_template_precondition: uiReadyPrecondGeneric,
  rule_text: '规则未确认、前置数据不明或断言不可观察时，不得标记为可直接执行（02 §10）',
};

// ---- C) schema_version in reports ----
const reportDir = path.join(ROOT, 'reports');
const schemaVersionMentions = [];
for (const f of fs.readdirSync(reportDir)) {
  const content = fs.readFileSync(path.join(reportDir, f), 'utf8');
  if (/schema_version|schema 版本|Schema 版本|schema版本/i.test(content)) schemaVersionMentions.push(f);
}
R.schema_version = {
  summary_json_value: JSON.parse(fs.readFileSync(path.join(K, 'summary.json'), 'utf8')).schema_version,
  reports_mentioning_schema_version: schemaVersionMentions,
  requirement_04_section7: '报告必须记录 schema 版本，避免不同批次结果被错误比较',
};

// ---- D) status enum ----
R.status_enum = { allowed: ['DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'EXECUTABLE'], observed: {}, non_draft: 0 };
for (const s of scenarios) R.status_enum.observed[s.status] = (R.status_enum.observed[s.status] || 0) + 1;
R.status_enum.non_draft = scenarios.filter((s) => s.status !== 'DRAFT').length;

fs.writeFileSync(OUT, JSON.stringify(R, null, 2), 'utf8');
console.log(JSON.stringify(R, null, 2));
console.log(`\nfull result -> ${OUT}`);
