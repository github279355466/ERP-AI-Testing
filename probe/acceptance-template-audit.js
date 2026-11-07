// Quantify how much of scenario bodies come from fixed templates.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const S = JSON.parse(fs.readFileSync(path.join(ROOT, 'artifacts/knowledge/scenarios.json'), 'utf8'));

function distinct(values) {
  const m = new Map();
  for (const v of values) m.set(v, (m.get(v) || 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}
const pre = distinct(S.map((s) => (s.preconditions || []).join(' | ')));
const steps = distinct(S.map((s) => (s.steps || []).join(' | ')));
const assType = distinct(S.map((s) => (s.assertions || []).map((a) => a.type).join(',')));
const assExpected = distinct(S.map((s) => (s.assertions || []).map((a) => a.expected).join(' | ')));
const dataReq = distinct(S.map((s) => (s.data_requirements || []).join(' | ')));
const summary = {
  total: S.length,
  distinct_preconditions: pre.length,
  distinct_step_sequences: steps.length,
  distinct_assertion_types: assType.length,
  distinct_expected_strings: assExpected.length,
  distinct_data_requirements: dataReq.length,
  top_preconditions: pre.slice(0, 5),
  top_steps: steps.slice(0, 5),
  top_expected: assExpected.slice(0, 8),
  top_data_requirements: dataReq.slice(0, 5),
};
console.log(JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(ROOT, 'artifacts/acceptance/_snapshots/06-template-audit.json'), JSON.stringify(summary, null, 2), 'utf8');
