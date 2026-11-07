// Acceptance-side minimal JSON Schema (draft-2020-12 subset) validator.
// NO new npm dependencies. Supports: required / type / const / enum / minLength / items / properties.
// Runs full-scan over rules.json (30641) and scenarios.json (4067) against the
// two dev-kit schemas. This is an INDEPENDENT acceptance check; the project itself
// has no JSON Schema validator (see 08 report G-S2).
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const SCHEMA_DIR = path.join(ROOT, 'docs/plan/Athena-ERP-Test-Development-Kit/schemas');
const K = path.join(ROOT, 'artifacts/knowledge');
const OUT = path.join(ROOT, 'artifacts/acceptance/_snapshots/08-schema-validate.json');

function typeOk(v, t) {
  switch (t) {
    case 'null': return v === null;
    case 'object': return typeof v === 'object' && v !== null && !Array.isArray(v);
    case 'array': return Array.isArray(v);
    case 'integer': return typeof v === 'number' && Number.isInteger(v);
    default: return typeof v === t;
  }
}
function validate(instance, schema, p, errs) {
  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeOk(instance, t))) {
      errs.push({ path: p, code: 'TYPE', expected: schema.type, actual: Array.isArray(instance) ? 'array' : instance === null ? 'null' : typeof instance });
      return;
    }
  }
  if (schema.const !== undefined && instance !== schema.const) errs.push({ path: p, code: 'CONST', expected: schema.const, actual: instance });
  if (Array.isArray(schema.enum) && !schema.enum.includes(instance)) errs.push({ path: p, code: 'ENUM', expected: schema.enum, actual: instance });
  if (typeof instance === 'string' && schema.minLength !== undefined && instance.length < schema.minLength) {
    errs.push({ path: p, code: 'MIN_LENGTH', expected: schema.minLength, actual: instance.length });
  }
  if (typeOk(instance, 'object') && (schema.required || schema.properties)) {
    for (const k of schema.required || []) if (!Object.prototype.hasOwnProperty.call(instance, k)) errs.push({ path: p, code: 'REQUIRED', field: k });
    for (const [k, sub] of Object.entries(schema.properties || {})) {
      if (Object.prototype.hasOwnProperty.call(instance, k)) validate(instance[k], sub, `${p}.${k}`, errs);
    }
  }
  if (Array.isArray(instance) && schema.items) {
    for (let i = 0; i < instance.length; i += 1) validate(instance[i], schema.items, `${p}[${i}]`, errs);
  }
}

function run(schemaFile, dataFile) {
  const schema = JSON.parse(fs.readFileSync(path.join(SCHEMA_DIR, schemaFile), 'utf8'));
  const data = JSON.parse(fs.readFileSync(path.join(K, dataFile), 'utf8'));
  const perObjectErrors = new Map(); // index -> errors
  const byCode = {}, byField = {};
  let totalErrors = 0, badObjects = 0;
  const samples = [];
  for (let i = 0; i < data.length; i += 1) {
    const errs = [];
    validate(data[i], schema, `$[${i}]`, errs);
    if (errs.length) {
      badObjects += 1;
      totalErrors += errs.length;
      for (const e of errs) {
        byCode[e.code] = (byCode[e.code] || 0) + 1;
        const f = e.field || e.path.replace(/^\$\[\d+\]\.?/, '').replace(/\[\d+\]/g, '[]');
        byField[f] = (byField[f] || 0) + 1;
      }
      if (samples.length < 5) samples.push({ id: data[i].id, errors: errs.slice(0, 4) });
    }
  }
  return {
    schema_file: schemaFile,
    schema_draft: schema.$schema,
    additionalProperties: schema.additionalProperties,
    required_fields: schema.required,
    data_file: dataFile,
    objects_checked: data.length,
    objects_with_violations: badObjects,
    total_violations: totalErrors,
    violations_by_code: byCode,
    violations_by_field: byField,
    samples,
  };
}

const results = [run('rule.schema.json', 'rules.json'), run('scenario.schema.json', 'scenarios.json')];

// explicit check: any non-DRAFT / EXECUTABLE / APPROVED status?
const scenarios = JSON.parse(fs.readFileSync(path.join(K, 'scenarios.json'), 'utf8'));
const statusDist = {};
for (const s of scenarios) statusDist[s.status] = (statusDist[s.status] || 0) + 1;
const feasDist = {};
for (const s of scenarios) feasDist[s.automation_feasibility] = (feasDist[s.automation_feasibility] || 0) + 1;
const forbidden = scenarios.filter((s) => s.status === 'EXECUTABLE' || s.status === 'APPROVED' || s.status === 'REJECTED' || s.status === 'REVIEW_REQUIRED');

const report = { checked_at: new Date().toISOString(), results, status_dist: statusDist, feasibility_dist: feasDist, non_draft_or_executable_count: forbidden.length, non_draft_samples: forbidden.slice(0, 5).map((s) => s.id) };
fs.writeFileSync(OUT, JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify(report, null, 2));
console.log(`\nfull result -> ${OUT}`);
