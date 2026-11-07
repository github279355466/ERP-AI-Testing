// 最终同步：产品评审员补充核验新增 OQ-NEW-17~26（10 条），定稿 61 条新增 / 391 条合计
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing';

function patch(rel, pairs) {
  const file = path.join(ROOT, rel);
  let t = fs.readFileSync(file, 'utf8');
  let ok = 0, miss = 0;
  for (const [a, b] of pairs) {
    if (t.includes(a)) { t = t.split(a).join(b); ok++; }
    else { console.log('  MISS [' + rel + '] :: ' + a.slice(0, 95)); miss++; }
  }
  t = t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(file, Buffer.from(t, 'utf8'));
  console.log(`${rel}: applied=${ok} missed=${miss}`);
}

const NEW_ROWS = [
  '| OQ-NEW-17 | MEDIUM | `_prd_workspace/assets/` 下 36 张 PNG（业务流程图 18 + 交互原型 18）被 127 份 PRD md 引用，却不在任一扫描根内，从未进入登记表/问题清单；`reservedExtensions` 含 `.png` 但无代码路径。`02` §9 要求的流程图节点主要画在 PNG 里 | `02` §6.5.4；`采购退货出库单PRD.v1.24.md:69-71` |',
  '| OQ-NEW-18 | MEDIUM | `02` §13 六级解析质量分级未落地：`EVIDENCE_MISSING`/`UNSUPPORTED_FORMAT` 全库 0 次，`confidence` 枚举只有 5 级、实际只用 3 级 | `02` §6.5.4；`types.ts:4`；`rule.schema.json:43-50` |',
  '| OQ-NEW-19 | MEDIUM | 8,454/8,454 字段的 `data_type`/`length`/`precision` 全 null、`related_master_data` 7,107 为 null；30,641 条规则 `source_refs` 无 `line_end`。边界值/精度/长度类用例无法从知识库生成 | `02` §6.5.4；`extract.ts:538-540` |',
  '| OQ-NEW-20 | MEDIUM | 仓库根无 `schemas/`，开发包 2 份 Schema 未接入运行时；是否接入 `prd:validate` 作为产物门禁 | `02` §6.5.4；`KNOWN_LIMITATIONS.md:38` |',
  '| OQ-NEW-21 | MEDIUM | 旧 `PRD-MAPPING.md`/`athena-prd-map.json`（2026-11-06 15:25）过期，何时按哪套口径重生成；**根因是旧索引未重生成，不是 Phase 1 最新版判定算错** | `04` §9.5.6；`probe/acceptance/a7_diff_version.py` |',
  '| OQ-NEW-22 | LOW | `link.ts:44-75` 未排除 `_diff` 体检/漂移文档，`VERSION_CONFLICTS.md` 262 条明细中 69 条来自 `_diff`，版本集合被放大（不影响候选最新版本号） | `04` §9.5.6 |',
  '| OQ-NEW-23 | **HIGH** | `02` §5 的 source_type 六分类未落实：`PLATFORM_SERVICE`/`UI_OBSERVED`/`USER_CONFIRMED` 全 0；4,731 条含「调用接口 / bm.*」的平台服务表述中 **3,856 条被标 `PRD_EXPLICIT`**，相关 OQ 0 条 | `04` §9.5.6；反例 `RULE-830FBF25AFA6`、`RULE-AAAB46534F54` |',
  '| OQ-NEW-24 | **HIGH** | `02` §11 证据 7 要素缺失：`line_end`/`page`/`paragraph_index`/`doc_version`/`sha256` 全部 0/30,641，`file_path` 全为相对路径；`EVIDENCE_MISSING` 0 次 | `04` §9.5.6；`types.ts:28-36`、`extract.ts:62-77` |',
  '| OQ-NEW-25 | MEDIUM | 330 条 OQ 大量按历史版本重复：机械去重后约 304 条、按业务语义估计约 53 条需人工裁决；约 84% 为副本/抽取器伪冲突，会淹没 20 条 HIGH 版本冲突 | `04` §9.5.6；`acc_spec_followup.out.txt` §F |',
  '| OQ-NEW-26 | LOW | `OPEN_QUESTIONS.md` 仅渲染 154/330 行、漏 176 条且未列被省略 ID；**属有告知的展示截断，不认定为静默忽略、不升级为严重缺陷** | `04` §9.5.6；`reports.ts:249` |'
].join('\n');

const GAP_NOTE = '> **编号断档登记（如实登记，不臆造）**：`04-rule-traceability-report.md:466` 引用了「OQ-NEW-27（见 05 报告 10.5.6）」，但 `05-business-relationship-report.md` 无 10.5.6 章节、全仓亦无该条目全文。本次按「引用存在、全文缺失」登记为待补，**不计入 26 条正式新增**，建议由原作者补齐或撤销该引用。\n';

console.log('=== 07-open-questions.md ===');
patch('artifacts/acceptance/07-open-questions.md', [
  ['51 条', '61 条'],
  ['381 条', '391 条'],
  ['产品评审员 16', '产品评审员 26'],
  ['15 + 16 + 20', '15 + 26 + 20'],
  ['### 4.2 产品评审员新增 16 条（`OQ-NEW-01`~`16`）',
   '### 4.2 产品评审员新增 26 条（`OQ-NEW-01`~`26`）'],
  ['### 4.3 QA 与发布负责人新增 20 条',
   NEW_ROWS + '\n\n' + GAP_NOTE + '\n### 4.3 QA 与发布负责人新增 20 条'],
  ['330 条中「独立待确认问题」真实数量远低于 330，Phase 3 评审工作量被放大',
   '330 条机械去重后约 304 条、按业务语义估计仅约 53 条需人工裁决（OQ-NEW-25），约 84% 为历史版本副本或抽取器伪冲突，会淹没 20 条 HIGH 版本冲突'],
  ['人工评审若只读 MD 会漏掉约 160 条', '人工评审若只读 MD 会漏掉 176 条（MD 仅渲染 154/330 行，OQ-NEW-26）']
]);

console.log('=== PHASE1-ACCEPTANCE-REPORT.md ===');
patch('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', [
  ['51 条', '61 条'],
  ['381 条', '391 条'],
  ['调查员 15 / 产品评审员 16 / QA 20', '调查员 15 / 产品评审员 26 / QA 20'],
  ['| 5 | 🔴 | 规则分类 | `extract.ts:590,618-690,821-869` | `PRD_EXPLICIT` 判定与原文无关；抽样严格误标 32.1%、宽 50%；6 条「示例/回参残片/占位符」被升为 CONFIRMED |',
   '| 5 | 🔴 | 规则分类 | `extract.ts:590,618-690,821-869` | `PRD_EXPLICIT` 判定与原文无关；抽样严格误标 32.1%、宽 50%；6 条「示例/回参残片/占位符」被升为 CONFIRMED；source_type 六分类中 3 类全 0，4,731 条平台服务表述里 3,856 条误标 EXPLICIT（OQ-NEW-23） |'],
  ['| 7 | 🔴 | 业务关系 | `采购入库单…V1.19.md:1958-1966`、`采购退货单…:2413-2415` | 「入库取到货」有原文证据却 0 建模 0 登记；数量口径/状态条件/前置/53 段回写未结构化（规则 `conditions` 全空） |',
   '| 7 | 🔴 | 业务关系 | `采购入库单…V1.19.md:1958-1966`、`采购退货单…:2413-2415` | 「入库取到货」有原文证据却 0 建模 0 登记；数量口径/状态条件/前置/53 段回写未结构化（规则 `conditions` 全空）；另 36 张 PNG 流程图在两个扫描根之外从未被登记（OQ-NEW-17） |'],
  ['- 展示层缺陷：`reports/OPEN_QUESTIONS.md` 每分区仅显示前 100 条（第 150 行有显式告知并指向 JSON），人工评审易漏约 160 条，属一般缺陷而非静默忽略。',
   '- 展示层缺陷：`reports/OPEN_QUESTIONS.md` 每分区仅显示前 100 条（第 150 行有显式告知并指向 JSON），仅渲染 154/330 行、人工评审易漏 176 条，属一般缺陷而非静默忽略（OQ-NEW-26）。另 `04:466` 引用 OQ-NEW-27 但 `05` 报告无该条目全文，已在 `07` 如实登记为待补。']
]);

console.log('=== gstack 收口报告 ===');
patch('deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md', [
  ['391 条（既有 330 + 本次新增 61）', '391 条（既有 330 + 本次新增 61）'],
  ['381 条（既有 330 + 本次新增 51）', '391 条（既有 330 + 本次新增 61）'],
  ['另有 F-S2（63.9% 场景标 `UI_READY` 但正文全为模板占位）与 F-S3（前置条件 100% 为通用模板，违反 `02` §10）。',
   '另有 F-S2（63.9% 场景标 `UI_READY` 但正文全为模板占位）与 F-S3（前置条件 100% 为通用模板，违反 `02` §10）。补充核验另发现 3,856 条平台服务表述被误标 `PRD_EXPLICIT`、36 张 PNG 流程图从未进入扫描范围、证据 7 要素中 5 项全库为 0（OQ-NEW-17~24）。']
]);

console.log('\n=== 最终核对 ===');
for (const rel of ['artifacts/acceptance/07-open-questions.md', 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md']) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stale = ['45 条', '49 条', '51 条', '375 条', '379 条', '381 条', '产品评审员 16', '15 + 16 + 20'];
  const hits = stale.filter(s => t.includes(s));
  console.log(rel + ' -> 旧数字残留: ' + (hits.length ? hits.join(', ') : '无') + ' | 61=' + t.includes('61 条') + ' 391=' + t.includes('391 条'));
}
const o7 = fs.readFileSync(path.join(ROOT, 'artifacts/acceptance/07-open-questions.md'), 'utf8');
console.log('07 含 OQ-NEW-17~26:', Array.from({length:10},(_,i)=>'OQ-NEW-'+(17+i)).every(x => o7.includes(x)));
