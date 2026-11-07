const fs = require('node:fs');
const files = {
  'TP-027 批号编号规则': 'probe/60-batch.out',
  'TP-038 采购取价策略': 'probe/60-price-strategy.out',
  'TP-039 供应商品号价格': 'probe/60-supp-price.out',
  'TP-047 询价单': 'probe/60-inquiry.out',
  'TP-051 采购退货单': 'probe/60-return.out',
  'TP-052 采购退货出库单': 'probe/60-return-out.out',
};

function section(text, name) {
  const marker = `--- ${name} ---`;
  const start = text.indexOf(marker);
  if (start < 0) return null;
  const body = text.slice(start + marker.length);
  const end = body.indexOf('--- ', 2);
  const raw = end > 0 ? body.slice(0, end) : body;
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

const output = { generatedAt: new Date().toISOString(), pages: [] };
for (const [workItem, file] of Object.entries(files)) {
  const text = fs.readFileSync(file, 'utf8');
  const list = section(text, 'list');
  const created = section(text, 'new');
  output.pages.push({
    workItem,
    listColumns: list?.columns ?? [],
    listRowsSampled: list?.rows?.length ?? 0,
    footer: list?.footer ?? '',
    newFields: (created?.fields ?? []).map((field) => ({
      path: field.path,
      label: field.label,
      required: field.required,
      input: field.input ? { disabled: field.input.disabled, readonly: field.input.readonly, maxlength: field.input.maxlength } : null,
      select: field.select ? field.select.text : null,
      window: field.window ? field.window.text : null,
      switch: field.switch,
    })),
    gridHeaders: created?.gridHeaders ?? [],
    buttons: created?.buttons ?? [],
  });
}
fs.writeFileSync('artifacts/session-outputs/purchase-page-structure.json', JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify(output.pages.map((p) => ({ workItem: p.workItem, columns: p.listColumns.length, fields: p.newFields.length, grid: p.gridHeaders.length, buttons: p.buttons.map((b) => b.text) })), null, 2));
