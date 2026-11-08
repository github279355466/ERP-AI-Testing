import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from '../config/athena-config';
import { schemaDirectory, validateModulePack } from '../platform/contracts/validator';
import { PLATFORM_VERSION } from '../platform/plan/module-plan';

interface Check {
  name: string;
  ok: boolean;
  required: boolean;
  detail: string;
}

function readPackageVersion(root: string): string {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')) as { version?: string };
    return pkg.version ?? 'UNKNOWN';
  } catch {
    return 'UNKNOWN';
  }
}

async function cdpReachable(endpoint: string): Promise<{ ok: boolean; detail: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3_000);
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/json/version`, { signal: controller.signal });
    const data = (await response.json()) as { Browser?: string };
    return { ok: response.ok, detail: data.Browser ?? `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : String(error) };
  } finally {
    clearTimeout(timer);
  }
}

async function main(): Promise<number> {
  const root = process.cwd();
  const checks: Check[] = [];
  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({ name: 'runtime-node', ok: nodeMajor >= 22, required: true, detail: process.versions.node });

  const configPath = process.env.ATHENA_CONFIG ?? 'config/athena.config.json';
  let config;
  try {
    config = loadConfig(configPath);
    checks.push({ name: 'config', ok: true, required: true, detail: `${configPath} / ${config.environment.name}` });
  } catch (error) {
    checks.push({ name: 'config', ok: false, required: true, detail: error instanceof Error ? error.message : String(error) });
  }

  try {
    const directory = schemaDirectory(root);
    const schemas = fs.readdirSync(directory).filter((file) => file.endsWith('.schema.json'));
    checks.push({ name: 'schemas', ok: schemas.length >= 16, required: true, detail: `${schemas.length} schema @ ${directory}` });
  } catch (error) {
    checks.push({ name: 'schemas', ok: false, required: true, detail: error instanceof Error ? error.message : String(error) });
  }

  const modulesDir = path.join(root, 'business-modules');
  const modules = fs.existsSync(modulesDir)
    ? fs.readdirSync(modulesDir, { withFileTypes: true }).filter((entry) => entry.isDirectory() && !entry.name.startsWith('_')).map((entry) => entry.name)
    : [];
  const invalidModules = modules.filter((moduleId) => !validateModulePack(`business-modules/${moduleId}`, { root }).valid);
  checks.push({ name: 'module-packs', ok: modules.length > 0 && invalidModules.length === 0, required: true, detail: `${modules.length} modules; invalid=${invalidModules.join(',') || 'none'}` });

  const artifactProbe = path.join(root, 'artifacts', '.healthcheck');
  try {
    fs.mkdirSync(artifactProbe, { recursive: true });
    fs.writeFileSync(path.join(artifactProbe, 'probe.txt'), 'ok', 'utf8');
    fs.rmSync(artifactProbe, { recursive: true, force: true });
    checks.push({ name: 'artifacts-writable', ok: true, required: true, detail: path.join(root, 'artifacts') });
  } catch (error) {
    checks.push({ name: 'artifacts-writable', ok: false, required: true, detail: error instanceof Error ? error.message : String(error) });
  }

  if (config?.browser.mode === 'cdp') {
    const cdp = await cdpReachable(config.browser.cdpEndpoint);
    checks.push({ name: 'cdp', ok: cdp.ok, required: false, detail: `${config.browser.cdpEndpoint} ${cdp.detail}` });
  }

  const requiredFailed = checks.filter((check) => check.required && !check.ok);
  const output = {
    mode: 'HEALTH_CHECK',
    success: requiredFailed.length === 0,
    platform_version: PLATFORM_VERSION,
    package_version: readPackageVersion(root),
    commit: process.env.GIT_COMMIT ?? 'UNKNOWN',
    checks,
    warnings: checks.filter((check) => !check.required && !check.ok).map((check) => check.name),
  };
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  process.exitCode = output.success ? 0 : 2;
  return output.success ? 0 : 2;
}

main().then((code) => process.exit(code)).catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
});
