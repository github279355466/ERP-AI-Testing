import { chromium } from '@playwright/test';
import { AthenaConfig } from '../config/athena-config';
import { EnvironmentGuard } from '../environment/environment-guard';
import { BrowserSession } from './session';

/**
 * 接管已登录的 Chrome 窗口。
 * 注意：CDP 连接得到的 Browser 不调用 close()，否则会关闭用户正在使用的浏览器。
 */
export async function connectCdp(config: AthenaConfig): Promise<BrowserSession> {
  new EnvironmentGuard(config).assertConnectionAllowed();
  const browser = await chromium.connectOverCDP(config.browser.cdpEndpoint, {
    timeout: config.browser.navigationTimeoutMs,
  });
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(`CDP 会话中没有可用的 BrowserContext: ${config.browser.cdpEndpoint}`);
  }
  return {
    mode: 'cdp',
    context,
    browser,
    async disconnect() {
      // 仅断开引用，不关闭浏览器进程。
    },
  };
}
