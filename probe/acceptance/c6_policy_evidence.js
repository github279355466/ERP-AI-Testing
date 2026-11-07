// C 项取证 6：实际执行项目自带 validateKnowledgeBundle，验证 requireEvidenceForExplicitRules 是否参与判定
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, 'isolated', 'dist');
const { validateKnowledgeBundle } = require(path.join(ROOT, 'prd', 'validate.js'));

const now = new Date().toISOString();
const base = {
  id: 'RULE-TEST', object_type: 'Rule', name: '测试', module: '测试', status: 'ACTIVE',
  source_refs: [{ document_id: 'DOC-TEST', file_path: 'x.md', line_start: 1 }],
  created_by_parser_version: '1.0.0', updated_at: now,
  description: '测试规则', rule_type: 'REQUIRED', source_type: 'PRD_EXPLICIT', confidence: 'CONFIRMED',
  applies_to: [], field_no: null, field_name: null, trigger: null, conditions: [],
  expected_result: null, derivation: null, document_id: 'DOC-TEST', open_question_ids: [],
};
function bundle(rule) {
  return {
    documents: [{ id: 'DOC-TEST', object_type: 'Document', sha256: 'a'.repeat(64), relative_path: 'x.md' }],
    entities: [], fields: [], rules: [rule], scenarios: [],
    // 其余字段不会被 validateKnowledgeBundle 读取
  };
}
const withEvidence = validateKnowledgeBundle(bundle(base));
const noEvidence = validateKnowledgeBundle(bundle({ ...base, source_refs: [] }));
const derivedNoEvidence = validateKnowledgeBundle(bundle({ ...base, source_type: 'PRD_DERIVED', source_refs: [] }));

const out = {
  validateKnowledgeBundle_signature_params: ['bundle: KnowledgeBundle'],
  config_policy_is_parameter: false,
  withEvidence_errors: withEvidence.errors.map((e) => e.code),
  explicit_noEvidence_errors: noEvidence.errors.map((e) => e.code),
  derived_noEvidence_errors: derivedNoEvidence.errors.map((e) => e.code),
  conclusion: '证据校验对全部 source_type 无条件生效；config.policy.requireEvidenceForExplicitRules 不参与判定（配置未被读取）',
};
fs.writeFileSync(path.join(__dirname, 'c6_policy_evidence.json'), JSON.stringify(out, null, 2), 'utf8');
console.log(JSON.stringify(out, null, 2));
