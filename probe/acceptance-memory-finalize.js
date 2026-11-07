// 规范化项目 memory 三份文件为 UTF-8 无 BOM + CRLF
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing/.workbuddy/memory';
for (const name of ['2026-11-07.md', 'MEMORY.md', 'map-navigation-phase1-acceptance.md']) {
  const f = path.join(ROOT, name);
  let t = fs.readFileSync(f, 'utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  t = t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(f, Buffer.from(t, 'utf8'));
  const after = fs.readFileSync(f).toString('utf8');
  const lfOnly = (after.match(/(?<!\r)\n/g) || []).length;
  console.log(`${name}: ${Buffer.byteLength(after)}B, LF-only=${lfOnly}`);
}
