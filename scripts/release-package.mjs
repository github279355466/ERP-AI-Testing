import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const version = process.argv[2];
if (!version) {
  console.error('用法: node scripts/release-package.mjs <version>');
  process.exit(1);
}

const root = process.cwd();
const releaseDir = path.join(root, 'releases', version);
const stage = path.join(releaseDir, 'package');
fs.rmSync(stage, { recursive: true, force: true });
fs.mkdirSync(stage, { recursive: true });

const include = [
  'dist',
  'config',
  'platform/contracts',
  'business-modules',
  'integration-tests',
  'runtime',
  'docs/architecture',
  'docs/contracts',
  'docs/runbooks',
  'docs/acceptance',
  'scripts/run-system-smoke.mjs',
  'package.json',
  'package-lock.json',
  'README.md',
  'AGENTS.md',
  '.env.example',
];

function copyEntry(relative) {
  const source = path.join(root, relative);
  if (!fs.existsSync(source)) return;
  const target = path.join(stage, relative);
  fs.cpSync(source, target, {
    recursive: true,
    filter: (src) => {
      const normalized = src.replace(/\\/g, '/');
      if (normalized.includes('/node_modules/')) return false;
      if (normalized.endsWith('.log')) return false;
      if (normalized.includes('/artifacts/')) return false;
      if (normalized.includes('/knowledge/')) return false;
      if (normalized.includes('/runs/')) return false;
      return true;
    },
  });
}

for (const entry of include) copyEntry(entry);

function sha256(file) {
  return createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const pkg = readJson(path.join(root, 'package.json'));
const lock = readJson(path.join(root, 'package-lock.json'));
const gitCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const gitBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();

const schemaDir = path.join(stage, 'platform/contracts/schemas');
const contracts = fs.readdirSync(schemaDir).filter((file) => file.endsWith('.schema.json')).sort().map((file) => {
  const data = readJson(path.join(schemaDir, file));
  return { file, id: data.$id ?? 'UNKNOWN', title: data.title ?? 'UNKNOWN', sha256: sha256(path.join(schemaDir, file)) };
});

const modules = fs.readdirSync(path.join(stage, 'business-modules'), { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
  .map((entry) => {
    const manifestPath = path.join(stage, 'business-modules', entry.name, 'module.yaml');
    const text = fs.existsSync(manifestPath) ? fs.readFileSync(manifestPath, 'utf8') : '';
    const versionMatch = /version:\s*([0-9.]+)/.exec(text);
    const statusMatch = /status:\s*(\w+)/.exec(text);
    const count = (dir) => (fs.existsSync(path.join(stage, 'business-modules', entry.name, dir)) ? fs.readdirSync(path.join(stage, 'business-modules', entry.name, dir)).filter((file) => /\.ya?ml$/i.test(file)).length : 0);
    return {
      module_id: entry.name,
      version: versionMatch?.[1] ?? 'UNKNOWN',
      status: statusMatch?.[1] ?? 'UNKNOWN',
      page_mappings: count('page-mappings'),
      testcases: count('testcases'),
      field_rules: count('field-rules'),
      data_recipes: count('data-recipes'),
    };
  });

const playwright = pkg.devDependencies?.['@playwright/test'] ?? lock.packages?.['node_modules/@playwright/test']?.version ?? 'UNKNOWN';
const manifest = {
  release_version: version,
  package_version: pkg.version,
  platform_api_version: '1.0.0',
  contract_schema_version: '1.0',
  git: { commit: gitCommit, branch: gitBranch },
  runtime: { node: process.version, npm: execFileSync('npm', ['--version'], { cwd: root, encoding: 'utf8', shell: true }).trim(), playwright, os: process.platform },
  generated_at: new Date().toISOString(),
};

fs.writeFileSync(path.join(releaseDir, 'VERSION-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(releaseDir, 'CONTRACT-MANIFEST.json'), `${JSON.stringify(contracts, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(releaseDir, 'MODULE-MANIFEST.json'), `${JSON.stringify(modules, null, 2)}\n`, 'utf8');
fs.writeFileSync(path.join(stage, 'VERSION-MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

const archive = path.join(releaseDir, `athena-platform-${version}.tgz`);
fs.rmSync(archive, { force: true });
execFileSync('tar', ['-czf', archive, '-C', stage, '.'], { cwd: root });
const digest = sha256(archive);
fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), `${digest}  ${path.basename(archive)}\n`, 'utf8');

const activePath = path.join(root, 'releases', 'ACTIVE.json');
fs.mkdirSync(path.dirname(activePath), { recursive: true });
fs.writeFileSync(activePath, `${JSON.stringify({ version, archive: path.relative(root, archive), sha256: digest, activated_at: new Date().toISOString() }, null, 2)}\n`, 'utf8');

console.log(JSON.stringify({ version, archive, sha256: digest, stage, modules, contracts: contracts.length }, null, 2));
