import { expect, test } from '@playwright/test';
import { loadConfig, parseConfig } from '../../src/config/athena-config';

test('加载项目默认配置', () => {
  const config = loadConfig('config/athena.config.json');
  expect(config.environment.baseUrl).toContain('athena-test.digiwincloud.com.cn');
  expect(config.browser.mode).toBe('cdp');
  expect(config.browser.navigationTimeoutMs).toBeGreaterThanOrEqual(60000);
  expect(config.safety.readOnly).toBe(true);
  expect(config.safety.allowWrite).toBe(false);
  expect(config.safety.forbiddenActionTexts).toContain('保存');
  expect(config.paths.prd).toContain('_prd_workspace');
});

test('环境变量覆盖 CDP 地址', () => {
  process.env.ATHENA_CDP_ENDPOINT = 'http://127.0.0.1:9555';
  try {
    const config = loadConfig('config/athena.config.json');
    expect(config.browser.cdpEndpoint).toBe('http://127.0.0.1:9555');
  } finally {
    delete process.env.ATHENA_CDP_ENDPOINT;
  }
});

test('非法的浏览器模式被拒绝', () => {
  expect(() => parseConfig({ environment: { baseUrl: 'https://x.test' }, browser: { mode: 'firefox' } })).toThrow();
});

test('缺失 baseUrl 被拒绝', () => {
  expect(() => parseConfig({ environment: {}, browser: { mode: 'cdp', cdpEndpoint: 'http://127.0.0.1:9333' } })).toThrow();
});

test('环境变量覆盖 PRD 目录', () => {
  process.env.ATHENA_PRD_DIR = 'D:/tmp/prd';
  try {
    expect(loadConfig('config/athena.config.json').paths.prd).toBe('D:/tmp/prd');
  } finally {
    delete process.env.ATHENA_PRD_DIR;
  }
});
