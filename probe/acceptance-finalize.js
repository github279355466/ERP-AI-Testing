// Phase 1 验收交付物：统一 CRLF 行尾（UTF-8 无 BOM）+ 完整性校验，只读校验除外不改动其他文件
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = 'D:/AIProject/ERP-AI-Testing';
const EXPECTED = [
  '01-document-scan-report.md',
  '02-parsing-quality-report.md',
  '03-knowledge-model-validation.md',
  '04-rule-traceability-report.md',
  '05-business-relationship-report.md',
  '06-scenario-quality-report.md',
  '07-open-questions.md',
  '08-automated-test-report.md',
  'PHASE1-ACCEPTANCE-REPORT.md'
];

function normalize(file) {
  const raw = fs.readFileSync(file);
  const hasBom = raw.length >= 3 && raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf;
  let text = raw.toString('utf8');
  if (hasBom) text = text.slice(1);
  const crlfCount = (text.match(/\r\n/g) || []).length;
  const lfOnly = (text.match(/(?<!\r)\n/g) || []).length;
  text = text.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(file, Buffer.from(text, 'utf8'), { flag: 'w' });
  const after = fs.readFileSync(file);
  const afterText = after.toString('utf8');
  const afterBom = after.length >= 3 && after[0] === 0xef && after[1] === 0xbb && after[2] === 0xbf;
  const afterLfOnly = (afterText.match(/(?<!\r)\n/g) || []).length;
  return {
    file: path.relative(ROOT, file).replace(/\\/g, '/'),
    bytes: after.length,
    lines: afterText.split('\r\n').length - 1,
    hadBom: hasBom, hasBom: afterBom,
    crlfBefore: crlfCount, lfOnlyBefore: lfOnly, lfOnlyAfter: afterLfOnly,
    sha256: crypto.createHash('sha256').update(after).digest('hex').slice(0, 16)
  };
}

const results = [];
for (const name of EXPECTED) {
  const f = path.join(ROOT, 'artifacts/acceptance', name);
  if (!fs.existsSync(f)) { console.log('MISSING: ' + name); continue; }
  results.push(normalize(f));
}
const gstack = path.join(ROOT, 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md');
if (fs.existsSync(gstack)) results.push(normalize(gstack));

console.log('=== 交付物规范化结果 ===');
for (const r of results) {
  console.log(`${r.file} | ${r.bytes}B | ${r.lines} lines | BOM=${r.hasBom} | LF-only after=${r.lfOnlyAfter} | sha=${r.sha256}`);
}
console.log('\nfiles:', results.length, '(expect 10)');
console.log('all CRLF & no BOM:', results.every(r => !r.hasBom && r.lfOnlyAfter === 0));

// 占位符检查
console.log('\n=== 占位符检查 ===');
let placeholderHits = 0;
for (const r of results) {
  const text = fs.readFileSync(path.join(ROOT, r.file), 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((l, i) => {
    if (/待补|待填写|TODO_PLACEHOLDER|XXX_PLACEHOLDER|\[TBD\]/i.test(l)) {
      console.log(`  ${r.file}:${i + 1}: ${l.trim().slice(0, 120)}`);
      placeholderHits++;
    }
  });
}
console.log('placeholder hits:', placeholderHits);
