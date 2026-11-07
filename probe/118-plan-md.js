const fs = require('node:fs');

const plan = JSON.parse(fs.readFileSync('knowledge/purchase-prerequisite-plan.json', 'utf8'));
const lines = [];
lines.push('# TP-027 / TP-038 / TP-039 / TP-047 / TP-051 / TP-052 采购域前置数据与执行顺序测试计划');
lines.push('');
lines.push('- 版本：v0.1');
lines.push('- 日期：2026-11-07');
lines.push('- 目标：先建立采购域测试所需的主数据与源单，再执行目标作业，避免供应商/品号/源单为空导致中途阻断');
lines.push('- 机器可读清单：`knowledge/purchase-prerequisite-plan.json`');
lines.push('- 当前报告：`artifacts/session-outputs/TP-027-038-039-047-051-052-测试报告.md`');
lines.push('');
lines.push('## 1. 背景与现状');
lines.push('');
lines.push('上一轮测试中，三支单据在运营单元 000W1 下“选择供应商”开窗均为 0 行，导致询价单、采购退货单、采购退货出库单无法新增；供应商品号价格同样在供应商开窗处阻断。');
lines.push('');
lines.push('结论：问题不在脚本，而在前置主数据缺失。必须先建立供应商，再建立品号、业务单别、取价数据和源单，最后才能跑目标单据。');
lines.push('');
lines.push('## 2. 依赖关系');
lines.push('');
lines.push('```');
lines.push('P0 运营单元 / 货币 / 仓库 / 批号编号规则');
lines.push('        │');
lines.push('P1 供应商（通用/业务/财务） + 品号（通用/采购/批号）');
lines.push('        │');
lines.push('P2 采购业务单别 + 采购取价策略 + 供应商品号价格');
lines.push('        │');
lines.push('P3 采购订单 → 采购入库单');
lines.push('        │');
lines.push('P4 询价单');
lines.push('P5 采购退货单（依赖 P3 入库单）');
lines.push('P6 采购退货出库单（依赖 P5 退货单）');
lines.push('```');
lines.push('');
lines.push('采购取价服务无独立作业，不在本计划内；后续通过询价单/采购单据取价场景验证。');
lines.push('');
lines.push('## 3. 前置数据清单');
lines.push('');
lines.push('所有数据统一前缀 `' + plan.prefix + '`，只用于测试租户。');
lines.push('');
lines.push('| 阶段 | 数据 | 作业/TP | 关键字段与测试值 | 验证方式 |');
lines.push('| --- | --- | --- | --- | --- |');
for (const phase of plan.phases) {
  for (const item of phase.data) {
    const values = Object.entries(item.values).map(([k, v]) => `${k}=${Array.isArray(v) ? JSON.stringify(v) : v}`).join('；');
    lines.push(`| ${phase.id} | ${item.entity} | ${item.workItem} ${item.tp} | ${values} | ${item.verify} |`);
  }
}
lines.push('');
lines.push('> 供应商、品号的字段名以对应作业页面实际 label 为准；上表列出业务必填项，创建时按页面字段逐项确认。');
lines.push('');
lines.push('## 4. 分阶段执行与门禁');
lines.push('');
for (const phase of plan.phases) {
  lines.push(`### ${phase.id} ${phase.name}`);
  lines.push('');
  lines.push(`- 依赖：${phase.dependsOn.length ? phase.dependsOn.join('、') : '无'}`);
  for (const item of phase.data) {
    lines.push(`- 创建/确认 ${item.entity}：${item.key}（${item.workItem}）`);
  }
  lines.push(`- 门禁：${phase.gate}`);
  lines.push('');
}
lines.push('## 5. 预检清单');
lines.push('');
lines.push('每次执行前先做只读预检，任一门禁为 0 行即停止，不得继续写入。');
lines.push('');
lines.push('| 门禁 | 检查项 | 通过标准 |');
lines.push('| --- | --- | --- |');
lines.push('| G0 | 运营单元/货币/仓库 | 各 >=1 行 |');
lines.push('| G1 | 四页供应商开窗 | 各 >=1 行 |');
lines.push('| G1 | 品号开窗 | >=1 行 |');
lines.push('| G2 | 三支单据单别开窗 | 各 >=1 行 |');
lines.push('| G3 | 退货单取单 | 可查到已审核入库单 |');
lines.push('| G4-G6 | 单据流程 | 状态按预期流转 |');
lines.push('');
lines.push('当前已知缺口：供应商开窗 0 行（证据：`artifacts/session-outputs/TP-027-052-purchase-evidence/*-supplier-lookup.png`）。品号/货币需在供应商补齐后继续预检。');
lines.push('');
lines.push('## 6. 数据清理');
lines.push('');
lines.push('按反向依赖顺序清理：' + plan.cleanupOrder.join(' → ') + '。');
lines.push('');
lines.push('- 清理前先查引用；被引用记录先解除引用或保留并登记。');
lines.push('- 禁止直接改库；清理失败登记到 `docs/TODO.md`。');
lines.push('- 单据类优先用“作废/删除”标准流程清理。');
lines.push('');
lines.push('## 7. 验收标准');
lines.push('');
lines.push('- 所有前置数据可按上表创建并查询到。');
lines.push('- 三支单据不再因供应商/品号/源单为空而阻断。');
lines.push('- 目标作业的新增、编辑、保存、删除、状态流转、明细行、取单/复制等操作可完整执行。');
lines.push('- 每阶段有截图、结果 JSON、请求日志与清理记录。');
lines.push('');
lines.push('## 8. 下一步');
lines.push('');
lines.push('1. 先执行 P0/P1，解决供应商与品号缺口。');
lines.push('2. P1 通过后重跑 TP-039，再做 P2/P3。');
lines.push('3. 最后按 P4→P5→P6 顺序执行单据全流程。');
lines.push('');

const out = 'athena-erp-test-plans/plans/采购管理-基础设置/TP-027-052-采购域前置数据与执行顺序-测试计划.md';
fs.writeFileSync(out, lines.join('\n'), 'utf8');
console.log('written', out, fs.statSync(out).size);
