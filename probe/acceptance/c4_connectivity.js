// C 项取证 4：实际执行 KnowledgeBase.load，验证 Phase 1 产出能否被框架既有 API 读取
// 不连接 ERP、不启动浏览器：只读取本地 JSON 文件。
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, 'isolated', 'dist');
const { KnowledgeBase } = require(path.join(ROOT, 'knowledge', 'knowledge-base.js'));
const { loadConfig } = require(path.join(ROOT, 'config', 'athena-config.js'));

function run(label, configPath, knowledgeOverride) {
  const cfg = loadConfig(configPath);
  if (knowledgeOverride) cfg.paths.knowledge = knowledgeOverride;
  try {
    const kb = KnowledgeBase.load(cfg);
    return {
      label, ok: true,
      knowledge_dir: path.resolve(cfg.projectRoot, cfg.paths.knowledge),
      pages: kb.bundle.pages.length,
      rules: kb.bundle.rules.length,
      components: Object.keys(kb.bundle.components).length,
      prd_entries: kb.bundle.prdIndex ? kb.bundle.prdIndex.entries.length : 0,
      has_phase1_fields: Object.prototype.hasOwnProperty.call(kb.bundle, 'fields'),
      has_phase1_entities: Object.prototype.hasOwnProperty.call(kb.bundle, 'entities'),
      has_phase1_scenarios: Object.prototype.hasOwnProperty.call(kb.bundle, 'scenarios'),
      bundle_keys: Object.keys(kb.bundle),
    };
  } catch (e) {
    return { label, ok: false, error: String(e.message).split('\n')[0],
             knowledge_dir: path.resolve(cfg.projectRoot, cfg.paths.knowledge) };
  }
}

const rows = [];
rows.push(run('default-config', 'config/athena.config.json'));
rows.push(run('point-to-phase1-artifacts', 'config/athena.config.json', 'artifacts/knowledge'));
// 列出两个目录的文件名，证明互不重叠
const legacy = fs.readdirSync('knowledge').filter((x) => x.endsWith('.json')).sort();
const phase1 = fs.readdirSync('artifacts/knowledge').filter((x) => x.endsWith('.json')).sort();
const overlap = legacy.filter((x) => phase1.includes(x));

const out = {
  rows,
  legacy_knowledge_files: legacy,
  phase1_knowledge_files: phase1,
  filename_overlap: overlap,
  phase1_reader_locations: [],
};
// 静态代码证据：全仓 src/ 中读取 artifacts/knowledge 的位置
const { execSync } = require('node:child_process');
try {
  out.static_grep = execSync('grep -rn "artifacts/knowledge" src/ --include=*.ts', { encoding: 'utf8' }).trim().split('\n');
} catch (e) { out.static_grep = []; }
out.knowledge_base_load_reads = [
  'athena-page-map.json', 'athena-component-map.json', 'athena-business-rules.json', 'athena-prd-map.json(optional)'
];
fs.writeFileSync(path.join(__dirname, 'c4_connectivity.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(rows, null, 2));
console.log('LEGACY_FILES', JSON.stringify(legacy));
console.log('PHASE1_FILES', JSON.stringify(phase1));
console.log('FILENAME_OVERLAP', JSON.stringify(overlap));
console.log('STATIC_GREP', JSON.stringify(out.static_grep));
