import { expect, test } from '@playwright/test';
import { connectCdp } from '../../src/browser/cdp-adapter';
import { PageManager } from '../../src/browser/page-manager';
import { loadConfig } from '../../src/config/athena-config';
import { explorePage } from '../../src/discovery/page-explorer';

test('CDP 接管并识别业务页', async () => {
  const config = loadConfig('config/athena.config.json');

  let session;
  try {
    session = await connectCdp(config);
  } catch {
    test.skip(true, `CDP 未运行: ${config.browser.cdpEndpoint}`);
    return;
  }

  const manager = new PageManager(session.context, config);
  const businessPages = manager.summarize().filter((page) => page.kind === 'business');
  if (businessPages.length === 0) {
    test.skip(true, '没有打开低代码业务页');
    return;
  }

  const page = await manager.business();
  const closed = await manager.resetTabs(page);
  await manager.ensureListState(page, { forceReload: closed > 0 });
  const ready = await manager.waitReady(page);
  expect(ready.ok).toBe(true);

  const snapshot = await explorePage(page);
  expect(snapshot.title.length).toBeGreaterThan(0);
  expect(snapshot.grid.rowCount).toBeGreaterThan(0);
  expect(snapshot.grid.headers.some((header) => header.colId === 'ops_unit_no')).toBe(true);
});
