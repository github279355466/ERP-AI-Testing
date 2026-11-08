import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const withWrite = process.argv.includes('--with-write');
const cases = [
  { module: 'base', case: 'SMOKE-INVENTORY-PARAM-LIST', write: false },
  { module: 'ar', case: 'SMOKE-AR-BIZ-TYPE-LIST', write: false },
  { module: 'ap', case: 'SMOKE-AP-BIZ-TYPE-LIST', write: false },
  { module: 'purchase', case: 'SMOKE-PURCHASE-ORDER-LIST', write: false },
  ...(withWrite ? [{ module: 'purchase', case: 'SMOKE-PURCHASE-ORDER-CREATE', write: true }] : []),
];

const stamp = new Date().toISOString().replace(/[-:.]/g, '').slice(0, 15);
const results = [];
for (const entry of cases) {
  const runId = `SYS-${entry.module.toUpperCase()}-${stamp}`;
  const args = [
    'dist/cli/platform-run.js',
    'run',
    '--module',
    entry.module,
    '--case',
    entry.case,
    '--run-id',
    runId,
  ];
  if (entry.write) args.push('--allow-write', '--config', 'config/athena.write.config.json');
  process.stdout.write(`\n==> ${entry.module}/${entry.case} (${entry.write ? 'WRITE' : 'READ_ONLY'})\n`);
  const started = Date.now();
  const result = spawnSync(process.execPath, args, {
    stdio: 'inherit',
    env: { ...process.env, ALLOW_ERP_UI_TEST: 'true' },
  });
  results.push({ module: entry.module, case: entry.case, write: entry.write, run_id: runId, exit_code: result.status, duration_ms: Date.now() - started });
}

const summary = { generated_at: new Date().toISOString(), with_write: withWrite, results };
const outDir = path.join(process.cwd(), 'artifacts', 'session-outputs');
fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, `system-smoke-${stamp}.json`);
fs.writeFileSync(outFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
process.stdout.write(`\n${JSON.stringify(summary, null, 2)}\n`);
process.stdout.write(`\nsummary: ${outFile}\n`);
process.exit(results.every((entry) => entry.exit_code === 0) ? 0 : 2);
