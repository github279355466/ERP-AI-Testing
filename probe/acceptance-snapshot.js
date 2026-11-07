// Phase 1 acceptance: snapshot / diff / restore / verify helper
// Protects reports/, artifacts/knowledge/, artifacts/source-index/ while
// running prd:validate / prd:report (which are FULL rebuilds, not read-only).
// Usage: node probe/acceptance-snapshot.js before|diff|restore|verify
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.resolve(__dirname, '..');
const SNAP = path.join(ROOT, 'artifacts', 'acceptance', '_snapshots');
const BEFORE = path.join(SNAP, 'before');
const MANIFEST = path.join(SNAP, 'manifest-before.json');

// Every directory buildKnowledge() can write into (see src/prd/pipeline.ts).
const TARGETS = ['reports', 'artifacts/knowledge', 'artifacts/source-index'];

function sha256(file) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(file));
  return h.digest('hex');
}

function walk(dir, base, out) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, ent.name);
    const rel = base ? `${base}/${ent.name}` : ent.name;
    if (ent.isDirectory()) walk(full, rel, out);
    else if (ent.isFile()) out.push({ abs: full, rel });
  }
}

function current() {
  const files = [];
  for (const t of TARGETS) walk(path.join(ROOT, t), t, files);
  files.sort((a, b) => a.rel.localeCompare(b.rel));
  return files.map((f) => ({ rel: f.rel, size: fs.statSync(f.abs).size, sha256: sha256(f.abs), abs: f.abs }));
}

function cmdBefore() {
  fs.mkdirSync(BEFORE, { recursive: true });
  const list = current();
  for (const f of list) {
    const dest = path.join(BEFORE, f.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(f.abs, dest);
  }
  const manifest = {
    captured_at: new Date().toISOString(),
    targets: TARGETS,
    file_count: list.length,
    total_bytes: list.reduce((s, f) => s + f.size, 0),
    files: list.map(({ rel, size, sha256: sha }) => ({ rel, size, sha256: sha })),
  };
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2), 'utf8');
  process.stdout.write(`[before] captured ${list.length} files, ${manifest.total_bytes} bytes -> ${BEFORE}\n`);
  for (const t of TARGETS) {
    const sub = list.filter((f) => f.rel.startsWith(t + '/'));
    process.stdout.write(`  ${t}: ${sub.length} files, ${sub.reduce((s, f) => s + f.size, 0)} bytes\n`);
  }
}

function cmdDiff() {
  if (!fs.existsSync(MANIFEST)) throw new Error('missing manifest, run before first');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const before = new Map(manifest.files.map((f) => [f.rel, f]));
  const now = current();
  const nowMap = new Map(now.map((f) => [f.rel, f]));
  const changed = [], added = [], missing = [], same = [];
  for (const f of now) {
    const b = before.get(f.rel);
    if (!b) { added.push(f); continue; }
    if (b.sha256 !== f.sha256 || b.size !== f.size) changed.push({ rel: f.rel, before: b, after: { size: f.size, sha256: f.sha256 } });
    else same.push(f.rel);
  }
  for (const [rel, b] of before) if (!nowMap.has(rel)) missing.push({ rel, before: b });
  const report = { diff_at: new Date().toISOString(), unchanged: same.length, changed, added, missing };
  fs.writeFileSync(path.join(SNAP, 'diff-after-prd.json'), JSON.stringify(report, null, 2), 'utf8');
  process.stdout.write(`[diff] unchanged=${same.length} changed=${changed.length} added=${added.length} missing=${missing.length}\n`);
  for (const c of changed) process.stdout.write(`  CHANGED ${c.rel}  ${c.before.size}->${c.after.size} B  ${c.before.sha256.slice(0, 12)} -> ${c.after.sha256.slice(0, 12)}\n`);
  for (const a of added) process.stdout.write(`  ADDED   ${a.rel} (${a.size} B)\n`);
  for (const m of missing) process.stdout.write(`  MISSING ${m.rel}\n`);
}

function cmdRestore() {
  if (!fs.existsSync(MANIFEST)) throw new Error('missing manifest');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  // 1. restore every snapshot file byte-for-byte
  for (const f of manifest.files) {
    const src = path.join(BEFORE, f.rel);
    const dest = path.join(ROOT, f.rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  // 2. delete any file created after the snapshot inside target dirs
  const allowed = new Set(manifest.files.map((f) => f.rel));
  const now = current();
  let removed = 0;
  for (const f of now) {
    if (!allowed.has(f.rel)) { fs.unlinkSync(f.abs); removed += 1; }
  }
  process.stdout.write(`[restore] restored ${manifest.files.length} files, removed ${removed} extraneous files\n`);
}

function cmdVerify() {
  if (!fs.existsSync(MANIFEST)) throw new Error('missing manifest');
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  const now = new Map(current().map((f) => [f.rel, f]));
  let bad = 0;
  for (const f of manifest.files) {
    const n = now.get(f.rel);
    if (!n || n.sha256 !== f.sha256 || n.size !== f.size) { process.stdout.write(`  MISMATCH ${f.rel}\n`); bad += 1; }
  }
  for (const [rel] of now) if (!manifest.files.some((f) => f.rel === rel)) { process.stdout.write(`  EXTRA ${rel}\n`); bad += 1; }
  process.stdout.write(`[verify] ${bad === 0 ? 'OK - all files byte-identical to snapshot' : `FAILED - ${bad} discrepancies`}\n`);
  process.exitCode = bad === 0 ? 0 : 1;
}

const cmd = process.argv[2];
const map = { before: cmdBefore, diff: cmdDiff, restore: cmdRestore, verify: cmdVerify };
if (!map[cmd]) { process.stderr.write('usage: node probe/acceptance-snapshot.js before|diff|restore|verify\n'); process.exitCode = 1; }
else map[cmd]();
