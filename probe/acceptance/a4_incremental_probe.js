// A 项取证 4：在完全隔离的临时副本目录里实际运行 FULL / INCREMENTAL，验证增量判定、缓存命中与删除语义
// 运行：node probe/acceptance/a4_incremental_probe.js
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, 'isolated');
const IN = path.join(ROOT, 'in');
const OUT = path.join(ROOT, 'out');
const PRD = path.join(IN, 'prd');
const CASES = path.join(IN, 'cases');
const SI = path.join(OUT, 'source-index');
const KD = path.join(OUT, 'knowledge');
const RD = path.join(OUT, 'reports');

const { buildKnowledge } = require(path.join(ROOT, 'dist', 'prd', 'pipeline.js'));
const { loadPrdConfig } = require(path.join(ROOT, 'dist', 'prd', 'config.js'));

function reset() {
  fs.rmSync(IN, { recursive: true, force: true });
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(PRD, { recursive: true });
  fs.mkdirSync(CASES, { recursive: true });
  // 复制真实 PRD 的 3 个小文件（只读复制，原件不动）
  const srcRoot = 'C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd';
  const copies = [
    ['四单PRD-平台对接会议议程.md', 'A.md'],
    ['四单PRD-平台确认事项清单.md', 'B.md'],
    ['四单PRD-第5轮修订审查报告.md', 'C.md'],
  ];
  for (const [src, dst] of copies) {
    fs.copyFileSync(path.join(srcRoot, src), path.join(PRD, dst));
  }
  // 隐藏目录 / 配置排除目录 / 临时文件 / 不支持格式（用于验证 F1 排除规则）
  fs.mkdirSync(path.join(PRD, '.hidden'), { recursive: true });
  fs.writeFileSync(path.join(PRD, '.hidden', 'hidden.md'), '# hidden\n');
  fs.mkdirSync(path.join(PRD, '.cache'), { recursive: true });
  fs.writeFileSync(path.join(PRD, '.cache', 'cache.md'), '# cache\n');
  fs.mkdirSync(path.join(PRD, 'node_modules'), { recursive: true });
  fs.writeFileSync(path.join(PRD, 'node_modules', 'nm.md'), '# nm\n');
  fs.writeFileSync(path.join(PRD, '~$temp.md'), '# temp\n');
  fs.writeFileSync(path.join(PRD, 'manual.docx'), 'fake docx');
  fs.writeFileSync(path.join(PRD, 'shot.png'), 'fake png');
}

const config = {
  project: { name: 'acceptance', schemaVersion: '1.0.0', timezone: 'Asia/Shanghai' },
  prd: {
    inputDir: PRD,
    includeExtensions: ['.md', '.markdown', '.txt', '.json'],
    reservedExtensions: ['.docx', '.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg'],
    excludeDirectories: ['.git', 'node_modules', '__pycache__', '.cache'],
    moduleRules: [{ pattern: '^采购域$', module: '采购' }],
  },
  scenarioSources: [{ name: '测试用例', inputDir: CASES, kind: 'TEST_CASE_LIBRARY' }],
  output: { artifactDir: OUT, reportDir: RD, knowledgeDir: KD, sourceIndexDir: SI },
  policy: {
    allowExternalModelCalls: false, allowErpConnectionInPhase1: false,
    scenarioDefaultStatus: 'DRAFT', requireEvidenceForExplicitRules: true, maxRulesPerDocument: 400,
  },
};

function reg() {
  return JSON.parse(fs.readFileSync(path.join(SI, 'DOCUMENT_REGISTER.json'), 'utf8'));
}
function docs() {
  return JSON.parse(fs.readFileSync(path.join(KD, 'documents.json'), 'utf8'));
}
function cacheFiles() {
  const dir = path.join(SI, '.parse-cache');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    const env = JSON.parse(fs.readFileSync(p, 'utf8'));
    return { name, mtimeMs: st.mtimeMs, extracted_at: env.extracted_at, sha256: env.sha256, parser_version: env.parser_version };
  });
}
function snap(label) {
  const r = reg();
  const d = docs();
  const c = cacheFiles();
  const state = JSON.parse(fs.readFileSync(path.join(SI, '.scan-state.json'), 'utf8'));
  const row = {
    label,
    mode: r.mode,
    summary: r.summary,
    register_count: r.documents.length,
    register_status: r.documents.reduce((acc, x) => { acc[x.status] = (acc[x.status] || 0) + 1; return acc; }, {}),
    register_paths: r.documents.map((x) => x.relative_path),
    documents_count: d.length,
    documents_last_scan_status: d.reduce((acc, x) => { acc[x.last_scan_status] = (acc[x.last_scan_status] || 0) + 1; return acc; }, {}),
    documents_is_latest: d.filter((x) => x.is_latest).length,
    cache_count: c.length,
    cache_extracted_at: [...new Set(c.map((x) => x.extracted_at))],
    state_count: Object.keys(state.files).length,
    state_keys: Object.keys(state.files),
  };
  return row;
}

function main() {
  reset();
  const rows = [];
  // 1) FULL
  buildKnowledge(config, 'FULL', { useCache: false });
  rows.push(snap('1-FULL'));
  const cacheBefore = new Map(cacheFiles().map((x) => [x.name, x.extracted_at]));
  // 2) INCREMENTAL 无变化
  buildKnowledge(config, 'INCREMENTAL', { useCache: true });
  rows.push(snap('2-INCREMENTAL-NOCHANGE'));
  const cacheAfterHit = cacheFiles();
  const cacheHitNoRewrite = cacheAfterHit.every((x) => cacheBefore.get(x.name) === x.extracted_at);
  // 3) 修改 B.md
  fs.appendFileSync(path.join(PRD, 'B.md'), '\n<!-- acceptance modified -->\n');
  buildKnowledge(config, 'INCREMENTAL', { useCache: true });
  rows.push(snap('3-INCREMENTAL-MODIFIED-B'));
  // 4) 新增 D.md
  fs.copyFileSync(path.join(PRD, 'A.md'), path.join(PRD, 'D.md'));
  fs.appendFileSync(path.join(PRD, 'D.md'), '\n<!-- new doc -->\n');
  buildKnowledge(config, 'INCREMENTAL', { useCache: true });
  rows.push(snap('4-INCREMENTAL-NEW-D'));
  const docsBeforeDelete = docs().map((x) => x.relative_path);
  // 5) 删除 C.md
  fs.rmSync(path.join(PRD, 'C.md'));
  buildKnowledge(config, 'INCREMENTAL', { useCache: true });
  rows.push(snap('5-INCREMENTAL-DELETED-C'));
  const docsAfterDelete = docs().map((x) => x.relative_path);
  const remain = docsBeforeDelete.filter((p) => !docsAfterDelete.includes(p));
  const cacheAfterDelete = cacheFiles().map((x) => x.name);

  const report = {
    config_used: { prd: PRD, cases: CASES, sourceIndexDir: SI, knowledgeDir: KD, reportDir: RD },
    cache_hit_no_rewrite: cacheHitNoRewrite,
    deleted_doc_paths: remain,
    cache_after_delete_count: cacheAfterDelete.length,
    cache_after_delete_names: cacheAfterDelete,
    rows,
  };
  fs.writeFileSync(path.join(__dirname, 'a4_incremental_probe.json'), JSON.stringify(report, null, 2), 'utf8');
  for (const r of rows) {
    console.log(JSON.stringify({
      label: r.label, mode: r.mode, summary: r.summary, register_count: r.register_count,
      register_status: r.register_status, documents_count: r.documents_count,
      documents_last_scan_status: r.documents_last_scan_status, cache_count: r.cache_count,
      cache_extracted_at: r.cache_extracted_at, state_count: r.state_count,
      register_paths: r.register_paths.slice(0, 12),
    }, null, 0));
  }
  console.log('CACHE_HIT_NO_REWRITE', cacheHitNoRewrite);
  console.log('DELETED_DOC_PATHS', JSON.stringify(remain));
  console.log('CACHE_AFTER_DELETE_COUNT', cacheAfterDelete.length);
}

main();
