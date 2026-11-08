import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { AthenaConfig, loadConfig } from '../../src/config/athena-config';
import { createRunId, EvidenceManager, redactSecrets } from '../../src/evidence/evidence-manager';
import { createRunManifest } from '../../src/evidence/run-manifest';

function tempConfig(): AthenaConfig {
  const base = loadConfig('config/athena.config.json');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-evidence-'));
  return { ...base, projectRoot: root };
}

test('脱敏 token、password、cookie、authorization', () => {
  const text =
    'https://x.test/?token=abc123 password=p@ss cookie=ck123 authorization=Bearer%20xyz';
  const masked = redactSecrets(text);
  expect(masked).not.toContain('abc123');
  expect(masked).not.toContain('p@ss');
  expect(masked).not.toContain('ck123');
  expect(masked).not.toContain('Bearer%20xyz');
  expect(masked).toContain('<redacted>');
});

test('连续生成 1000 个 runId 不重复', () => {
  const values = new Set<string>();
  for (let index = 0; index < 1000; index += 1) values.add(createRunId());
  expect(values.size).toBe(1000);
});

test('证据目录包含 traces/reports 且日志脱敏', () => {
  const config = tempConfig();
  const evidence = new EvidenceManager(config, '20261108-120000-test');
  try {
    evidence.init();
    expect(fs.existsSync(evidence.shots)).toBe(true);
    expect(fs.existsSync(evidence.dom)).toBe(true);
    expect(fs.existsSync(evidence.logs)).toBe(true);
    expect(fs.existsSync(evidence.traces)).toBe(true);
    expect(fs.existsSync(evidence.reports)).toBe(true);
    evidence.log('test', { url: 'https://x.test/?token=secret-value', password: 'p@ss' });
    const log = fs.readFileSync(path.join(evidence.logs, 'run.jsonl'), 'utf8');
    expect(log).not.toContain('secret-value');
    expect(log).not.toContain('p@ss');
  } finally {
    fs.rmSync(config.projectRoot, { recursive: true, force: true });
  }
});

test('写入 manifest 并保留证据文件清单', () => {
  const config = tempConfig();
  const evidence = new EvidenceManager(config, '20261108-120000-manifest');
  try {
    evidence.init();
    const manifest = createRunManifest({
      runId: evidence.runId,
      startedAt: '2026-11-08T12:00:00.000Z',
      environmentName: 'athena-test',
      environmentType: 'test',
      testCaseId: 'P2.0-EVIDENCE',
      operator: 'qa',
      evidenceFiles: ['shots/a.png'],
    });
    const file = evidence.writeManifest(manifest);
    expect(fs.existsSync(file)).toBe(true);
    expect(evidence.currentManifest?.runId).toBe(evidence.runId);
  } finally {
    fs.rmSync(config.projectRoot, { recursive: true, force: true });
  }
});

test('过期 run 目录被清理，phase2 目录保留', () => {
  const config = tempConfig();
  const artifacts = path.join(config.projectRoot, 'artifacts');
  const oldRun = path.join(artifacts, '20200101-000000-old1');
  const phase2 = path.join(artifacts, 'phase2');
  fs.mkdirSync(oldRun, { recursive: true });
  fs.mkdirSync(phase2, { recursive: true });
  const old = new Date('2020-01-01T00:00:00.000Z');
  fs.utimesSync(oldRun, old, old);
  const evidence = new EvidenceManager(config, '20261108-120000-prune');
  try {
    const removed = evidence.pruneExpiredRuns(new Date('2026-11-08T00:00:00.000Z').getTime());
    expect(removed).toContain('20200101-000000-old1');
    expect(fs.existsSync(oldRun)).toBe(false);
    expect(fs.existsSync(phase2)).toBe(true);
  } finally {
    fs.rmSync(config.projectRoot, { recursive: true, force: true });
  }
});
