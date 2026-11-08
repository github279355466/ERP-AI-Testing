import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { diagnosePageSession, SessionExpiredError } from '../../src/session/session-manager';

const config = loadConfig('config/athena.config.json');

test('登录表单可见时判定会话失效', async ({ page }) => {
  await page.setContent(
    '<html><head><title>登录</title></head><body><input name="userId"><input name="password"><button>登录</button></body></html>',
  );
  const diagnosis = await diagnosePageSession(page, config.environment.lowcodeHost);
  expect(diagnosis.state).toBe('session_expired');
  expect(diagnosis.loginFormVisible).toBe(true);
});

test('连续 5 次将会话失效表单识别为 session_expired', async ({ page }) => {
  for (let index = 0; index < 5; index += 1) {
    await page.setContent(
      '<html><head><title>登录</title></head><body><input name="userId"><input name="password"><button>登录</button></body></html>',
    );
    const diagnosis = await diagnosePageSession(page, config.environment.lowcodeHost);
    expect(diagnosis.state).toBe('session_expired');
  }
});

test('门户头部可见时判定已登录', async ({ page }) => {
  await page.setContent(
    '<html><head><title>鼎捷雅典娜</title></head><body><div id="main-header" style="width:100px;height:20px"></div><div class="menu-list" style="width:100px;height:20px"></div></body></html>',
  );
  const diagnosis = await diagnosePageSession(page, config.environment.lowcodeHost);
  expect(diagnosis.state).toBe('authenticated');
  expect(diagnosis.portalHeaderVisible).toBe(true);
});

test('无登录表单且无门户信号时判定 unknown', async ({ page }) => {
  await page.setContent('<html><head><title>空白</title></head><body><div>空白</div></body></html>');
  const diagnosis = await diagnosePageSession(page, config.environment.lowcodeHost);
  expect(diagnosis.state).toBe('unknown');
});

test('SessionExpiredError 带稳定错误码', () => {
  const error = new SessionExpiredError('测试');
  expect(error.code).toBe('SESSION_EXPIRED');
  expect(error.message).toContain('[SESSION_EXPIRED]');
});
