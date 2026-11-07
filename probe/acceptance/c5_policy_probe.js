// C 项取证 5：在隔离副本里实际改动 policy 三个配置项，观察是否真正生效
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, 'isolated');
const { buildKnowledge } = require(path.join(ROOT, 'dist', 'prd', 'pipeline.js'));

const IN = path.join(ROOT, 'in');
const PRD = path.join(IN, 'prd_policy');
const CASES = path.join(IN, 'cases');

function prepare() {
  fs.rmSync(PRD, { recursive: true, force: true });
  fs.mkdirSync(PRD, { recursive: true });
  const srcRoot = 'C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd';
  const copies = [
    ['会计期间信息/会计期间信息PRD.v1.7.md', '会计期间信息PRD.v1.7.md'],
    ['应收单/应收单PRD.v2.7.md', '应收单PRD.v2.7.md'],
    ['应付单/应付单PRD.v1.10.md', '应付单PRD.v1.10.md'],
  ];
  for (const [src, dst] of copies) {
    const from = path.join(srcRoot, src);
    if (fs.existsSync(from)) fs.copyFileSync(from, path.join(PRD, dst));
  }
}
prepare();

function mkConfig(tag, policy) {
  const OUT = path.join(ROOT, 'out', tag);
  return {
    project: { name: 'acceptance', schemaVersion: '1.0.0', timezone: 'Asia/Shanghai' },
    prd: {
      inputDir: PRD,
      includeExtensions: ['.md', '.markdown', '.txt', '.json'],
      reservedExtensions: ['.docx', '.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg'],
      excludeDirectories: ['.git', 'node_modules', '__pycache__', '.cache'],
      moduleRules: [{ pattern: '^采购域$', module: '采购' }],
    },
    scenarioSources: [{ name: '测试用例', inputDir: CASES, kind: 'TEST_CASE_LIBRARY' }],
    output: {
      artifactDir: OUT, reportDir: path.join(OUT, 'reports'),
      knowledgeDir: path.join(OUT, 'knowledge'), sourceIndexDir: path.join(OUT, 'source-index'),
    },
    policy: Object.assign({
      allowExternalModelCalls: false, allowErpConnectionInPhase1: false,
      scenarioDefaultStatus: 'DRAFT', requireEvidenceForExplicitRules: true, maxRulesPerDocument: 400,
    }, policy),
  };
}

function measure(tag) {
  const KD = path.join(ROOT, 'out', tag, 'knowledge');
  const rules = JSON.parse(fs.readFileSync(path.join(KD, 'rules.json'), 'utf8'));
  const scenarios = JSON.parse(fs.readFileSync(path.join(KD, 'scenarios.json'), 'utf8'));
  const perDoc = {};
  for (const r of rules) perDoc[r.document_id] = (perDoc[r.document_id] || 0) + 1;
  return {
    rules_total: rules.length,
    max_rules_per_doc: Math.max(0, ...Object.values(perDoc)),
    per_doc: perDoc,
    scenario_status: [...new Set(scenarios.map((s) => s.status))],
    scenarios_total: scenarios.length,
    validation: JSON.parse(fs.readFileSync(path.join(KD, 'summary.json'), 'utf8')).validation,
  };
}

const base = mkConfig('policy-baseline', {});
buildKnowledge(base, 'FULL', { useCache: false });
const b = measure('policy-baseline');

const mut = mkConfig('policy-mutated', {
  maxRulesPerDocument: 10,
  scenarioDefaultStatus: 'EXECUTABLE',
  requireEvidenceForExplicitRules: false,
});
buildKnowledge(mut, 'FULL', { useCache: false });
const m = measure('policy-mutated');

const out = {
  baseline_config: base.policy, mutated_config: mut.policy,
  baseline: b, mutated: m,
  conclusions: {
    maxRulesPerDocument_effective: m.max_rules_per_doc <= 10 && b.max_rules_per_doc > 10,
    scenarioDefaultStatus_effective: m.scenario_status.includes('EXECUTABLE'),
    requireEvidenceForExplicitRules_effective: 'see validation diff',
  },
};
fs.writeFileSync(path.join(__dirname, 'c5_policy_probe.json'), JSON.stringify(out, null, 2), 'utf8');
console.log('BASELINE', JSON.stringify({ rules: b.rules_total, max_per_doc: b.max_rules_per_doc, status: b.scenario_status, validation: b.validation }));
console.log('MUTATED', JSON.stringify({ rules: m.rules_total, max_per_doc: m.max_rules_per_doc, status: m.scenario_status, validation: m.validation }));
console.log('CONCLUSIONS', JSON.stringify(out.conclusions));
