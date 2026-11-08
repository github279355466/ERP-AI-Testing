import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { createRunContext, startupBanner } from '../../src/environment/run-context';

test('run context 包含 runId、operator 与测试用例', () => {
  const config = loadConfig('config/athena.config.json');
  const run = createRunContext(config, {
    computeModelVersion: false,
    operator: 'qa-operator',
    testCaseId: 'P2.0-CONTEXT',
  });
  expect(run.runId).toMatch(/^\d{8}-\d{6}-[a-z0-9]{4}$/);
  expect(run.operator).toBe('qa-operator');
  expect(run.testCaseId).toBe('P2.0-CONTEXT');
  expect(run.environmentType).toBe('test');
});

test('启动横幅脱敏 URL token', () => {
  const base = loadConfig('config/athena.config.json');
  const config = { ...base, environment: { ...base.environment, baseUrl: 'https://athena-test.digiwincloud.com.cn/?token=secret' } };
  const run = createRunContext(config, { computeModelVersion: false });
  const banner = startupBanner(config, run);
  expect(JSON.stringify(banner)).not.toContain('secret');
  expect(banner.runId).toBe(run.runId);
});
