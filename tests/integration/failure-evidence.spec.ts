import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { AthenaConfig, loadConfig } from '../../src/config/athena-config';
import { FailureCollector } from '../../src/diagnostics/failure-collector';
import { EvidenceManager } from '../../src/evidence/evidence-manager';

function tempConfig(): AthenaConfig {
  const base = loadConfig('config/athena.config.json');
  return { ...base, projectRoot: fs.mkdtempSync(path.join(os.tmpdir(), 'athena-failure-')) };
}

test('失败时生成截图、DOM、诊断快照且脱敏', async ({ page }) => {
  const config = tempConfig();
  const evidence = new EvidenceManager(config, '20261108-120000-fail');
  try {
    evidence.init();
    await page.setContent('<html><head><title>失败注入</title></head><body><h1>失败注入</h1><p>token=secret-value</p></body></html>');
    const collector = new FailureCollector(evidence);
    const result = await collector.capture(page, 'injected', new Error('boom'));
    expect(result.message).toBe('boom');
    expect(result.files.some((file) => file.endsWith('-diagnostics.json'))).toBe(true);
    expect(result.files.some((file) => file.endsWith('-fail.png'))).toBe(true);
    expect(result.files.some((file) => file.endsWith('-fail.html'))).toBe(true);
    const diagnostics = fs.readFileSync(path.join(evidence.root, 'injected-diagnostics.json'), 'utf8');
    expect(diagnostics).toContain('失败注入');
    expect(diagnostics).not.toContain('secret-value');
  } finally {
    fs.rmSync(config.projectRoot, { recursive: true, force: true });
  }
});
