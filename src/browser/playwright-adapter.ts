import fs from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { AthenaConfig, resolveBrowserUserDataDir, resolveProjectPath } from '../config/athena-config';
import { EnvironmentGuard } from '../environment/environment-guard';
import { BrowserSession } from './session';

/**
 * 独立浏览器模式。默认使用隔离上下文；只有 persistSession=true 时才复用 profile。
 * 不做自动登录，登录态失效时必须由 SessionManager 处理。
 */
export async function launchChromium(config: AthenaConfig): Promise<BrowserSession> {
  new EnvironmentGuard(config).assertConnectionAllowed();

  const storageState = config.browser.storageState
    ? resolveProjectPath(config, config.browser.storageState)
    : undefined;
  if (storageState && !fs.existsSync(storageState)) {
    throw new Error(`storageState 文件不存在: ${storageState}`);
  }

  const launchOptions: Parameters<typeof chromium.launch>[0] = {
    headless: config.browser.headless,
    proxy: { server: config.browser.proxy },
    args: ['--no-sandbox'],
  };
  if (config.browser.engine === 'chrome') launchOptions.channel = 'chrome';
  if (config.browser.engine === 'edge') launchOptions.channel = 'msedge';

  if (config.browser.persistSession) {
    const userDataDir = resolveBrowserUserDataDir(config);
    fs.mkdirSync(path.dirname(userDataDir), { recursive: true });
    const context = await chromium.launchPersistentContext(userDataDir, {
      ...launchOptions,
      viewport: config.browser.viewport,
      ignoreHTTPSErrors: true,
      acceptDownloads: false,
    });
    context.setDefaultTimeout(config.browser.actionTimeoutMs);
    context.setDefaultNavigationTimeout(config.browser.navigationTimeoutMs);
    return {
      mode: 'playwright',
      context,
      browser: context.browser() ?? undefined,
      async disconnect() {
        await context.close();
      },
    };
  }

  const browser = await chromium.launch(launchOptions);
  const context = await browser.newContext({
    viewport: config.browser.viewport,
    ignoreHTTPSErrors: true,
    storageState,
    acceptDownloads: false,
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
