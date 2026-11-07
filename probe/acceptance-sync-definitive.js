// 定稿同步：OQ-NEW-27 全文已补齐、新增 3 条严重缺陷(D-S4/D-S5/E-S4)
// 最终数字：新增 62 条 / 合计 392 条 / 严重缺陷 17 项
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing';

function patch(rel, pairs, regexps) {
  const file = path.join(ROOT, rel);
  let t = fs.readFileSync(file, 'utf8');
  let ok = 0, miss = 0;
  for (const [a, b] of pairs) {
    if (t.includes(a)) { t = t.split(a).join(b); ok++; }
    else { console.log('  MISS [' + rel + '] :: ' + a.slice(0, 95)); miss++; }
  }
  for (const [re, b] of (regexps || [])) {
    if (re.test(t)) { t = t.replace(re, b); ok++; } else { console.log('  MISS-RE [' + rel + '] :: ' + re); miss++; }
  }
  t = t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(file, Buffer.from(t, 'utf8'));
  console.log(`${rel}: applied=${ok} missed=${miss}`);
}

const GAP_NOTE = '\n\n> **编号断档登记（如实登记，不臆造）**：`04-rule-traceability-report.md:466` 引用了「OQ-NEW-27（见 05 报告 10.5.6）」，但 `05-business-relationship-report.md` 无 10.5.6 章节、全仓亦无该条目全文。本次按「引用存在、全文缺失」登记为待补，**不计入 26 条正式新增**，建议由原作者补齐或撤销该引用。';
const ROW27 = '| OQ-NEW-27 | **HIGH** | 流程表的「操作步骤」列与原表「节点名称」列错配，导致 8 列丢 5 列；`workflows.json` 中 68/143 条 step 为纯数字，无法还原起点/终点/单据节点/节点关系（`02` §9、`03` §7 均未落实）。是否按原表列头重解析并回填业务对象？ | `05` §10.5.6；`src/prd/extract.ts` 流程表解析；`prd/采购退货出库单/采购退货出库单PRD.v1.24.md:69` |';
const NEW_NOTE = '> **编号说明**：OQ-NEW-27 原在 `04:466` 被引用但 `05` 报告缺全文，**现已由原作者补齐全文并纳入登记**；21 条跨项 OQ 经复核无跨报告重复（早先按粗签名得到的 3 个疑似重复为伪重复，已撤销该判断）。';

const S14_MAIN = '| 14 | 🔴 | 场景契约 | `scenarios.json`（2,600 `UI_READY`）、`scenarios.ts:19-121` | 2,600 个场景（63.9%）标 `UI_READY` 但正文由 15 个固定模板拼装（仅 48 种前置 / 7 种断言类型），`NEEDS_UI_EXPLORATION` 使用数为 0；与 `status=DRAFT` 语义冲突，若以 `UI_READY` 作准入会把模板占位断言当成可观察预期 | 引入「需要 UI 探索」中间态，评审工作流区分占位与可观察断言 | QA |';
const S15_17_MAIN = [
  '| 15 | 🔴 | 证据契约 | `types.ts:28-36`、`extract.ts:62-77`、`rules.json` | `02` §11 证据 7 要素中 `line_end`/`page`/`paragraph_index`/`doc_version`/`sha256` 全部 0/30,641，`file_path` 全为相对路径；`04` §5 要求的 `EVIDENCE_MISSING` 标记全库 0 次（D-S5） | 补齐证据结构，无法定位者强制标 EVIDENCE_MISSING 并接入校验 | 产品评审员 |',
  '| 16 | 🔴 | 规则分类 | `extract.ts:590`、`rules.json`、`fields.json` | `02` §5 的 source_type 六分类未落实：`PLATFORM_SERVICE`/`UI_OBSERVED`/`USER_CONFIRMED` 均为 0；4,731 条含「调用接口 / bm.*」的平台服务表述中 **3,856 条被标 `PRD_EXPLICIT`**，相关 OQ 0 条（D-S4） | 按 §5 重新界定六分类并回填；平台服务类不得生成可执行断言 | 产品评审员 |',
  '| 17 | 🔴 | 流程解析 | `src/prd/extract.ts`（流程表解析）、`workflows.json`(143) | 流程表「操作步骤」列与原表「节点名称」列错配，8 列丢 5 列；68/143 条 step 为纯数字，无法还原起点/终点/单据节点/节点间关系，`02` §9 与 `03` §7 未落实（E-S4） | 按原表列头重解析流程表，回填业务对象并补单测 | 产品评审员 |'
].join('\n');

const S14_GS = '| 14 | 🔴 | 场景契约 | `scenarios.json`（2,600 `UI_READY`） | 63.9% 标 `UI_READY` 但正文全为固定模板占位，`NEEDS_UI_EXPLORATION` 使用数 0，与 DRAFT 语义冲突 | 引入 UI 探索中间态 | QA |';
const S15_17_GS = [
  '| 15 | 🔴 | 证据契约 | `types.ts:28-36`、`rules.json` | 证据 7 要素中 5 项全库 0/30,641，`EVIDENCE_MISSING` 0 次 | 补齐并接入校验 | 产品评审员 |',
  '| 16 | 🔴 | 规则分类 | `extract.ts:590`、`rules.json` | 六分类缺 3 类，3,856 条平台服务表述误标 EXPLICIT | 按 §5 重界定并回填 | 产品评审员 |',
  '| 17 | 🔴 | 流程解析 | `extract.ts`(流程表)、`workflows.json` | 列错配致 8 列丢 5 列，68/143 条 step 为纯数字 | 按原表列头重解析 | 产品评审员 |'
].join('\n');

console.log('=== 07-open-questions.md ===');
patch('artifacts/acceptance/07-open-questions.md', [
  ['61 条', '62 条'],
  ['391 条', '392 条'],
  ['产品评审员 26', '产品评审员 27'],
  ['15 + 26 + 20', '15 + 27 + 20'],
  ['### 4.2 产品评审员新增 26 条（`OQ-NEW-01`~`26`）', '### 4.2 产品评审员新增 27 条（`OQ-NEW-01`~`27`）'],
  [GAP_NOTE, '\n' + ROW27 + '\n\n' + NEW_NOTE],
  ['16 条正式新增', '27 条正式新增']
], [
  [/\n\n(?=\| OQ-NEW-17 \|)/, '\n']  // 让 17~27 行与 4.2 表格连续
]);

console.log('=== PHASE1-ACCEPTANCE-REPORT.md ===');
patch('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', [
  ['61 条', '62 条'],
  ['391 条', '392 条'],
  ['调查员 15 / 产品评审员 26 / QA 20', '调查员 15 / 产品评审员 27 / QA 20'],
  ['14 项严重缺陷', '17 项严重缺陷'],
  ['🔴 严重 14（去重合并）', '🔴 严重 17（去重合并）'],
  ['### 4.1 严重缺陷（14 项）', '### 4.1 严重缺陷（17 项）'],
  ['### 4.1 严重缺陷（13 项）', '### 4.1 严重缺陷（17 项）'],
  [S14_MAIN, S14_MAIN + '\n' + S15_17_MAIN],
  ['另 `04:466` 引用 OQ-NEW-27 但 `05` 报告无该条目全文，已在 `07` 如实登记为「引用存在、全文缺失」待补，未臆造内容。',
   '`04:466` 引用的 OQ-NEW-27 已由原作者补齐全文并纳入 `07` 登记（流程表列错配、68/143 条 step 为纯数字，构成第 17 项严重缺陷）。'],
  ['- **关键建议**：证据片段改原文逐字 + 精确行号 + 内嵌版本并重定义 `PRD_EXPLICIT`；',
   '- **补充核验新增 3 条严重缺陷**：D-S5（证据 7 要素中 5 项全库为 0、`EVIDENCE_MISSING` 0 次）、D-S4（source_type 六分类缺 3 类，3,856 条平台服务表述误标 EXPLICIT）、E-S4（流程表列错配，8 列丢 5 列、68/143 条 step 为纯数字）。\n- **关键建议**：证据片段改原文逐字 + 精确行号 + 内嵌版本并重定义 `PRD_EXPLICIT`；']
]);

console.log('=== gstack 收口报告 ===');
patch('deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md', [
  ['392 条（既有 330 + 本次新增 62）', '392 条（既有 330 + 本次新增 62）'],
  ['391 条（既有 330 + 本次新增 61）', '392 条（既有 330 + 本次新增 62）'],
  ['14 项严重缺陷', '17 项严重缺陷'],
  ['🔴 14 / 🟠 40+ / 🟢 9', '🔴 17 / 🟠 40+ / 🟢 9'],
  [S14_GS, S14_GS + '\n' + S15_17_GS],
  ['共 12 项须关闭或书面豁免；#3、#12 须有明确契约决策', '共 14 项须关闭或书面豁免；#3、#12 须有明确契约决策'],
  ['补充核验另发现 3,856 条平台服务表述被误标 `PRD_EXPLICIT`、36 张 PNG 流程图从未进入扫描范围、证据 7 要素中 5 项全库为 0（OQ-NEW-17~24）。',
   '补充核验另发现 3 条严重缺陷（D-S4 六分类缺 3 类 / D-S5 证据 7 要素缺 5 项 / E-S4 流程表列错配 8 列丢 5 列）、3,856 条平台服务表述误标 EXPLICIT、36 张 PNG 流程图从未进入扫描范围（OQ-NEW-17~27）。']
]);

console.log('=== memory 三件套 ===');
for (const rel of ['.workbuddy/memory/2026-11-07.md', '.workbuddy/memory/MEMORY.md', '.workbuddy/memory/map-navigation-phase1-acceptance.md']) {
  patch(rel, [
    ['391 条', '392 条'],
    ['14 项严重缺陷', '17 项严重缺陷'],
    ['新增 61', '新增 62'],
    ['61：调查员', '62：调查员'],
    ['新增 61）', '新增 62）'],
    ['+ 新增 61', '+ 新增 62']
  ]);
}

console.log('\n=== 定稿核对 ===');
for (const rel of ['artifacts/acceptance/07-open-questions.md', 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md']) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stale = ['61 条', '391 条', '产品评审员 26', '14 项严重缺陷', '严重 14', '🔴 14 /', '编号断档登记'];
  console.log(rel + ' -> 旧值残留: ' + (stale.filter(s => t.includes(s)).join(', ') || '无'));
}
const o7 = fs.readFileSync(path.join(ROOT, 'artifacts/acceptance/07-open-questions.md'), 'utf8');
console.log('07 OQ-NEW-01~27 全在:', Array.from({length:27},(_,i)=>'OQ-NEW-'+String(i+1).padStart(2,'0')).every(x => o7.includes(x)));
const main = fs.readFileSync(path.join(ROOT, 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md'), 'utf8');
const gs = fs.readFileSync(path.join(ROOT, 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md'), 'utf8');
console.log('总报告 #1~#17 严重行:', Array.from({length:17},(_,i)=>'| '+(i+1)+' | 🔴 |').every(x => main.includes(x)));
console.log('gstack #1~#17 严重行:', Array.from({length:17},(_,i)=>'| '+(i+1)+' | 🔴 |').every(x => gs.includes(x)));
