const { attach } = require('./attach');

(async () => {
  const { context } = await attach();
  const page = context.pages().find((p) => /lowcode-form-render/.test(p.url()));
  await page.bringToFront();
  await page.waitForTimeout(500);

  // 1) open dropdown for 审核日依据
  const opened = await page.evaluate(() => {
    const label = document.querySelector('label[for="ops_unit_invnt_param.aprv_date_basis"]');
    const item = label && label.closest('[class*=FormItem-module_form-item__]');
    const sel = item && item.querySelector('[class*=Select-module_select__]');
    if (!sel) return null;
    sel.click();
    return true;
  });
  console.log('DROPDOWN OPEN', opened);
  await page.waitForTimeout(1500);

  const dropdown = await page.evaluate(() => {
    const pop = [...document.querySelectorAll('[role=listbox],[class*=dropdown],[class*=popup],[class*=Popover],[class*=options]')]
      .filter((e) => e.offsetWidth > 0 && e.offsetHeight > 0);
    return pop.slice(0, 3).map((e) => ({
      cls: String(e.className).slice(0, 100),
      text: e.innerText.trim().replace(/\n+/g, ' | ').slice(0, 200),
      html: e.outerHTML.slice(0, 700),
    }));
  });
  console.log('DROPDOWN', JSON.stringify(dropdown, null, 2));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(600);

  // 2) open base-data picker for 运营单元
  const openedPicker = await page.evaluate(() => {
    const label = document.querySelector('label[for="ops_unit_invnt_param.ops_unit_no"]');
    const item = label && label.closest('[class*=FormItem-module_form-item__]');
    const sel = item && item.querySelector('[class*=WindowSelect-module_windowSelect]');
    if (!sel) return null;
    sel.click();
    return true;
  });
  console.log('PICKER OPEN', openedPicker);
  await page.waitForTimeout(3500);

  const picker = await page.evaluate(() => {
    const modals = [...document.querySelectorAll('[role=dialog],[class*=Modal],[class*=modal],[class*=Drawer]')]
      .filter((e) => e.offsetWidth > 300 && e.offsetHeight > 200);
    const m = modals[modals.length - 1];
    if (!m) return { modals: 0 };
    return {
      modals: modals.length,
      cls: String(m.className).slice(0, 120),
      text: m.innerText.replace(/\n+/g, ' | ').slice(0, 400),
      inputs: [...m.querySelectorAll('input')].slice(0, 8).map((i) => ({ cls: String(i.className).slice(0, 70), ph: i.placeholder })),
      buttons: [...m.querySelectorAll('button')].filter((b) => b.offsetWidth > 0).map((b) => b.innerText.trim()).slice(0, 12),
      grid: !!m.querySelector('.ag-root'),
      html: m.outerHTML.slice(0, 500),
    };
  });
  console.log('PICKER', JSON.stringify(picker, null, 2));
  await page.screenshot({ path: 'probe/shots/07-picker.png' });
  process.exit(0);
})();
