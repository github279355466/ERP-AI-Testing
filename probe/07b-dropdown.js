const { attach } = require('./attach');

(async () => {
  const { context } = await attach();
  const page = context.pages().find((p) => /lowcode-form-render/.test(p.url()));
  await page.bringToFront();
  await page.waitForTimeout(500);

  const box = await page.evaluate(() => {
    const label = document.querySelector('label[for="ops_unit_invnt_param.aprv_date_basis"]');
    const item = label && label.closest('[class*=FormItem-module_form-item__]');
    const sel = item && item.querySelector('[class*=Select-module_select__]');
    if (!sel) return null;
    const r = sel.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  console.log('BOX', JSON.stringify(box));
  if (box) await page.mouse.click(box.x, box.y);
  await page.waitForTimeout(1800);

  const layers = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('body *').forEach((e) => {
      const s = getComputedStyle(e);
      if ((s.position === 'fixed' || s.position === 'absolute') && Number(s.zIndex) >= 100 && e.offsetWidth > 40) {
        out.push({
          tag: e.tagName.toLowerCase(),
          cls: String(e.className).slice(0, 90),
          z: s.zIndex,
          text: (e.innerText || '').trim().replace(/\n+/g, ' | ').slice(0, 150),
        });
      }
    });
    return out.slice(-6);
  });
  console.log('LAYERS', JSON.stringify(layers, null, 2));
  await page.screenshot({ path: 'probe/shots/07b-dropdown.png' });
  process.exit(0);
})();
