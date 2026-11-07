// 收尾补丁：补入 07 的 F07/F08 两行、总报告 QA 段的 F-S2 描述，并做最终一致性核对
const fs = require('fs');
const path = require('path');
const ROOT = 'D:/AIProject/ERP-AI-Testing';

function patch(rel, pairs) {
  const file = path.join(ROOT, rel);
  let t = fs.readFileSync(file, 'utf8');
  let ok = 0, miss = 0;
  for (const [a, b] of pairs) {
    if (t.includes(a)) { t = t.split(a).join(b); ok++; }
    else { console.log('  MISS [' + rel + '] :: ' + a.slice(0, 100)); miss++; }
  }
  t = t.replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  fs.writeFileSync(file, Buffer.from(t, 'utf8'));
  console.log(`${rel}: applied=${ok} missed=${miss}`);
}

const F06 = '| OQ-ACC-F06 | `AGENTS.md` §5「证据」在场景草案中应指 PRD 溯源还是运行时截图/DOM？现有 `source_refs` 是否满足？ | 主理人 / QA |';
const F07_08 = [
  '| OQ-ACC-F07 | 02 §10 十三项契约缺「测试目标」与场景级「预期结果」，场景类型 11 类缺 3 类（正向流程/异常恢复/回归）并自造 7 类，Phase 2 以哪份口径为数据契约？ | 测试架构 / 产品 |',
  '| OQ-ACC-F08 | 02 §10「不得标记为可直接执行」的三个条件（规则确认、前置数据明确、断言可观察）由谁判定、落到哪个字段？当前 `UI_READY` 由模板硬编码 | 测试架构 / QA |'
].join('\n');

patch('artifacts/acceptance/07-open-questions.md', [[F06, F06 + '\n' + F07_08]]);

patch('artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md', [
  ['另发现第二条独立违反（F-S3）：2,600 个 `UI_READY` 场景 100% 使用通用模板前置条件，违反 `02` §10 第 192 行。',
   '另发现两条相互独立的违反：**F-S2**（2,600 个场景标 `UI_READY` 但正文全为固定模板占位、`NEEDS_UI_EXPLORATION` 使用数 0，与 `DRAFT` 语义冲突）与 **F-S3**（这 2,600 个 `UI_READY` 的前置条件 100% 为通用模板、363 个还引用推导规则，违反 `02` §10 第 192 行）。']
]);

console.log('\n=== 最终一致性核对 ===');
const o7 = fs.readFileSync(path.join(ROOT, 'artifacts/acceptance/07-open-questions.md'), 'utf8');
const main = fs.readFileSync(path.join(ROOT, 'artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md'), 'utf8');
const gs = fs.readFileSync(path.join(ROOT, 'deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md'), 'utf8');
console.log('07  F01~F08 全在:', ['F01','F02','F03','F04','F05','F06','F07','F08'].every(x => o7.includes('OQ-ACC-' + x)));
console.log('07  G01~G12 全在:', Array.from({length:12},(_,i)=>'G'+String(i+1).padStart(2,'0')).every(x => o7.includes('OQ-ACC-' + x)));
console.log('总报告 #1~#14 严重行:', Array.from({length:14},(_,i)=>'| '+(i+1)+' | 🔴 |').every(x => main.includes(x)));
console.log('gstack #1~#14 严重行:', Array.from({length:14},(_,i)=>'| '+(i+1)+' | 🔴 |').every(x => gs.includes(x)));
for (const [name, t] of [['07', o7], ['总报告', main], ['gstack', gs]]) {
  console.log(name + ': 51=' + t.includes('51 条') + ' 381=' + t.includes('381 条') + ' 14项=' + t.includes('14 项严重'));
}
