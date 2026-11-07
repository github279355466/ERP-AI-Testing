import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = process.cwd();

function deliveryFiles() {
  const files = [];
  const pushDir = (dir, filter) => {
    for (const entry of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
      if (!entry.isFile() || !filter(entry.name)) continue;
      files.push(path.join(dir, entry.name));
    }
  };
  pushDir('artifacts/knowledge', (name) => name.endsWith('.json'));
  pushDir('artifacts/source-index', (name) => name.endsWith('.json'));
  pushDir('reports', (name) => name.endsWith('.md'));
  return files.sort();
}

function snapshot() {
  const map = new Map();
  for (const file of deliveryFiles()) {
    const hash = crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex');
    map.set(file, hash);
  }
  return map;
}

function diff(before, after) {
  const changed = [];
  const added = [];
  const removed = [];
  for (const [file, hash] of after) {
    if (!before.has(file)) added.push(file);
    else if (before.get(file) !== hash) changed.push(file);
  }
  for (const file of before.keys()) if (!after.has(file)) removed.push(file);
  return { changed, added, removed };
}

const before = snapshot();
const commands = [];
for (const script of ['prd:validate', 'prd:report']) {
  execFileSync('npm', ['run', script], { cwd: ROOT, stdio: 'pipe', shell: true });
  commands.push(script);
}
const after = snapshot();
const result = diff(before, after);
const report = {
  generated_at: new Date().toISOString(),
  commands,
  files_checked: before.size,
  changed: result.changed,
  added: result.added,
  removed: result.removed,
  readonly: result.changed.length === 0 && result.added.length === 0 && result.removed.length === 0,
};
fs.writeFileSync(
  path.join(ROOT, 'probe', 'phase1-readonly-check.out.json'),
  JSON.stringify(report, null, 2),
  'utf8'
);
console.log(JSON.stringify(report, null, 2));
