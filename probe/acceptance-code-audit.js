// Audit: explicit return types on exported functions in src/prd/*.ts,
// plus which src/prd modules are imported by tests/unit specs.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const PRD = path.join(ROOT, 'src/prd');
const UNIT = path.join(ROOT, 'tests/unit');

const modules = fs.readdirSync(PRD).filter((f) => f.endsWith('.ts')).sort();
console.log('=== src/prd modules (12 expected) ===');
console.log(modules.join(', '));

console.log('\n=== exported function signatures (explicit return type?) ===');
const re = /export\s+(?:async\s+)?function\s+([A-Za-z0-9_]+)\s*\(([^)]*)\)\s*(:[^{;]+)?\s*[{;]/g;
for (const m of modules) {
  const src = fs.readFileSync(path.join(PRD, m), 'utf8');
  let match, total = 0, typed = 0;
  const missing = [];
  while ((match = re.exec(src))) {
    total += 1;
    if (match[3] && match[3].trim()) typed += 1;
    else missing.push(match[1]);
  }
  // exported const arrow functions
  const arrow = /export\s+const\s+([A-Za-z0-9_]+)\s*=\s*\([^)]*\)\s*(:[^=]+)?=>/g;
  let am, arrows = 0, arrowsTyped = 0;
  while ((am = arrow.exec(src))) { arrows += 1; if (am[2] && am[2].trim()) arrowsTyped += 1; }
  console.log(`  ${m.padEnd(16)} exported-func=${total} typed=${typed} missing=[${missing.join(',')}] exported-arrow=${arrows} typed=${arrowsTyped}`);
}

console.log('\n=== per-module direct import by tests/unit specs ===');
const specFiles = fs.readdirSync(UNIT).filter((f) => f.endsWith('.spec.ts')).sort();
for (const m of modules) {
  const base = m.replace(/\.ts$/, '');
  const hits = [];
  for (const s of specFiles) {
    const src = fs.readFileSync(path.join(UNIT, s), 'utf8');
    if (new RegExp(`from\\s+['"][^'"]*\\/prd\\/${base}['"]`).test(src)) hits.push(s);
  }
  console.log(`  ${m.padEnd(16)} ${hits.length ? hits.join(', ') : '*** NO DIRECT UNIT TEST ***'}`);
}

console.log('\n=== e2e test does it assert report contents? ===');
const e2e = fs.readFileSync(path.join(UNIT, 'prd-modeling.spec.ts'), 'utf8');
const i = e2e.indexOf("test('端到端");
console.log(e2e.slice(i, i + 1500));
