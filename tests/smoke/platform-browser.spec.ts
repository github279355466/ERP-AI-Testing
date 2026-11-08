import { expect, test } from '@playwright/test';
import { BrowserManager } from '../../src/browser/browser-manager';
import { PageManager } from '../../src/browser/page-manager';
import { loadConfig } from '../../src/config/athena-config';
import { EvidenceManager, createRunId } from '../../src/evidence/evidence-manager';

test('P4 浏览器基础能力：连接、识别页面并采集证据', async () => {
  test.skip(process.env.ALLOW_ERP_UI_TEST !== 'true', '未设置 ALLOW_ERP_UI_TEST=true，跳过真实浏览器验证');
  const config = loadConfig('config/athena.config.json');
  const manager = new BrowserManager(config);
  let session;
  try {
    session = await manager.connect();
  } catch (error) {
    test.skip(true, `浏览器会话不可用: ${error instanceof Error ? error.message : String(error)}`);
    return;
  }

  const pages = new PageManager(session.context, config);
  const portalHost = new URL(config.environment.baseUrl).host;
  const summaries = pages.summarize();
  let portal = session.context.pages().find((page) => new URL(page.url()).host === portalHost);
  if (!portal) {
    portal = await session.context.newPage();
    await portal.goto(config.environment.baseUrl, { waitUntil: 'domcontentloaded' });
  }
  await portal.waitForLoadState('domcontentloaded').catch(() => undefined);

  const evidence = new EvidenceManager(config, createRunId());
  evidence.init();
  const shot = await evidence.screenshot(portal, 'platform-browser-smoke');
  const dom = await evidence.domSnapshot(portal, 'platform-browser-smoke');
  const summary = {
    url: portal.url(),
    title: await portal.title(),
    pages: summaries,
    shot,
    dom,
  };
  evidence.writeJson('platform-browser-smoke', summary);

  expect(new URL(portal.url()).host).toBe(portalHost);
  expect(summary.title.length).toBeGreaterThan(0);
  expect(summary.pages.length).toBeGreaterThan(0);
  await manager.disconnect(session);
});
