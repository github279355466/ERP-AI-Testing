const { attach } = require('./attach');
const fs = require('fs');

(async () => {
  const { context } = await attach();
  const page = context.pages().find((p) => /lowcode-form-render/.test(p.url()));
  await page.bringToFront();

  let design = null;
  page.on('response', async (res) => {
    if (res.url().includes('queryLatestPageDesignRelease')) {
      try {
        design = await res.json();
      } catch (e) {
        design = { error: String(e) };
      }
    }
  });

  await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 }).catch(() => {});
  await page.waitForTimeout(12000);

  if (!design) {
    console.log('NO DESIGN CAPTURED');
    process.exit(0);
  }

  fs.mkdirSync('outputs', { recursive: true });
  fs.writeFileSync('outputs/page-design-存货参数.json', JSON.stringify(design, null, 2), 'utf8');

  const walk = (node, out) => {
    if (!node) return out;
    if (Array.isArray(node)) return node.reduce((a, n) => walk(n, a), out);
    if (typeof node !== 'object') return out;
    const code = node.fieldCode || node.fieldKey || node.prop || node.code;
    const label = node.label || node.title || node.name;
    if (code && label) out.push({ code, label, type: node.componentType || node.type || node.widgetType || null, required: node.required ?? node.isRequired ?? null });
    Object.values(node).forEach((v) => { if (v && typeof v === 'object') walk(v, out); });
    return out;
  };
  const fields = walk(design, []);
  console.log('TOP KEYS', Object.keys(design).slice(0, 20));
  console.log('FIELDS', fields.length);
  console.log(JSON.stringify(fields.slice(0, 30), null, 2));
  process.exit(0);
})();
