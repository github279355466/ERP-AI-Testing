// 收尾：修复 07 的 4.2 表格衔接、补入 OQ-NEW-27 正式条目；修正 memory 日志残留
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing';

function load(rel) { return fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n'); }
function save(rel, t) { fs.writeFileSync(path.join(ROOT, rel), Buffer.from(t.replace(/\n/g, '\r\n'), 'utf8')); }

const ROW27 = '| OQ-NEW-27 | **HIGH** | 流程表的「操作步骤」列与原表「节点名称」列错配，导致 8 列丢 5 列；`workflows.json` 中 68/143 条 step 为纯数字，无法还原起点/终点/单据节点/节点关系（`02` §9、`03` §7 未落实）。是否按原表列头重解析并回填业务对象？ | `05` §10.5.6；`src/prd/extract.ts` 流程表解析；`prd/采购退货出库单/采购退货出库单PRD.v1.24.md:69` |';
const NEW_NOTE = '> **编号说明**：OQ-NEW-27 原在 `04:466` 被引用但 `05` 报告缺全文，**现已由原作者补齐全文并纳入登记**；21 条跨项 OQ 经复核无跨报告重复（早先按粗签名得到的 3 个疑似重复为伪重复，已撤销该判断）。';

// --- 07 ---
let o7 = load('artifacts/acceptance/07-open-questions.md');
const before1 = o7;
o7 = o7.replace(/\n\n(?=\| OQ-NEW-17 \|)/, '\n');
console.log('07 删除 16/17 间空行:', o7 !== before1);
const gapLine = o7.split('\n').find(l => l.startsWith('> **编号断档登记'));
if (gapLine) {
  o7 = o7.replace('\n\n' + gapLine, '\n' + ROW27 + '\n\n' + NEW_NOTE);
  console.log('07 替换断档说明为 OQ-NEW-27 正式条目: true');
} else {
  console.log('07 未找到断档说明（可能已处理）');
}
save('artifacts/acceptance/07-open-questions.md', o7);

// --- memory 日志 ---
let log = load('.workbuddy/memory/2026-11-07.md');
log = log.replace('产品评审员 26 / QA 20，另 1 处编号断档待补', '产品评审员 27 / QA 20（OQ-NEW-27 已由原作者补齐全文）');
save('.workbuddy/memory/2026-11-07.md', log);

// --- 核对 ---
console.log('\n=== 核对 ===');
const t7 = load('artifacts/acceptance/07-open-questions.md');
console.log('07 残留「编号断档登记」:', t7.includes('编号断档登记'));
console.log('07 OQ-NEW-27 为表格行:', t7.includes('| OQ-NEW-27 |'));
console.log('07 01~27 全在:', Array.from({length:27},(_,i)=>'OQ-NEW-'+String(i+1).padStart(2,'0')).every(x => t7.includes(x)));
const main = load('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md');
console.log('总报告残留「引用存在、全文缺失」:', main.includes('引用存在、全文缺失'));
const gs = load('deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md');
for (const [name, t] of [['07', t7], ['总报告', main], ['gstack', gs]]) {
  console.log(name + ': 62=' + t.includes('62 条') + ' 392=' + t.includes('392 条') + ' 17项=' + t.includes('17 项严重'));
}
const mem = load('.workbuddy/memory/2026-11-07.md');
console.log('memory 日志残留「产品评审员 26」:', mem.includes('产品评审员 26'));
