import { expect, test } from '@playwright/test';
import { AthenaConfig, loadConfig } from '../../src/config/athena-config';
import { EnvironmentGuard } from '../../src/environment/environment-guard';

function configWith(patch: Partial<AthenaConfig['environment']>): AthenaConfig {
  const base = loadConfig('config/athena.config.json');
  return { ...base, environment: { ...base.environment, ...patch } };
}

test('未显式设置 ALLOW_ERP_UI_TEST 时拒绝连接', () => {
  const decision = new EnvironmentGuard(loadConfig('config/athena.config.json'), {}).evaluateConnection();
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('AUTHORIZATION_MISSING');
});

test('授权后可连接非生产测试环境', () => {
  const decision = new EnvironmentGuard(loadConfig('config/athena.config.json'), {
    ALLOW_ERP_UI_TEST: 'true',
  }).evaluateConnection();
  expect(decision.allowed).toBe(true);
});

test('production 环境类型必定拒绝', () => {
  const config = configWith({ type: 'production' });
  const decision = new EnvironmentGuard(config, { ALLOW_ERP_UI_TEST: 'true' }).evaluateConnection();
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('PRODUCTION_ENVIRONMENT');
});

test('生产特征 host 必定拒绝', () => {
  const config = configWith({
    baseUrl: 'https://athena-prod.digiwincloud.com.cn/',
    allowedOrigins: ['https://athena-prod.digiwincloud.com.cn/', configWith({}).environment.lowcodeHost],
  });
  const decision = new EnvironmentGuard(config, { ALLOW_ERP_UI_TEST: 'true' }).evaluateConnection();
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('PRODUCTION_HOST');
});

test('blockedOrigins 命中拒绝', () => {
  const base = configWith({});
  const config = configWith({
    blockedOrigins: [base.environment.baseUrl],
  });
  const decision = new EnvironmentGuard(config, { ALLOW_ERP_UI_TEST: 'true' }).evaluateConnection();
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('BLOCKED_HOST');
});

test('白名单外地址拒绝', () => {
  const guard = new EnvironmentGuard(loadConfig('config/athena.config.json'), { ALLOW_ERP_UI_TEST: 'true' });
  const decision = guard.evaluateUrl('https://example.com/');
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('HOST_NOT_ALLOWED');
});

test('跨主机重定向拒绝', () => {
  const guard = new EnvironmentGuard(loadConfig('config/athena.config.json'), { ALLOW_ERP_UI_TEST: 'true' });
  expect(() =>
    guard.assertAfterNavigation(
      'https://lowcode-form-render-test.apps.digiwincloud.com.cn/list',
      'https://athena-test.digiwincloud.com.cn/',
    ),
  ).toThrow(/REDIRECT_OUTSIDE_ALLOWLIST/);
});

test('启动横幅不包含 token/password', () => {
  const base = loadConfig('config/athena.config.json');
  const config = configWith({
    baseUrl: 'https://athena-test.digiwincloud.com.cn/?token=secret-value',
  });
  const banner = new EnvironmentGuard(config, { ALLOW_ERP_UI_TEST: 'true' }).banner();
  expect(JSON.stringify(banner)).not.toContain('secret-value');
  expect(banner.environmentType).toBe(base.environment.type);
});
