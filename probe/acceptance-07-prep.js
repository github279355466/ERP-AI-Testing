// Phase 1 独立验收：为 07-open-questions.md 准备数据基础（只读统计，不写任何产出）
const fs = require('fs');
const path = require('path');

const ROOT = 'D:/AIProject/ERP-AI-Testing';
const oqPath = path.join(ROOT, 'artifacts/knowledge/open-questions.json');
const mdPath = path.join(ROOT, 'reports/OPEN_QUESTIONS.md');

const raw = JSON.parse(fs.readFileSync(oqPath, 'utf8'));
const items = Array.isArray(raw) ? raw : (raw.items || raw.questions || raw.open_questions || []);
console.log('=== open-questions.json ===');
console.log('top-level type:', Array.isArray(raw) ? 'array' : typeof raw);
if (!Array.isArray(raw)) console.log('top-level keys:', Object.keys(raw).join(', '));
console.log('item count:', items.length);
if (items.length) {
  console.log('sample keys:', Object.keys(items[0]).join(', '));
  console.log('sample item:', JSON.stringify(items[0], null, 2).slice(0, 1200));
}

function tally(key) {
  const m = {};
  for (const it of items) {
    const v = it[key] === undefined || it[key] === null ? '<MISSING>' : String(it[key]);
    m[v] = (m[v] || 0) + 1;
  }
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}
for (const k of ['type', 'category', 'severity', 'status', 'module', 'question_type', 'object_type']) {
  const t = tally(k);
  if (t.length > 1 || (t.length === 1 && t[0][0] !== '<MISSING>')) {
    console.log(`\n-- ${k} --`);
    for (const [v, n] of t.slice(0, 25)) console.log(`  ${v}: ${n}`);
    if (t.length > 25) console.log(`  ... ${t.length - 25} more`);
  }
}

// 02 规范第 12 节要求：问题 / 涉及文档 / 冲突证据 / 影响 / 建议确认对象 / 状态
console.log('\n=== 字段完整性（按 02 规范第 12 节）===');
const allKeys = new Set();
items.forEach(it => Object.keys(it).forEach(k => allKeys.add(k)));
console.log('all keys across items:', [...allKeys].sort().join(', '));
for (const k of ['id', 'question', 'description', 'document_ids', 'documents', 'source_refs',
                 'evidence', 'impact', 'suggested_owner', 'confirm_owner', 'status', 'severity']) {
  let present = 0, nonEmpty = 0;
  for (const it of items) {
    if (Object.prototype.hasOwnProperty.call(it, k)) {
      present++;
      const v = it[k];
      if (Array.isArray(v) ? v.length > 0 : (v !== '' && v !== null && v !== undefined)) nonEmpty++;
    }
  }
  console.log(`  ${k}: present=${present}/${items.length}, nonEmpty=${nonEmpty}`);
}

console.log('\n=== reports/OPEN_QUESTIONS.md ===');
const md = fs.readFileSync(mdPath, 'utf8');
const lines = md.split(/\r?\n/);
console.log('lines:', lines.length, 'bytes:', Buffer.byteLength(md));
console.log('headings:');
lines.forEach((l, i) => { if (/^#{1,4}\s/.test(l)) console.log(`  L${i + 1}: ${l.trim()}`); });
const tableRows = lines.filter(l => /^\s*\|/.test(l) && !/^\s*\|[\s\-:|]+\|\s*$/.test(l));
console.log('table rows (incl header):', tableRows.length);
