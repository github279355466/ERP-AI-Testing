// 第二阶段同步：qa-lead 最终版又补 2 条 F 侧 OQ 与 1 条独立严重缺陷(F-S2)，定稿为 51/381/14
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

const F06 = '| OQ-ACC-F06 | AGENTS.md §5「证据」在场景草案中应指 PRD 溯源还是运行时截图/DOM？现有 `source_refs` 是否满足？ | 主理人 / QA |';
const F07_08 = [
  '| OQ-ACC-F07 | 02 §10 十三项契约缺「测试目标」与场景级「预期结果」，场景类型 11 类缺 3 类（正向流程/异常恢复/回归）并自造 7 类，Phase 2 以哪份口径为数据契约？ | 测试架构 / 产品 |',
  '| OQ-ACC-F08 | 02 §10「不得标记为可直接执行」的三个条件（规则确认、前置数据明确、断言可观察）由谁判定、落到哪个字段？当前 `UI_READY` 由模板硬编码 | 测试架构 / QA |'
].join('\n');

const S13_MAIN = '| 13 | 🔴 | 场景准入 | `scenarios.json`（2,600 个 `UI_READY`） | 2,600 个 `UI_READY` 场景 100% 使用通用模板前置条件，其中 363 个还引用 `PRD_DERIVED` 规则，违反 `02` §10「前置数据不明或断言不可观察时不得标记为可直接执行」；`UI_READY` 与 `status=DRAFT` 语义冲突 | 改为「规则置信度 + 前置数据 + 断言可观察性」联合判定 | QA |';
const S14_MAIN = '| 14 | 🔴 | 场景契约 | `scenarios.json`（2,600 `UI_READY`）、`scenarios.ts:19-121` | 2,600 个场景（63.9%）标 `UI_READY` 但正文由 15 个固定模板拼装（仅 48 种前置 / 7 种断言类型），`NEEDS_UI_EXPLORATION` 使用数为 0；与 `status=DRAFT` 语义冲突，若以 `UI_READY` 作准入会把模板占位断言当成可观察预期 | 引入「需要 UI 探索」中间态，评审工作流区分占位与可观察断言 | QA |';

const S13_GS = '| 13 | 🔴 | 场景准入 | `scenarios.json`（2,600 `UI_READY`） | 2,600 个 `UI_READY` 100% 通用模板前置条件、363 个引用 `PRD_DERIVED`，违反 `02` §10 第 192 行 | 改联合判定，明确与 DRAFT 的边界 | QA |';
const S14_GS = '| 14 | 🔴 | 场景契约 | `scenarios.json`（2,600 `UI_READY`） | 63.9% 标 `UI_READY` 但正文全为固定模板占位，`NEEDS_UI_EXPLORATION` 使用数 0，与 DRAFT 语义冲突 | 引入 UI 探索中间态 | QA |';

console.log('=== 07-open-questions.md ===');
patch('artifacts/acceptance/07-open-questions.md', [
  ['### 4.3 QA 与发布负责人新增 18 条（`OQ-ACC-F01`~`F06`、`G01`~`G12`）',
   '### 4.3 QA 与发布负责人新增 20 条（`OQ-ACC-F01`~`F08`、`G01`~`G12`）'],
  [F06, F06 + '\n' + F07_08],
  ['49 条', '51 条'],
  ['379 条', '381 条'],
  ['QA 18', 'QA 20'],
  ['15 + 16 + 18', '15 + 16 + 20']
]);

console.log('=== PHASE1-ACCEPTANCE-REPORT.md ===');
patch('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', [
  ['13 项严重缺陷', '14 项严重缺陷'],
  ['🔴 严重 13（去重合并）', '🔴 严重 14（去重合并）'],
  ['### 4.1 严重缺陷（13 项）', '### 4.1 严重缺陷（14 项）'],
  ['379 条', '381 条'],
  ['49 条', '51 条'],
  ['QA 18', 'QA 20'],
  [S13_MAIN, S13_MAIN + '\n' + S14_MAIN],
  ['另有 F-S3（2,600 个 `UI_READY` 前置条件全为通用模板）。另发现',
   '另有 F-S2（2,600 个 `UI_READY` 正文全为固定模板占位、`NEEDS_UI_EXPLORATION` 使用数 0）与 F-S3（前置条件 100% 为通用模板）。另发现'],
  ['另有 F-S3：2,600 个 `UI_READY` 前置条件 100% 为通用模板，违反 `02` §10。',
   '另有 F-S2（63.9% 场景 `UI_READY` 但正文全为模板占位）与 F-S3（前置条件 100% 为通用模板，违反 `02` §10）。']
]);

console.log('=== gstack 收口报告 ===');
patch('deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md', [
  ['13 项严重缺陷', '14 项严重缺陷'],
  ['🔴 13 / 🟠 40+ / 🟢 9', '🔴 14 / 🟠 40+ / 🟢 9'],
  ['379 条（既有 330 + 本次新增 49）', '381 条（既有 330 + 本次新增 51）'],
  [S13_GS, S13_GS + '\n' + S14_GS],
  ['另有 F-S3：2,600 个 `UI_READY` 前置条件 100% 为通用模板，违反 `02` §10。',
   '另有 F-S2（63.9% 场景标 `UI_READY` 但正文全为模板占位）与 F-S3（前置条件 100% 为通用模板，违反 `02` §10）。'],
  ['共 11 项须关闭或书面豁免；#3、#12 须有明确契约决策', '共 12 项须关闭或书面豁免；#3、#12 须有明确契约决策'],
  ['关闭 13 项严重缺陷', '关闭 14 项严重缺陷']
]);

console.log('\n=== 最终数字核对 ===');
for (const rel of ['artifacts/acceptance/07-open-questions.md', 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md']) {
  const t = fs.readFileSync(path.join(ROOT, rel), 'utf8');
  const stale = ['45 条', '49 条', '375 条', '379 条', '12 项严重', '13 项严重', '严重 12', '严重 13', '🔴 12 /', '🔴 13 /', 'QA 14', 'QA 18'];
  const hits = stale.filter(s => t.includes(s));
  console.log(rel + ' -> 残留旧数字: ' + (hits.length ? hits.join(', ') : '无'));
  const final = ['51 条', '381 条', '14 项严重'].filter(s => t.includes(s));
  console.log('            -> 含终值: ' + final.join(', '));
}
