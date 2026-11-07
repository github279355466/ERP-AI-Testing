const { attach } = require('./attach');

(async () => {
  const { context } = await attach();
  const page = context.pages().find((p) => /lowcode-form-render/.test(p.url()));
  await page.bringToFront();
  await page.waitForTimeout(800);

  const clicked = await page.evaluate(() => {
    const btn = [...document.querySelectorAll('button')].find((b) => b.innerText.trim() === '编辑' && b.offsetWidth > 0);
    if (!btn) return null;
    btn.click();
    return true;
  });
  console.log('EDIT CLICKED', clicked);
  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[class*=FormItem-module_form-item__]')].filter((e) => e.offsetWidth > 0);
    return items.map((it) => {
      const label = it.querySelector('label,[class*=form-item-label__]');
      const control = it.querySelector('input,textarea,[class*=select],[class*=picker],[class*=switch]');
      return {
        label: label ? label.innerText.replace(/\s+/g, ' ').trim().slice(0, 30) : null,
        for: label ? label.getAttribute('for') : null,
        required: !!it.querySelector('[class*=required]'),
        control: control ? {
          tag: control.tagName.toLowerCase(),
          cls: String(control.className).slice(0, 90),
          readonly: control.readOnly,
          disabled: control.disabled,
          val: control.value,
          ph: control.getAttribute('placeholder'),
        } : null,
        hasPickerBtn: !!it.querySelector('[class*=suffix] button, [class*=picker] button, button [class*=search], svg'),
        itemCls: String(it.className).slice(0, 100),
      };
    });
  });
  console.log(JSON.stringify(info, null, 2));

  const btns = await page.evaluate(() => [...document.querySelectorAll('button')]
    .filter((b) => b.offsetWidth > 0 && b.innerText.trim())
    .map((b) => b.innerText.trim()).slice(0, 20));
  console.log('BUTTONS', JSON.stringify(btns));
  await page.screenshot({ path: 'probe/shots/06-edit.png' });
  process.exit(0);
})();
