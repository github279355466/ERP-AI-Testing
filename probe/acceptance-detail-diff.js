// Detailed field-level diff for the files that differ after timestamp normalization.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const BEFORE = path.join(ROOT, 'artifacts/acceptance/_snapshots/before');

function load(rel) { return JSON.parse(fs.readFileSync(path.join(BEFORE, rel), 'utf8')); }
function loadNow(rel) { return JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8')); }

// --- summary.json ---
console.log('=== summary.json ===');
const s0 = load('artifacts/knowledge/summary.json');
const s1 = loadNow('artifacts/knowledge/summary.json');
for (const k of new Set([...Object.keys(s0), ...Object.keys(s1)])) {
  const a = JSON.stringify(s0[k]), b = JSON.stringify(s1[k]);
  if (a !== b) console.log(`  ${k}: BEFORE=${a}  AFTER=${b}`);
}

// --- documents.json ---
console.log('\n=== documents.json ===');
const d0 = load('artifacts/knowledge/documents.json');
const d1 = loadNow('artifacts/knowledge/documents.json');
console.log(`  array length: before=${d0.length} after=${d1.length}`);
const keys = new Set();
for (const d of [...d0, ...d1]) for (const k of Object.keys(d)) keys.add(k);
const counts = {};
const samples = {};
for (const k of keys) {
  let n = 0;
  const m0 = new Map(d0.map((d) => [d.id, d]));
  const m1 = new Map(d1.map((d) => [d.id, d]));
  for (const [id, a] of m0) {
    const b = m1.get(id);
    const av = JSON.stringify(a[k]), bv = b ? JSON.stringify(b[k]) : '<MISSING DOC>';
    if (av !== bv) { n += 1; if (!samples[k]) samples[k] = { id, before: av, after: bv }; }
  }
  if (n) counts[k] = n;
}
console.log('  fields differing (count of documents):', JSON.stringify(counts, null, 2));
for (const [k, v] of Object.entries(samples)) console.log(`  sample ${k}: id=${v.id} before=${String(v.before).slice(0, 160)} after=${String(v.after).slice(0, 160)}`);
const ids0 = new Set(d0.map((d) => d.id)), ids1 = new Set(d1.map((d) => d.id));
console.log(`  ids only in before: ${[...ids0].filter((i) => !ids1.has(i)).length}, only in after: ${[...ids1].filter((i) => !ids0.has(i)).length}`);

// --- which reports does renderAllReports produce? ---
console.log('\n=== reports.ts renderAllReports output keys ===');
const reportsSrc = fs.readFileSync(path.join(ROOT, 'src/prd/reports.ts'), 'utf8');
const idx = reportsSrc.indexOf('export function renderAllReports');
console.log(reportsSrc.slice(idx, idx + 1400));
