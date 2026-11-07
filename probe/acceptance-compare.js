// Compare regenerated outputs against the pre-run snapshot.
// Produces a compact summary + timestamp-normalized content comparison.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SNAP = path.join(ROOT, 'artifacts', 'acceptance', '_snapshots');
const BEFORE = path.join(SNAP, 'before');
const diffFile = path.join(SNAP, 'diff-after-prd.json');

function norm(s) {
  return s
    .replace(/生成时间：[^\r\n]*/g, '生成时间：<TS>')
    .replace(/扫描时间：[^\r\n]*/g, '扫描时间：<TS>')
    .replace(/"generated_at": "[^"]*"/g, '"generated_at": "<TS>"')
    .replace(/"scanned_at": "[^"]*"/g, '"scanned_at": "<TS>"')
    .replace(/"updated_at": "[^"]*"/g, '"updated_at": "<TS>"')
    .replace(/"extracted_at": "[^"]*"/g, '"extracted_at": "<TS>"')
    .replace(/"modified_at": "[^"]*"/g, '"modified_at": "<TS>"')
    .replace(/"created_at": "[^"]*"/g, '"created_at": "<TS>"');
}
function h(s) { return crypto.createHash('sha256').update(s).digest('hex').slice(0, 12); }

if (fs.existsSync(diffFile)) {
  const d = JSON.parse(fs.readFileSync(diffFile, 'utf8'));
  const byDir = {};
  for (const c of d.changed) {
    const dir = c.rel.split('/').slice(0, 2).join('/');
    byDir[dir] = (byDir[dir] || 0) + 1;
  }
  console.log('=== RAW BYTE/SHA DIFF SUMMARY ===');
  console.log(`unchanged=${d.unchanged} changed=${d.changed.length} added=${d.added.length} missing=${d.missing.length}`);
  for (const [k, v] of Object.entries(byDir)) console.log(`  ${k}: ${v} changed`);
  console.log(`  reports changed: ${d.changed.filter((c) => c.rel.startsWith('reports/')).map((c) => c.rel).join(', ')}`);
  const sizeChanged = d.changed.filter((c) => c.before.size !== c.after.size);
  console.log(`  files whose byte SIZE changed: ${sizeChanged.length}`);
  for (const c of sizeChanged) console.log(`    ${c.rel} ${c.before.size} -> ${c.after.size}`);
}

console.log('\n=== TIMESTAMP-NORMALIZED CONTENT COMPARISON (reports) ===');
const reportDir = path.join(ROOT, 'reports');
const snapReportDir = path.join(BEFORE, 'reports');
let identical = 0, different = 0;
for (const f of fs.readdirSync(reportDir).sort()) {
  const a = norm(fs.readFileSync(path.join(snapReportDir, f), 'utf8'));
  const b = norm(fs.readFileSync(path.join(reportDir, f), 'utf8'));
  const same = h(a) === h(b);
  if (same) identical += 1; else different += 1;
  console.log(`  ${f.padEnd(36)} ${same ? 'IDENTICAL' : 'DIFFERENT'}  snap=${h(a)} regen=${h(b)}`);
}
console.log(`  => reports identical=${identical} different=${different}`);

console.log('\n=== TIMESTAMP-NORMALIZED CONTENT COMPARISON (knowledge json) ===');
const kDir = path.join(ROOT, 'artifacts/knowledge');
const snapKDir = path.join(BEFORE, 'artifacts/knowledge');
let kId = 0, kDiff = 0;
for (const f of fs.readdirSync(kDir).sort()) {
  const a = norm(fs.readFileSync(path.join(snapKDir, f), 'utf8'));
  const b = norm(fs.readFileSync(path.join(kDir, f), 'utf8'));
  const same = h(a) === h(b);
  if (same) kId += 1; else kDiff += 1;
  console.log(`  ${f.padEnd(30)} ${same ? 'IDENTICAL' : 'DIFFERENT'}  snap=${h(a)} regen=${h(b)}`);
}
console.log(`  => knowledge identical=${kId} different=${kDiff}`);
