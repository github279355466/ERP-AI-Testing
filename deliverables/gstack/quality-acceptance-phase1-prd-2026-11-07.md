# Athena ERP Phase 1 独立质量验收 — 软件工坊团队收口报告

**日期**：2026-11-07
**场景**：独立质量验收（Phase 1 门禁 / Go-No-Go 检查）
**参与成员**：调查员（A/C）+ 产品评审员（B/D/E）+ QA 与发布负责人（F/G）
**主理人**：沽思航（编排、中转与汇编）

---

## 📌 TL;DR（执行摘要）

- 整体结论：🔴 **不通过**（阶段门禁 No-Go）。七项分项 6 项不通过、1 项有条件通过。
- 阻塞项：**17 项严重缺陷**（去重合并后），其中 3 项属「实现与开发方自报不符」，4 项直接违反用户验收原则 4/5/6。
- 关键反差：**63 项单测全绿、Schema 自报 0 error/0 warning，但校验器口径过窄造成假阴性** —— 不能作为放行依据。
- 下一步：完成 P0 11 项整改 → 重跑 → 独立复验 → 重新裁决。Phase 2 技术工作可在书面批准下并行，Phase 3 明确 No-Go。

---

## 🎯 核心结论卡片

| 项目 | 内容 |
| --- | --- |
| Go / No-Go | 🔴 **No-Go**（Phase 1 验收） · 🟡 **条件 Go**（Phase 2 UI 底座技术并行，需工程负责人书面批准） · 🔴 **No-Go**（Phase 3） |
| 严重度分布 | 🔴 17 / 🟠 40+ / 🟢 9 |
| 分项 | A🔴 B🔴 C🔴 D🔴 E🔴 F🔴 G🟡 |
| 关键行动项 | P0 11 / P1 8 / P2 6 |
| 待确认问题 | 392 条（既有 330 + 本次新增 62） |
| 建议负责人 | 平台+建模负责人（P0）· 工程负责人（Go/No-Go 与带缺陷结项批准）· PRD 负责人（业务口径裁决） |

---

## 1. 各成员核心结论

### 🔧 调查员（A 扫描完整性 / C 知识模型质量）

核心判断：**A、C 均不通过**。工程底子扎实——540 文件全量哈希 0 不一致、87 条抽验 ID/哈希/大小 0 不一致、`.scan-state.json` 540 键零差集、隔离副本跑通 FULL→INCREMENTAL 五轮且缓存 bug 修正确实有效、13 个 JSON / 57,429 对象结构校验 0 错误、`summary.json` 15/15 counts 一致、全库 ID 0 重复。但两条硬门禁未过：F1「删除只标记源文件缺失」未实现（删除后文档从 3 处产物全部消失、全仓 `SOURCE_MISSING` 0 赋值）；Phase 1 模型与框架运行时知识 API 完全断开（`KnowledgeBase.load` 实测只得到 pages=8/rules=20/components=13/prd_entries=19，指向 `artifacts/knowledge` 直接 ENOENT）。另 `Evidence` 对象与 `knowledge/evidence/` 整体缺失（12 类只有 11 类）。

关键建议：实现删除标记与历史保留；交付读取适配层或正式契约；补齐 `Evidence` 或变更 §2 契约；补齐 10 类缺失 Schema。

> 该成员还独立纠正了主理人的一条错误假设：版本口径不一致（v1.24 / v1.8 vs 旧索引 v1.22）根因是**旧 `prd:index` 索引过期**，不是 `_diff` 差异文档污染最新版判定；47 份 `is_latest` 全部来自顶层正式 PRD。主理人已据此更正并转达其他成员。

### 📋 产品评审员（B 解析质量 / D 规则证据追溯 / E 业务关系质量）

核心判断：**B、D、E 均不通过**。26 份平台 JSON 的 `attrs`/`operations` 抽取零丢失，但「0 解析错误」掩盖静默内容丢失（6 份根级散落 md 完全未建模、77 份 PRD 文档 0 规则）；40 条规则逐字比对 **0/40 命中**（88.3% 的 `excerpt` 等于 `description`），抽样 28 条 `PRD_EXPLICIT` 中严格误标 9 条（32.1%）、宽口径 14 条（50.0%）；采购链路 4 份核心单据 PRD 确实存在且已建模（规则 144/252/256/181，**不是输入缺失**），但 **7 节点之间 0 实体级关系 / 0 `CANDIDATE_LINK`**，「入库取到货」有明确原文却 0 建模 0 登记，数量/状态/前置/回写未结构化。

关键建议：证据逐字化并重定义 `PRD_EXPLICIT`；按证据建明确关系、无证据建候选关联；补登记数量口径与回写逻辑；纠正 `COVERAGE_MATRIX.md` 路径首段匹配口径。

### ✅ QA 与发布负责人（F 场景质量 / G 自动化测试与工程质量）

核心判断：**F 不通过、G 有条件通过**。实跑 `build`/`typecheck` 退出 0、`test:unit` **63 passed / 0 failed / 0 skipped**、`prd:validate` 0 error、`prd:report` 成功；场景五要素 4,067/4,067 齐全、全部 `DRAFT` + `review_required=true`、无自动执行入口，这部分属实。但 **468 个引用 `PRD_DERIVED` 规则的场景仅 58 个正确标 `NEEDS_CONFIRMATION`，410 条漏标（87.6%）、363 条误标 `UI_READY`**，直接违反 F7 且 `prd:validate` 未检出；另有 F-S2（63.9% 场景标 `UI_READY` 但正文全为模板占位）与 F-S3（前置条件 100% 为通用模板，违反 `02` §10）。补充核验另发现 3 条严重缺陷（D-S4 六分类缺 3 类 / D-S5 证据 7 要素缺 5 项 / E-S4 流程表列错配 8 列丢 5 列）、3,856 条平台服务表述误标 EXPLICIT、36 张 PNG 流程图从未进入扫描范围（OQ-NEW-17~27）。8 类覆盖中正常业务 / 异常输入为 0，必填校验占 78.7%。另发现 `prd:validate`/`prd:report` 名为「仅校验/仅重生成报告」实际执行 FULL 全量重建（320/325 文件 SHA 改变）。

关键建议：字段级门禁修正场景准入并重跑校验；校验/报告改真只读；补齐正式 Schema；补直接单测；README 补 Phase 1 章节。

---

## 2. 综合审查发现（去重合并，按严重度排序）

| # | 严重度 | 类别 | 位置 | 问题描述 | 建议 | 来源 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 🔴 | 数据完整性 | `pipeline.ts:185-203,253-280` | F1 删除即丢历史知识；`SOURCE_MISSING` 未实现 | 实现状态标记 + 历史保留 + 单测 | 调查员 |
| 2 | 🔴 | 架构 | `knowledge-base.ts:93-121`、`main.ts:76,224` | Phase 1 模型与运行时知识 API 完全断开 | 交付读取适配层（Phase 3 前必须） | 调查员 |
| 3 | 🔴 | 数据契约 | `types.ts:14-26`、`artifacts/knowledge/` | `Evidence` 对象与 `evidence/` 整体缺失 | 补齐或正式变更契约 | 调查员 |
| 4 | 🔴 | 规则证据 | `extract.ts:585`、`types.ts:28-36` | 证据片段非原文逐字、无版本、行号偏移 | 逐字片段 + 精确行号 + 版本 + ERROR 级校验 | 产品评审员 / 调查员 |
| 5 | 🔴 | 规则分类 | `extract.ts:590,618-690,821-869` | `PRD_EXPLICIT` 误标 32.1%~50%，非规则文本升为 CONFIRMED | 重定义口径、清理误标、回填 derivation | 产品评审员 |
| 6 | 🔴 | 业务关系 | `dependencies.json`(722)、`extract.ts:911-950` | 采购 7 节点 0 实体级关系，`target_id`/`mapping` 全 null | 按证据建关系并解析目标 | 产品评审员 |
| 7 | 🔴 | 业务关系 | `采购入库单…V1.19.md:1958-1966` | 「入库取到货」有原文却 0 建模；数量/状态/回写未结构化 | 补建模 + 补登记 | 产品评审员 |
| 8 | 🔴 | 场景准入 | `scenarios.ts` | 410 条推导规则场景漏标 `NEEDS_CONFIRMATION`；校验器假阴性 | 字段级门禁 + 重跑 | QA |
| 9 | 🔴 | 解析完整性 | `documents.json`、`open-questions.json` | 6 份根级 md、77 份 0 规则文档静默丢失；4 类缺口 OQ 为 0 | 登记排除或补建模 | 产品评审员 |
| 10 | 🔴 | Schema 治理 | 开发包 `schemas/`（仅 2 份）、`validate.ts` | 「所有模型通过 JSON Schema」不成立：10/12 类无 Schema、2 类未接入运行时 | 补齐 + ajv + CI | 调查员 / QA |
| 11 | 🔴 | 工程安全 | `src/cli/prd.ts:127-145` | 校验/报告命令非只读，实测 320/325 文件 SHA 改变 | 改真只读或输出重定向 | QA / 调查员 |
| 12 | 🔴 | 规范符合性 | `parsers.ts`、`extract.ts:1072-1099` | F3 Parser Adapter 未实现、TXT 无解析器、`reservedExtensions` 死配置 | 实现 Adapter 与 TXT 解析 | 产品评审员 / 调查员 |
| 13 | 🔴 | 场景准入 | `scenarios.json`（2,600 `UI_READY`） | 2,600 个 `UI_READY` 100% 通用模板前置条件、363 个引用 `PRD_DERIVED`，违反 `02` §10 第 192 行 | 改联合判定，明确与 DRAFT 的边界 | QA |
| 14 | 🔴 | 场景契约 | `scenarios.json`（2,600 `UI_READY`） | 63.9% 标 `UI_READY` 但正文全为固定模板占位，`NEEDS_UI_EXPLORATION` 使用数 0，与 DRAFT 语义冲突 | 引入 UI 探索中间态 | QA |
| 15 | 🔴 | 证据契约 | `types.ts:28-36`、`rules.json` | 证据 7 要素中 5 项全库 0/30,641，`EVIDENCE_MISSING` 0 次 | 补齐并接入校验 | 产品评审员 |
| 16 | 🔴 | 规则分类 | `extract.ts:590`、`rules.json` | 六分类缺 3 类，3,856 条平台服务表述误标 EXPLICIT | 按 §5 重界定并回填 | 产品评审员 |
| 17 | 🔴 | 流程解析 | `extract.ts`(流程表)、`workflows.json` | 列错配致 8 列丢 5 列，68/143 条 step 为纯数字 | 按原表列头重解析 | 产品评审员 |

**阻塞项清单（Go/No-Go 必读）**：#1、#2、#4、#5、#6、#7、#8、#9、#10、#11 共 14 项须关闭或书面豁免；#3、#12 须有明确契约决策。**回滚 / 还原预案**：本次已验证可行 —— `artifacts/acceptance/_snapshots/manifest-before.json` 为基线，`prd:validate`/`prd:report` 造成 320/325 文件 SHA 改变后，已 **restore 325 文件 + verify 全部字节一致 + git tracked 修改数 0**。后续整改重跑必须沿用「先快照 → 跑 → diff → 还原」路径，并把 #11 修复作为前置。

---

## ✅ 行动清单

| # | 行动 | 负责方 | 紧急度 | 期望完成 |
| --- | --- | --- | --- | --- |
| 1 | 实现 `SOURCE_MISSING` 删除标记与历史解析结果保留 | 平台 | P0 | Phase 2 启动前 |
| 2 | 468 个推导规则场景 100% 标 `NEEDS_CONFIRMATION`，清理 363 个 `UI_READY` 误标，并让校验器能检出 | 平台 / QA | P0 | Phase 2 启动前 |
| 3 | 证据逐字化 + `SourceRef` 增版本 + 精确行号；重定义 `PRD_EXPLICIT` 并清理误标 | 建模 / PRD 负责人 | P0 | Phase 2 启动前 |
| 4 | 采购链路按证据建明确/候选关系，结构化 `conditions` 与 `mapping`，补登记 OPEN_QUESTIONS | 建模负责人 | P0 | Phase 2 启动前 |
| 5 | 静默内容丢失登记（6 份根级 md / 77 份 0 规则文档 / 非 prd_spec JSON） | 平台 | P0 | Phase 2 启动前 |
| 6 | `prd:validate`/`prd:report` 改真只读；统一版本基准与交付批次口径；修覆盖率匹配口径 | 平台 / 主理人 | P0 | Phase 2 启动前 |
| 7 | 重跑全流程并由独立验收方复验 A~G 七项，关闭 17 项严重缺陷 | QA / 独立验收方 | P0 | 重新裁决前 |
| 8 | 交付知识模型读取适配层、补齐 10 类 Schema 并接入 ajv、决策 `Evidence` 契约 | 平台 / 架构 | P1 | Phase 3 启动前 |
| 9 | 工程负责人书面裁决：是否批准「Phase 1 带缺陷结项 + Phase 2 并行整改」 | 工程负责人 | P0 | 决策当日 |

完整 25 项行动（P0 11 / P1 8 / P2 6）见 `artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md` §7。

---

## ⚠️ 待完善 / 已知局限

- 全程未连接 ERP、未启浏览器、未跑 Playwright、未调 ERP OpenAPI/MCP、未执行任何 ERP 业务操作；涉及真实页面的结论一律标「未验证」或 `candidate`。
- 规则证据与业务关系为**抽样**比对（40 条规则、6 份原文逐段、20 条依赖回溯），未做 30,641 条全量人工语义比对。
- 正式 JSON Schema 校验由验收方用**自实现 Draft 2020-12 子集**执行（本机无 ajv / Python 无 jsonschema），未覆盖 pattern/format/oneOf，不能替代项目运行时结论。
- 采购链路业务口径冲突（上游是采购订单还是到货单、「退货关联已入库」是否需求笔误）需 PRD 负责人/业务裁决，验收方不代为确定。
- 8 类场景 taxonomy 出自 Phase 3 架构文档，Phase 1 是否以此为数量门禁属口径决策，未裁决。
- **最终独立复核**：325/325 被验收产出、53/53 追踪文件、540/540 外部 PRD 文件全部 SHA-256 + 字节数一致；`tracked 修改数=0`、0 个未还原差异。证据 `probe/acceptance/h1_final_hash_audit.json`。**验收过程未污染被验收基线。**
- 取证期间 `artifacts/knowledge/*`、`source-index/*`、`reports/*` 曾被一次 FULL 运行整体重生成（先快照后 diff 的合规路径），调查员对前后两版分别重跑核对，所有结论对两版均成立；最终状态已还原。

---

## 📚 成员产出索引

- **gstack-investigator** 原始产出：`artifacts/acceptance/01-document-scan-report.md`、`03-knowledge-model-validation.md`；证据 `probe/acceptance/`（`a1`~`a7`、`c1`~`c6`、`isolated/`）
- **gstack-product-reviewer** 原始产出：`artifacts/acceptance/02-parsing-quality-report.md`、`04-rule-traceability-report.md`、`05-business-relationship-report.md`；证据 `probe/acc_*.py` / `*.out.txt`
- **gstack-qa-lead** 原始产出：`artifacts/acceptance/06-scenario-quality-report.md`、`08-automated-test-report.md`；证据 `artifacts/acceptance/_snapshots/`
- **主理人汇编**：`artifacts/acceptance/07-open-questions.md`、`artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md`、本报告

---

> 本报告由软件工坊 AI 协作生成，关键决策请由工程负责人复核。所有「未验证」项均未虚构通过结果。
