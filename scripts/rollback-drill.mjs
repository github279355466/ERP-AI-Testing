import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const releaseVersion = '1.0.0';
const previousVersion = '1.0.0-rc1';

function deployDir(version) {
  const base = path.join(root, 'releases', version);
  const candidates = fs.readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('deploy-drill'))
    .map((entry) => path.join(base, entry.name));
  const usable = candidates.find((dir) => fs.existsSync(path.join(dir, 'dist/cli/platform-health.js')));
  if (!usable) throw new Error(`未找到 ${version} 的部署演练目录`);
  return usable;
}

function activate(version, archive) {
  const file = path.join(root, 'releases', 'ACTIVE.json');
  fs.writeFileSync(file, `${JSON.stringify({ version, archive, activated_at: new Date().toISOString(), drill: true }, null, 2)}\n`, 'utf8');
}

function runIn(dir, script, args = []) {
  const result = spawnSync(process.execPath, [script, ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ALLOW_ERP_UI_TEST: 'true', GIT_COMMIT: 'rollback-drill' },
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  let json = null;
  try {
    json = JSON.parse(output.slice(output.indexOf('{')));
  } catch {
    json = null;
  }
  return { status: result.status, json, tail: output.split('\n').filter(Boolean).slice(-6) };
}

const steps = [];
for (const version of [previousVersion, releaseVersion]) {
  const dir = deployDir(version);
  activate(version, `releases/${version}/athena-platform-${version}.tgz`);
  const health = runIn(dir, 'dist/cli/platform-health.js');
  const contract = runIn(dir, 'dist/cli/platform.js', ['validate']);
  steps.push({
    version,
    deploy_dir: path.relative(root, dir),
    activated: true,
    health: { status: health.status, success: health.json?.success, checks: health.json?.checks },
    contract: { status: contract.status, success: contract.json?.success, passed: contract.json?.summary?.passed, total: contract.json?.summary?.total },
  });
}

activate(releaseVersion, `releases/${releaseVersion}/athena-platform-${releaseVersion}.tgz`);
const output = { generated_at: new Date().toISOString(), release_version: releaseVersion, previous_version: previousVersion, steps, final_active: releaseVersion };
const reportDir = path.join(root, 'reports', 'release');
fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(path.join(reportDir, 'rollback-drill.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
