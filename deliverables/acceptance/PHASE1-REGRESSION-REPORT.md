# Phase 1 整改复验报告（开发方实跑）

**日期**：2026-11-07
**环境**：Windows / Node v24.19.0 / npm 11.9.0
**知识库批次**：`generated_at=2026-11-07T10:59:25.671Z`，`mode=FULL`
**性质**：整改后的自检复验，供独立复验方复核。**不代替独立验收结论。**

---

## 一、结论

| 项目 | 结果 |
| --- | --- |
| 严重缺陷 | 16 / 17 关闭；TXT 真实样本待确认（R1） |
| P0 阻塞项 | 整改动作全部落地，无未处置项 |
| 独立复算 | 14 / 14 通过 |
| 校验 | PASS（0 error / 33 warning） |
| 单测 | 76 passed / 0 failed / 0 skipped |
| 只读 | 27 个交付文件 SHA-256 运行前后一致 |
| Phase 1 门禁 | **申请进入独立复验**；复验通过前维持 No-Go |

---

## 二、实跑命令与退出码

| 命令 | 退出码 | 结果 |
| --- | --- | --- |
| `npm run build` | 0 | 编译无错误 |
| `npm run typecheck` | 0 | `tsc --noEmit` 无错误 |
| `npm run test:unit` | 0 | **76 passed** |
| `npm run prd:validate` | 0 | PASS（0 error / 33 warning） |
| `node probe/phase1-remediation-verify.mjs` | 0 | 14/14 检查通过 |
| `node probe/phase1-readonly-check.mjs` | 0 | `readonly=true`，27 files |

**未执行**（不冒充通过）：`npm run test:smoke`、任何 CDP/Playwright 业务操作、任何 ERP OpenAPI/MCP 调用。Phase 1 约束未变。

---

## 三、独立复算明细

脚本 `probe/phase1-remediation-verify.mjs` 直接读取 `artifacts/knowledge/*.json`、`schemas/`、`src/` 重算，不引用开发方自报数字。输出：`probe/phase1-remediation-verify.out.json`。

| 检查 | 结果 | 关键实测 |
| --- | --- | --- |
| P0-1 删除保留 | PASS | `SOURCE_MISSING` 实现 + 单测；当前源完整，缺失态 0 |
| P0-2 运行时读取 | PASS | 加载 299 PRD 文档 / 47 最新版 / 82 实体 / 8454 字段 / 27908 规则 / 31865 证据 |
| P0-3 Evidence 对象 | PASS | 31865 个，全部 `object_type=Evidence` |
| P0-4 证据逐字 | PASS | 抽样 400/400 逐字且落在声明行；版本 31832/31865 |
| P0-5 规则来源 | PASS | 20226 / 5619 / 2060 / 3；5619 条推导规则全带 `derivation` |
| P0-6 关系解析 | PASS | 依赖 855，`target_id` 374；采购链路实体边 16 |
| P0-7 条件与映射 | PASS | `conditions` 7991，`mapping` 711 |
| P0-8 场景准入 | PASS | 引用推导规则 693，漏标 0；`UI_READY` 0；非 DRAFT 0 |
| P0-9 丢失登记 | PASS | 8 类共 441 条；`EXCLUDED_SOURCE` 77 / `SOURCE_CONFLICT` 13 / `DUPLICATE_SOURCE` 11 |
| P0-10 Schema | PASS | 14 个文件；`validateBundleSchemas` 接入；ajv Draft 2020-12 |
| P0-11 只读命令 | PASS | 命令走 `loadKnowledgeBundle`，不触发扫描 |
| P0-12 解析适配 | PASS | 适配层存在，TXT 分支存在（无真实样本，见残余 R1） |
| P0-15 证据要素 | PASS | 哈希/行号/原文 31865/31865 |
| P0-17 流程解析 | PASS | 143 流程 / 1315 步骤，结构化 1315，纯数字 0 |

---

## 四、只读复验

对 27 个交付文件做运行前/后 SHA-256 对比：

- 知识库 13 个 JSON
- 索引 2 个 JSON（`DOCUMENT_REGISTER.json`、`.scan-state.json`）
- 报告 12 个 Markdown

依次执行 `npm run prd:validate`、`npm run prd:report` 后：

```text
changed: []   added: []   removed: []   readonly: true
```

证据：`probe/phase1-readonly-check.out.json`。

---

## 五、本轮修复的额外缺陷

**VD-01：逐字校验静默跳过非 PRD 根目录文档（已修复）**

- 现象：`prd:validate` 的 `LineIndex` 只按 `sourceRoot + relative_path` 解析；测试用例库文档（3,000+ 条证据）不在该根下，`existsSync=false` 后直接 `continue`，未做任何比对，也未告警。
- 影响：验收报告「证据逐字」结论只对 PRD 根内文档成立，对用例库文档是假阴性。
- 修复：`LineIndex` 优先使用 `document_id → DocumentRecord.file_path`（绝对路径），根目录相对路径仅作兜底；无法解析时保持跳过但不误判通过。
- 回归：新增单测「证据逐字校验能覆盖 PRD 根目录之外的文档」，人为写入不存在的 `excerpt` 后必须报 `RULE_EXCERPT_NOT_VERBATIM`；全量 `prd:validate` 仍为 0 error。

---

## 六、残余与风险

| 编号 | 残余 | 复验建议 |
| --- | --- | --- |
| R1 | TXT 无真实样本 | 要求提供 ≥1 份 TXT 后再宣称支持 |
| R2 | 481 条依赖未解析 | 抽查是否均为字段码/表名/入参名，而非业务实体 |
| R3 | 2390 条 EXPLICIT 引用平台服务 | 由 PRD 负责人裁决口径（`OQ-SVC-EXPLICIT-CALIBER`） |
| R4 | 33 条证据无版本 | 抽查原文存在且逐字；接受 `EVIDENCE_VERSION_UNKNOWN` |
| R5 | 根级 6 份 md / 71 份 `_diff` 不建模 | 确认其不具备正式规则效力 |
| R6 | 7 个库存存货域作业缺 PRD | 属数据补齐，不计入本轮缺陷 |
| R7 | `reports/` 指标随批次变化 | 复验时以 `artifacts/knowledge/summary.json` 的 `generated_at` 对齐批次 |

---

## 七、建议的独立复验步骤

1. 在隔离副本中删除 1 份最新版 PRD，跑增量扫描，确认文档保留、`SOURCE_MISSING`、规则数与证据数不变。
2. 随机抽 200 条证据（含 ≥50 条来自测试用例库目录），逐字比对原文与 `line_start`。
3. 抽查采购链路 16 条实体边，逐条回到原文取单章节确认依据；确认无证据关系未标 `candidate`。
4. 抽查 30 条最新版 `PRD_EXPLICIT`，判断是否仍存在占位/示例/纯服务描述误标。
5. 跑 `prd:validate` / `prd:report` 并对比 27 个交付文件 SHA。
6. 对 R1~R6 逐项给出「接受 / 不接受」结论，再重新裁决 Go/No-Go。

---

## 八、证据索引

| 证据 | 路径 |
| --- | --- |
| 整改说明 | `artifacts/acceptance/PHASE1-REMEDIATION-REPORT.md` |
| 复算结果 | `probe/phase1-remediation-verify.out.json` |
| 只读结果 | `probe/phase1-readonly-check.out.json` |
| 知识库汇总 | `artifacts/knowledge/summary.json` |
| 完成报告 | `reports/PHASE1_COMPLETION_REPORT.md` |
| 已知局限 | `reports/KNOWN_LIMITATIONS.md` |
