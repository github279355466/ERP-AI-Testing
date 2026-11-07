// 同步汇编报告：qa-lead 补充了 4 条 OQ 与 1 条独立严重缺陷(F-S3)，并补入调查员最终哈希复核结论
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing';

function patch(rel, pairs) {
  const file = path.join(ROOT, rel);
  let t = fs.readFileSync(file, 'utf8');
  let ok = 0, miss = 0;
  for (const [a, b] of pairs) {
    if (t.includes(a)) { t = t.split(a).join(b); ok++; }
    else { console.log('  MISS [' + rel + '] :: ' + a.slice(0, 90)); miss++; }
  }
  t = t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(file, Buffer.from(t, 'utf8'));
  console.log(`${rel}: applied=${ok} missed=${miss}`);
}

const G08 = '| OQ-ACC-G08 | `ids.ts` / `reports.ts` 无直接单测、`case_ids_by_rule` 映射未落盘，Phase 2 是否作为放行前补齐项？ | QA / 测试架构 |';
const G09_12 = [
  '| OQ-ACC-G09 | 04 文档第 3 行指向的 `schemas/` 在仓库根不存在、11 类对象无 Schema，是否补齐到仓库根并按 04 §7 在报告中记录 `schema_version`？2 份现有 Schema 为 `additionalProperties:true` 的宽松契约，是否收紧？ | 平台 / 数据 |',
  '| OQ-ACC-G10 | 自报单测数量 63（完成报告 :58）与 62（实施评估 :69）不一致，以哪份为基线？静态交付报告如何随代码同步？ | 主理人 / QA |',
  '| OQ-ACC-G11 | `KNOWN_LIMITATIONS.md:39-40` 自认「扫描状态累积历史键 / 旧缓存不会自动清理」，但实测 540 键全一致、0 孤儿缓存；是自认过时还是指未来目录调整场景？`SOURCE_MISSING` 何时落盘？ | 平台 |',
  '| OQ-ACC-G12 | 02 §15 第 5 条「结构化模型通过 Schema 校验」与 05 路线图 Phase 1 退出条件「知识模型可校验」是否视为同一门禁？若视为硬门禁，Phase 1 应判不通过 | 主理人 / 产品 |'
].join('\n');

const S12_MAIN = '| 12 | 🔴 | 规范符合性 | `src/prd/parsers.ts`、`extract.ts:1072-1099`、`config.ts:12,72` | F3 要求的 Parser Adapter 扩展点未实现；TXT 无专用解析器；`reservedExtensions` 为死配置；不支持格式原因写在 `PARSE_ERRORS.md` 而非扫描报告 | 实现 Adapter 接口与 TXT 解析器；原因写回扫描报告 | 产品评审员 / 调查员 |';
const S13_MAIN = '| 13 | 🔴 | 场景准入 | `scenarios.json`（2,600 个 `UI_READY`） | 2,600 个 `UI_READY` 场景 100% 使用通用模板前置条件，其中 363 个还引用 `PRD_DERIVED` 规则，违反 `02` §10「前置数据不明或断言不可观察时不得标记为可直接执行」；`UI_READY` 与 `status=DRAFT` 语义冲突 | 改为「规则置信度 + 前置数据 + 断言可观察性」联合判定 | QA |';

const S12_GS = '| 12 | 🔴 | 规范符合性 | `parsers.ts`、`extract.ts:1072-1099` | F3 Parser Adapter 未实现、TXT 无解析器、`reservedExtensions` 死配置 | 实现 Adapter 与 TXT 解析 | 产品评审员 / 调查员 |';
const S13_GS = '| 13 | 🔴 | 场景准入 | `scenarios.json`（2,600 `UI_READY`） | 2,600 个 `UI_READY` 100% 通用模板前置条件、363 个引用 `PRD_DERIVED`，违反 `02` §10 第 192 行 | 改联合判定，明确与 DRAFT 的边界 | QA |';

const HASH_FINDING = `- **最终独立复核（调查员，17:38–17:45）**：以 \`artifacts/acceptance/_snapshots/manifest-before.json\`（325 份逐字节快照副本 + 清单 \`captured_at=2026-11-07T09:12:58.106Z\`、\`total_bytes=127,370,295\`）与 git HEAD \`7c13b445\` 为「前」基线，逐文件 SHA-256 + 字节数比对：\`artifacts/knowledge\` 13/13、\`artifacts/source-index\` 302/302、\`reports\` 10/10（合计 **325/325 一致**）；\`knowledge/*.json\` 6/6、\`config/*.json\` 3/3、\`src/**/*.ts\` 41/41、根文件 3/3（合计 **53/53 一致**）；外部 PRD 源目录 **540/540 哈希稳定**。\`added=0\`、\`missing=0\`、\`tracked 修改数=0\`、\`git diff --name-only HEAD\` 为空，27 个 \`??\` 项全部为本次新增报告与诊断产物。**结论：本次独立验收未污染被验收基线，0 个未还原差异。** 唯一残留是 gitignored \`dist/\` 的 mtime 被 \`npm run build\` 刷新，其内容经隔离编译比对 41/41 逐字节一致。证据：\`probe/acceptance/h1_final_hash_audit.py(.json)\`、\`h2_dist_and_breakdown.py(.json)\`、\`a5_readonly.py\`。`;

const HASH_FINDING_GS = `- **最终独立复核**：325/325 被验收产出、53/53 追踪文件、540/540 外部 PRD 文件全部 SHA-256 + 字节数一致；\`tracked 修改数=0\`、0 个未还原差异。证据 \`probe/acceptance/h1_final_hash_audit.json\`。**验收过程未污染被验收基线。**`;

console.log('=== 07-open-questions.md ===');
patch('artifacts/acceptance/07-open-questions.md', [
  ['| 本次验收新增 | **45 条**（调查员 15 + 产品评审员 16 + QA 14），合计 **375 条**待确认 |',
   '| 本次验收新增 | **49 条**（调查员 15 + 产品评审员 16 + QA 18），合计 **379 条**待确认 |'],
  ['### 4.3 QA 与发布负责人新增 14 条（`OQ-ACC-F01`~`F06`、`G01`~`G08`）',
   '### 4.3 QA 与发布负责人新增 18 条（`OQ-ACC-F01`~`F06`、`G01`~`G12`）'],
  [G08, G08 + '\n' + G09_12],
  ['- 累计：15 + 16 + 14 = **45 条**；与既有 330 条合计 **375 条**。',
   '- 累计：15 + 16 + 18 = **49 条**；与既有 330 条合计 **379 条**。'],
  ['- **待确认问题合计 375 条**', '- **待确认问题合计 379 条**'],
  ['（调查员 15 / 产品评审员 16 / QA 14）', '（调查员 15 / 产品评审员 16 / QA 18）'],
  ['45 条', '49 条'],
  ['375 条', '379 条']
]);

console.log('=== PHASE1-ACCEPTANCE-REPORT.md ===');
patch('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', [
  ['12 项严重缺陷', '13 项严重缺陷'],
  ['🔴 严重 12（去重合并）', '🔴 严重 13（去重合并）'],
  ['375 条', '379 条'],
  ['45 条', '49 条'],
  ['### 4.1 严重缺陷（12 项）', '### 4.1 严重缺陷（13 项）'],
  ['| G | 6 | `prd:report` 无条件返回 0', '| G | 8 | `prd:report` 无条件返回 0'],
  [S12_MAIN, S12_MAIN + '\n' + S13_MAIN],
  ['`artifacts/acceptance/_snapshots/before/manifest-before.json`', '`artifacts/acceptance/_snapshots/manifest-before.json`'],
  ['- **产出版本说明**：', HASH_FINDING + '\n- **产出版本说明**：'],
  ['其中 363 个误标 `UI_READY`** —— 直接违反 F7 硬性要求，且 `prd:validate` 的 0 error 是假阴性。8 类覆盖中「正常业务场景」「异常输入」为 0，必填/字段校验占 78.7%，分布失衡。',
   '其中 363 个误标 `UI_READY`** —— 直接违反 F7 硬性要求，且 `prd:validate` 的 0 error 是假阴性。另发现第二条独立违反（F-S3）：2,600 个 `UI_READY` 场景 100% 使用通用模板前置条件，违反 `02` §10 第 192 行。8 类覆盖中「正常业务场景」「异常输入」为 0，必填/字段校验占 78.7%，分布失衡。'],
  ['8 类覆盖中正常业务 / 异常输入为 0，必填校验占 78.7%。另发现', '8 类覆盖中正常业务 / 异常输入为 0，必填校验占 78.7%；另有 F-S3（2,600 个 `UI_READY` 前置条件全为通用模板）。另发现'],
  ['QA 14', 'QA 18'],
  ['F01~F06 (6) + G01~G08 (8) = 14 条', 'F01~F06 (6) + G01~G12 (12) = 18 条']
]);

console.log('=== gstack 收口报告 ===');
patch('deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md', [
  ['12 项严重缺陷', '13 项严重缺陷'],
  ['🔴 12 / 🟠 40+ / 🟢 9', '🔴 13 / 🟠 40+ / 🟢 9'],
  ['375 条（既有 330 + 本次新增 45）', '379 条（既有 330 + 本次新增 49）'],
  [S12_GS, S12_GS + '\n' + S13_GS],
  ['`artifacts/acceptance/_snapshots/before/manifest-before.json`', '`artifacts/acceptance/_snapshots/manifest-before.json`'],
  ['- 取证期间 `artifacts/knowledge/*`', HASH_FINDING_GS + '\n- 取证期间 `artifacts/knowledge/*`'],
  ['410 条漏标（87.6%）、363 条误标 `UI_READY`**，直接违反 F7 且 `prd:validate` 未检出。',
   '410 条漏标（87.6%）、363 条误标 `UI_READY`**，直接违反 F7 且 `prd:validate` 未检出；另有 F-S3：2,600 个 `UI_READY` 前置条件 100% 为通用模板，违反 `02` §10。'],
  ['共 10 项须关闭或书面豁免；#3、#12 须有明确契约决策', '共 11 项须关闭或书面豁免；#3、#12 须有明确契约决策']
]);

console.log('\n=== 复核残留 ===');
for (const rel of ['artifacts/acceptance/07-open-questions.md', 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md']) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stale = ['45 条', '375 条', '12 项严重缺陷', '严重 12', '🔴 12 /', 'QA 14', 'G01`~`G08'];
  const hits = stale.filter(s => t.includes(s));
  console.log(rel + ' -> 残留旧数字: ' + (hits.length ? hits.join(', ') : '无'));
}
