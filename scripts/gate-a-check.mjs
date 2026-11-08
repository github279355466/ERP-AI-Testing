import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const outDir = path.join(root, 'reports', 'acceptance');
fs.mkdirSync(outDir, { recursive: true });

function run(command, args = [], timeout = 600000) {
  const started = Date.now();
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout, shell: process.platform === 'win32' });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`.trim().split('\n').filter(Boolean);
  return { command: [command, ...args].join(' '), status: result.status, duration_ms: Date.now() - started, tail: output.slice(-10) };
}

const git = {
  branch: execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  commit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  short: execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  status: execFileSync('git', ['status', '--porcelain=v1'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean),
  tags: execFileSync('git', ['tag', '--sort=-creatordate'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean).slice(0, 10),
};

const quality = [
  run('npm', ['run', 'typecheck']),
  run('npm', ['run', 'build']),
  run('npm', ['run', 'test:unit']),
  run('npm', ['run', 'test:contract']),
  run('npm', ['run', 'test:integration']),
  run('npm', ['run', 'test:platform']),
  run('npm', ['run', 'platform:validate']),
];

const secretPatterns = [
  /(?:password|passwd|pwd)\s*[:=]\s*['"][^'"]{6,}['"]/i,
  /(?:cookie|authorization)\s*[:=]\s*['"][^'"]{8,}['"]/i,
  /token\s*=\s*[A-Za-z0-9-]{16,}/i,
  /Bearer\s+[A-Za-z0-9._-]{20,}/,
];
const tracked = execFileSync('git', ['ls-files'], { cwd: root, encoding: 'utf8' }).split('\n').filter(Boolean);
const secretHits = [];
for (const file of tracked) {
  if (/\.(png|jpg|jpeg|gif|zip|tgz|woff2?|ico|pdf)$/i.test(file)) continue;
  let content = '';
  try {
    content = fs.readFileSync(path.join(root, file), 'utf8');
  } catch {
    continue;
  }
  content.split('\n').forEach((line, index) => {
    if (secretPatterns.some((pattern) => pattern.test(line))) {
      secretHits.push({ file, line: index + 1, excerpt: line.replace(/(['"])[^'"]{4,}\1/g, '$1<redacted>$1').slice(0, 160) });
    }
  });
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
  } catch {
    return null;
  }
}

const moduleSummary = readJson('artifacts/modules/purchase/knowledge/module-summary.json');
const compileSummary = readJson('artifacts/modules/purchase/compiled/compile-summary.json');
const dryRun = readJson('artifacts/modules/purchase/compiled/dry-run.json');

const runDirs = fs.existsSync(path.join(root, 'artifacts'))
  ? fs.readdirSync(path.join(root, 'artifacts'), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'modules' && entry.name !== 'session-outputs' && entry.name !== 'acceptance')
      .map((entry) => {
        const report = path.join(root, 'artifacts', entry.name, 'report.json');
        const manifest = path.join(root, 'artifacts', entry.name, 'run-manifest.json');
        if (!fs.existsSync(report)) return null;
        const data = readJson(path.relative(root, report));
        return {
          run_id: entry.name,
          outcome: data?.outcome,
          cases: data?.cases?.length,
          assertions: data?.cases?.reduce((sum, item) => sum + (item.assertions?.length ?? 0), 0),
          evidence: data?.evidence?.length,
          has_manifest: fs.existsSync(manifest),
        };
      })
      .filter(Boolean)
      .slice(-15)
  : [];

const pageMappingFiles = fs.existsSync(path.join(root, 'business-modules'))
  ? fs.readdirSync(path.join(root, 'business-modules'))
      .filter((name) => !name.startsWith('_'))
      .map((moduleId) => {
        const dir = path.join(root, 'business-modules', moduleId, 'page-mappings');
        if (!fs.existsSync(dir)) return { module_id: moduleId, pages: 0, fields: 0, verified: 0 };
        const files = fs.readdirSync(dir).filter((file) => /\.ya?ml$/i.test(file));
        let fields = 0;
        let verified = 0;
        for (const file of files) {
          const text = fs.readFileSync(path.join(dir, file), 'utf8');
          fields += (text.match(/^\s*-\s+name:/gm) || []).length;
          verified += (text.match(/verified:\s*true/g) || []).length;
        }
        return { module_id: moduleId, pages: files.length, fields, verified };
      })
  : [];

const result = {
  generated_at: new Date().toISOString(),
  git,
  runtime: {
    node: process.version,
    npm: (spawnSync('npm', ['--version'], { cwd: root, encoding: 'utf8', shell: true }).stdout || '').trim(),
    platform: process.platform,
  },
  quality,
  secret_scan: { hits: secretHits.length, files_scanned: tracked.length, hits_detail: secretHits.slice(0, 20) },
  knowledge: moduleSummary,
  compile: compileSummary ? { module: compileSummary.module_id, scenarios: compileSummary.scenarios, testcases: compileSummary.testcases, skipped: compileSummary.skipped?.length, dag: compileSummary.dag } : null,
  dry_run: dryRun ? { cases: dryRun.cases, actions: dryRun.actions, approval_gate: dryRun.approval_gate } : null,
  recent_runs: runDirs,
  page_mappings: pageMappingFiles,
};

const file = path.join(outDir, 'gate-a-evidence.json');
fs.writeFileSync(file, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ file, quality: quality.map((item) => ({ command: item.command, status: item.status })), secrets: secretHits.length, runs: runDirs.length }, null, 2));
