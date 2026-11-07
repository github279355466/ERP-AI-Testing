import fs from 'node:fs';
import { chromium } from '@playwright/test';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';
import { BrowserSession } from './session';

/**
 * 独立 Chromium 回归模式：使用可选 storageState 复用登录态。
 * 不做自动登录，登录态失效时必须人工介入。
 */
export async function launchChromium(config: AthenaConfig): Promise<BrowserSession> {
  const storageState = config.browser.storageState
    ? resolveProjectPath(config, config.browser.storageState)
    : undefined;

  if (storageState && !fs.existsSync(storageState)) {
    throw new Error(`storageState 文件不存在: ${storageState}`);
  }

  const browser = await chromium.launch({
    headless: config.browser.headless,
    proxy: { server: config.browser.proxy },
    args: ['--no-sandbox'],
  });
  const context = await browser.newContext({
    viewport: config.browser.viewport,
    ignoreHTTPSErrors: true,
    storageState,
  });
  context.setDefaultTimeout(config.browser.actionTimeoutMs);
  context.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);

  return {
    mode: 'playwright',
    context,
    browser,
    async disconnect() {
      await context.close();
      await browser.close();
    },
  };
}
