const { attach } = require('./attach');

(async () => {
  const { context } = await attach();
  const page = context.pages().find((p) => /lowcode-form-render/.test(p.url()));
  if (!page) throw new Error('lowcode page not found');
  await page.bringToFront();
  await page.waitForTimeout(1500);

  const reqs = [];
  page.on('request', (r) => {
    if (['xhr', 'fetch'].includes(r.resourceType())) reqs.push(`${r.method()} ${r.url().slice(0, 160)}`);
  });

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.innerText.trim() === '查看' && b.offsetParent !== null && b.offsetWidth > 0);
    if (!btn) return null;
    const row = btn.closest('[role=row]') || btn.closest('.ag-row');
    const text = row ? row.innerText.replace(/\s+/g, ' ').slice(0, 80) : '';
    btn.click();
    return text;
  });
  console.log('ROW', clicked);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const dialogs = [...document.querySelectorAll('[role=dialog],[class*=Modal],[class*=modal],[class*=Drawer],[class*=drawer]')]
      .filter((e) => e.offsetWidth > 200);
    const d = dialogs[0] || document.body;
    const labels = [...d.querySelectorAll('label,[class*=label]')].slice(0, 40).map((e) => ({
      text: (e.innerText || '').trim().slice(0, 30),
      cls: String(e.className).slice(0, 80),
      for: e.getAttribute('for'),
    }));
    const controls = [...d.querySelectorAll('input,textarea,[class*=select],[class*=picker],[class*=date]')].slice(0, 40).map((e) => ({
      tag: e.tagName.toLowerCase(),
      cls: String(e.className).slice(0, 100),
      name: e.getAttribute('name'),
      ph: e.getAttribute('placeholder'),
      val: e.value,
      readonly: e.readOnly,
      disabled: e.disabled,
    }));
    return {
      dialogCount: dialogs.length,
      dialogCls: d.className ? String(d.className).slice(0, 120) : null,
      dialogHTMLHead: d.outerHTML.slice(0, 1200),
      labels,
      controls,
      text: (d.innerText || '').trim().slice(0, 600),
    };
  });
  console.log(JSON.stringify(info, null, 2));
  console.log('REQS', reqs.slice(-12).join('\n'));
  await page.screenshot({ path: 'probe/shots/05-form.png' });
  process.exit(0);
})();
