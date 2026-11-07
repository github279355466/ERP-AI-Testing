// Isolated NFR probe: repeatability / incremental cache / single-file failure isolation.
// All writes go to artifacts/acceptance/_snapshots/_nfr/ ; never touches real deliverables.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const { loadPrdConfig } = require(path.join(ROOT, 'dist/prd/config.js'));
const { buildKnowledge } = require(path.join(ROOT, 'dist/prd/pipeline.js'));

const TMP = path.join(ROOT, 'artifacts/acceptance/_snapshots/_nfr');
const IN = path.join(TMP, 'input');
const OUT = path.join(TMP, 'out');

function fresh() {
  fs.rmSync(TMP, { recursive: true, force: true });
  fs.mkdirSync(IN, { recursive: true });
  fs.mkdirSync(OUT, { recursive: true });
}
const SAMPLE = `# {TITLE}

**PRD类型**：表单
**版本**：V1.0
**业务对象**：{TITLE}（{CODE}）
**数据模型**：\`{CODE}\`（单头）
**所属应用**：smbcloud

## 三、功能说明

### {TITLE}详情页

#### 1. {TITLE}

##### {FIELD} ({FIELDNO})

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | {FIELD} |
| 填值方式 | 文本输入 |
| 字段含义 | 测试字段 |
| 是否必填 | ✅ 是 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 | 无 |
| 开窗类型 | 无 |
| 校验项 | 1. 不可为空 |
`;
function writePrd(name, title, code, field, fieldNo) {
  const dir = path.join(IN, name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, `${name}.v1.0.md`),
    SAMPLE.replace(/\{TITLE\}/g, title).replace(/\{CODE\}/g, code).replace(/\{FIELD\}/g, field).replace(/\{FIELDNO\}/g, fieldNo), 'utf8');
}
function config() {
  const c = loadPrdConfig({ repoRoot: TMP, configPath: path.join(TMP, 'no-such-config.json'), prdDirOverride: IN });
  c.scenarioSources = [];
  c.output.artifactDir = path.join(OUT, 'artifacts');
  c.output.knowledgeDir = path.join(OUT, 'artifacts', 'knowledge');
  c.output.reportDir = path.join(OUT, 'reports');
  c.output.sourceIndexDir = path.join(OUT, 'artifacts', 'source-index');
  return c;
}
const strip = (o) => JSON.stringify(o, (k, v) => {
  if (['updated_at', 'generated_at', 'extracted_at', 'scanned_at', 'created_at', 'modified_at', 'last_scan_status'].includes(k)) return '<T>';
  return v;
});
const ids = (r) => ({
  docs: r.bundle.documents.map((d) => d.id).sort(),
  rules: r.bundle.rules.map((x) => x.id).sort(),
  scenarios: r.bundle.scenarios.map((x) => x.id).sort(),
  fields: r.bundle.fields.map((x) => x.id).sort(),
});
function cacheHashes() {
  const dir = path.join(OUT, 'artifacts', 'source-index', '.parse-cache');
  const out = {};
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir)) out[f] = require('node:crypto').createHash('sha256').update(fs.readFileSync(path.join(dir, f))).digest('hex');
  return out;
}

console.log('=== NFR PROBE (isolated temp sandbox) ===');
fresh();
writePrd('A', '单据A', 'doc_a', '单号A', 'doc_no_a');
writePrd('B', '单据B', 'doc_b', '单号B', 'doc_no_b');
writePrd('C', '单据C', 'doc_c', '单号C', 'doc_no_c');
const c = config();

// --- 1. repeatability: two identical FULL runs ---
let r1, r2, repeatErr = null;
try { r1 = buildKnowledge(c, 'FULL', { useCache: false }); r2 = buildKnowledge(c, 'FULL', { useCache: false }); }
catch (e) { repeatErr = e; }
if (repeatErr) console.log('  [可重复] build threw: ' + repeatErr.message);
else {
  const a = ids(r1), b = ids(r2);
  const idSame = JSON.stringify(a) === JSON.stringify(b);
  const bundleSame = strip(r1.bundle) === strip(r2.bundle);
  console.log(`  [可重复] 2xFULL: ids identical=${idSame} (docs=${a.docs.length} rules=${a.rules.length} scenarios=${a.scenarios.length} fields=${a.fields.length})`);
  console.log(`  [可重复] normalized bundle identical=${bundleSame}`);
  console.log(`  [可重复] run1 mode=${r1.scan.summary.mode} new=${r1.scan.summary.new_documents} unchanged=${r1.scan.summary.unchanged_documents}`);
  console.log(`  [可重复] run2 mode=${r2.scan.summary.mode} new=${r2.scan.summary.new_documents} unchanged=${r2.scan.summary.unchanged_documents}`);
}

// --- 2. incremental: only changed file re-parsed ---
const before = cacheHashes();
const changedFile = path.join(IN, 'B', 'B.v1.0.md');
fs.appendFileSync(changedFile, '\n## 补充章节\n\n新增说明。\n', 'utf8');
// wait a tick to avoid identical mtime, but we compare content hash anyway
const inc = buildKnowledge(c, 'INCREMENTAL', { useCache: true });
const after = cacheHashes();
const rewritten = Object.keys(after).filter((k) => before[k] !== after[k]);
const added = Object.keys(after).filter((k) => !before[k]);
console.log(`  [增量] mode=${inc.scan.summary.mode} new=${inc.scan.summary.new_documents} modified=${inc.scan.summary.modified_documents} unchanged=${inc.scan.summary.unchanged_documents} missing=${inc.scan.summary.missing_documents}`);
console.log(`  [增量] cache files before=${Object.keys(before).length} after=${Object.keys(after).length} rewritten=${rewritten.length} [${rewritten.join(', ')}] added=${added.length}`);

// --- 3. recovery: a malformed file among good ones ---
fs.writeFileSync(path.join(IN, 'A', 'broken.json'), '{"prd_spec": [null, 123, {"x": }]}', 'utf8');
let recErr = null, rec = null;
try { rec = buildKnowledge(c, 'FULL', { useCache: false }); }
catch (e) { recErr = e; }
if (recErr) console.log(`  [可恢复] build THREW on malformed file -> whole batch aborted: ${recErr.constructor.name}: ${String(recErr.message).slice(0, 160)}`);
else console.log(`  [可恢复] build completed; documents=${rec.bundle.documents.length} parse_issues=${rec.bundle.issues.length} -> failure isolated`);

console.log('=== END NFR PROBE ===');
