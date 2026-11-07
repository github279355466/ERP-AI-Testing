const { loadConfig } = require('../dist/config/athena-config');
const { connectCdp } = require('../dist/browser/cdp-adapter');
const { PageManager } = require('../dist/browser/page-manager');

(async () => {
  const config = loadConfig('config/athena.config.json');
  const session = await connectCdp(config);
  const manager = new PageManager(session.context, config);
  const page = await manager.business();
  const dump = async (label) => {
    const info = await page.evaluate(() => ({
      url: location.pathname,
      tabs: [...document.querySelectorAll('.ant-tabs-tab')].map((t) => t.innerText.replace(/\s+/g, ' ').trim()),
      rows: document.querySelectorAll('.ag-center-cols-container .ag-row').length,
      formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
      text: document.body.innerText.slice(0, 40).replace(/\n/g, ' | '),
    }));
    console.log(label, JSON.stringify(info));
  };
  await dump('before');
  const closed = await manager.resetTabs(page);
  console.log('closedTabs', closed);
  const reset = await manager.ensureListState(page, { forceReload: closed > 0 });
  console.log('reset', reset);
  await dump('after');
  process.exit(0);
})();
