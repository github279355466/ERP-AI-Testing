const fs = require('node:fs');
const path = require('node:path');

const ROOT = 'C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd';
const ITEMS = [
  ['采购取价策略', '采购取价策略/采购取价策略PRD.v1.7.md', 'TP-038'],
  ['批号编号规则', '批号编号规则/批号编号规则PRD.v1.5.md', 'TP-027'],
  ['询价单', '询价单/询价单PRD.v1.7.md', 'TP-047'],
  ['供应商品号价格', '供应商品号价格/供应商品号价格PRD.v1.7.md', 'TP-039'],
  ['采购退货单', '采购退货单/采购退货单PRD.v1.11.md', 'TP-051'],
  ['采购退货出库单', '采购退货出库单/采购退货出库单PRD.v1.24.md', 'TP-052'],
];

function section(text, startPattern, endPattern) {
  const start = text.search(startPattern);
  if (start < 0) return '';
  const rest = text.slice(start);
  const end = rest.search(endPattern);
  return end > 0 ? rest.slice(0, end) : rest;
}

const output = { generatedAt: new Date().toISOString(), source: ROOT, items: [] };

for (const [workItem, relativePath, testPlan] of ITEMS) {
  const file = path.join(ROOT, relativePath);
  const text = fs.readFileSync(file, 'utf8');
  const version = (relativePath.match(/v(\d+(?:\.\d+)*)\.md$/) || [])[1] || '';
  const entityMatch = text.match(/\*\*业务对象\*\*[：:]\s*([^\n（(]+)[（(]([a-zA-Z0-9_]+)[）)]/);
  const title = (text.match(/^#\s+(.+)$/m) || [])[1]?.trim() || workItem;

  const fieldMatches = [...text.matchAll(/^#####\s+(.+?)\s*\(([a-zA-Z0-9_]+)\)\s*$/gm)];
  const fields = fieldMatches.map((match, index) => {
    const start = match.index + match[0].length;
    const end = index + 1 < fieldMatches.length ? fieldMatches[index + 1].index : text.length;
    const block = text.slice(start, end);
    return {
      label: match[1].trim(),
      name: match[2],
      required: /是否必填\s*\|\s*✅\s*是/.test(block),
      readonly: /是否只读\s*\|\s*✅\s*是/.test(block),
      key: /是否主键\s*\|\s*✅\s*是/.test(block),
      component: (block.match(/填值方式\s*\|\s*([^\n|]+)/) || [])[1]?.replace(/✅/g, '').trim() || '',
    };
  });

  const firstPage = text.indexOf('列表页');
  const listBlock = firstPage >= 0 ? text.slice(firstPage, firstPage + 4000) : '';
  const defaultLine = (listBlock.match(/\|\s*默认字段\s*\|([^\n]+)/) || [])[1] || '';
  const columns = defaultLine.split(/[｜|]/).map((s) => s.trim()).filter(Boolean);

  const opBlock = section(text, /##\s*四、操作说明/, /##\s*五、/);
  const operations = [...opBlock.matchAll(/^####\s+(.+)$/gm)].map((m) => m[1].trim());

  output.items.push({
    workItem,
    testPlan,
    prdVersion: version,
    title,
    entity: entityMatch ? entityMatch[2] : '',
    entityLabel: entityMatch ? entityMatch[1].trim() : '',
    fieldCount: fields.length,
    fields,
    listColumns: columns,
    operations,
    sourceFile: relativePath,
  });
}

fs.writeFileSync('knowledge/purchase-metadata.candidate.json', JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify(output.items.map((item) => ({
  workItem: item.workItem,
  tp: item.testPlan,
  version: item.prdVersion,
  entity: item.entity,
  fields: item.fieldCount,
  columns: item.listColumns.length,
  operations: item.operations,
})), null, 2));
