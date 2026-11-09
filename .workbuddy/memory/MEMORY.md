# Athena ERP 自动化测试平台 — 项目长期索引

> 本文件为项目级快速索引，权威规则以 `.workbuddy/memory/MEMORY.md` 为准；每日细节见 `YYYY-MM-DD.md`。

## 项目定位

TypeScript + Playwright 的 Athena ERP 自动化测试框架，默认只读。当前两条工作线：

- **v2.0 平台线**：三层架构（Platform Core / Business Module Packs / Integration Test Packs），已推进到 P7 采购订单全操作闭环、P8 采购订单表头字段规则（12 条，4 verified）；基础管理模块 2026-11-09 完成 37 作业 CRUD 广度与状态流转复核。
- **legacy 框架线**：Phase 1 PRD 建模申请第三轮验收；Phase 2 底座（P2.0~P2.4）已完成，采购订单 → 到货 → 入库真实跑通，采购退货 → 退货出库被库存过账缺陷阻断（`docs/defects/BUG-20261108-01-采购入库单审核未过账.md`）。

铁律见根目录 `AGENTS.md`。

## 关键路径索引

| 用途 | 路径 |
| --- | --- |
| 项目铁律 | `AGENTS.md`（默认只读、不虚构、不写凭据、分层断言） |
| 技术设计 | `docs/ARCHITECTURE.md` |
| v2.0 架构与契约 | `docs/architecture/TO-BE.md`、`docs/architecture/BOUNDARIES.md`、`docs/contracts/` |
| 阶段验收（P1~P7） | `docs/acceptance/P1-ACCEPTANCE.md` ~ `P7-ACCEPTANCE.md`、`FINAL-ACCEPTANCE.md` |
| Phase 1 需求（目标值） | `docs/plan/Athena-ERP-Test-Development-Kit/docs/01~05`，尤其 `02-PRD扫描建模规范.md` §3/§4/§5/§9/§10/§11/§12/§15、`03-Phase-1-PRD建模子项目.md` F1~F8 与 §7 |
| 数据契约 | `docs/plan/Athena-ERP-Test-Development-Kit/docs/04-知识模型与数据契约.md`；正式 Schema 为仓库 `schemas/`（13 类 + common，由 `npm run prd:schemas` 生成） |
| 阶段门禁 | `docs/plan/Athena-ERP-Test-Development-Kit/docs/05-后续开发路线图.md` |
| Phase 1 配置 | `config/prd-modeling.config.json`（外部 PRD 目录、includeExtensions、policy） |
| Phase 1 源码 | `src/prd/*`（含 evidence/relations/schema/store）、`src/cli/prd.ts` |
| Phase 1 产出 | `artifacts/knowledge/`（13 JSON）、`artifacts/source-index/`、`reports/`（10 md） |
| Phase 1 读取适配层 | `src/knowledge/prd-knowledge.ts`（`PrdKnowledgeBase.load`），与 legacy `knowledge/athena-*.json` 并存 |
| 框架运行时知识库 | `knowledge/athena-*.json` + `src/knowledge/knowledge-base.ts` |
| Phase 2 操作与配置 | `docs/PHASE2-运行手册.md`、`docs/PHASE2-配置说明.md` |
| Phase 2 缺陷与方向性问题 | `docs/defects/`、`artifacts/phase2/acceptance/P2.4-DIRECTION-BUGS.md`（本地） |
| 字段级规则校验要求（未执行） | `docs/PHASE3-字段规则校验要求.md`（50 条规则 / 10 域） |
| 未完成事项与阻塞 | `docs/TODO.md`（T-04~T-07） |
| 测试 | `tests/unit/`（139 用例）、`tests/integration/`（27 用例）、`tests/smoke/`（需浏览器，默认不跑） |
| 独立验收报告 | `artifacts/acceptance/01~08 + PHASE1-ACCEPTANCE-REPORT.md` |
| 整改与复验 | `artifacts/acceptance/PHASE1-REMEDIATION-REPORT.md`、`PHASE1-REGRESSION-REPORT.md`、`PHASE1-REMEDIATION-R2.md`（第二轮）、`DECISIONS.md`（判定口径） |
| 团队收口 | `deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md` |
| 取证脚本 | `probe/acceptance/`、`probe/acc_*.py`、`probe/acceptance-*.js` |

## 当前状态（2026-11-09 基础管理收口）

- **基础管理 37 作业**：盘点 100%；含新增入口页面 CRUD 广度 34/35（97.1%，采购参数被 DEF-04 阻断）；状态流转 13 项、12 通过（仅 DEF-05 品号批号失效失败）。
- **真实缺陷 6 项**：DEF-01 项目信息编辑、DEF-02 客户分店数、DEF-03 存货参数、DEF-04 采购参数、DEF-05 品号批号失效、DEF-08 单位换算出现“天”。详见 `reports/foundation/DEFECT-AND-GAP-REPORT.md`。
- **已撤回 2 项**：DEF-06 交易对象群组、DEF-07 品号存货，均为自动化定位误报；AUT-06/07/08 已修复并复测通过，数据已恢复。
- **GAP 定性**：GAP-01/02/03 已确认规则，非缺陷；GAP-04/05 仅作功能规则一致性提示，不计入未通过；GAP-06 引用保护列入下一阶段必测。
- **范围裁剪（2026-11-09）**：导入/导出、字段长度与格式边界、并发与重复提交不测试。
- **下一阶段主线**：`docs/plan/下一步测试计划-20261109.md`（B1 引用保护 → B2–B5 采购字段逻辑）；采购专项见 `docs/plan/采购管理-字段逻辑验证计划.md`。
- **采购字段现状**：仅采购订单表头 12 条规则，明细/金额/税额/数量/单位/仓库/储位/批号/状态均未验证；PRD 原始规则 9316 条待按页面与字段收敛。
## 当前状态（2026-11-08 第二轮整改后）

- **Phase 1 独立验收原结论：🔴 不通过**（`artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md`，17 项严重缺陷）。
- **第一轮整改**：17 项中 16 项关闭，TXT 真实样本待确认（R1），见 `PHASE1-REMEDIATION-REPORT.md`。
- **第二轮复验**：`artifacts/acceptance/PHASE1-REMEDIATION-INSTRUCTIONS-R2.md` 列出 9 项 P0（空证据 3693、反证 322、条件孤儿 1411、关系反转 5、占位 mapping 19、实体分裂 15 组、重复场景 898 条等）。
- **第二轮整改已完成自检**：S-01~S-09 全部落地，`prd:validate` PASS（0 error / 40 warning），单测 **139 passed**（整改当时 97，之后随平台测试增加），8 个验收脚本复算全零，人工抽检 200 规则 / 14 关系 / 30 场景命中率 100%。逐项 before/after 见 `artifacts/acceptance/PHASE1-REMEDIATION-R2.md`。
- **当前知识库**：333 文档 / 43 实体 / 8454 字段 / 26498 规则 / 850 依赖 / 3204 场景 / 33510 证据 / 620 待确认问题。
- **当前状态：申请第三轮独立验收**，验收通过前 Phase 1 门禁仍为 No-Go；Phase 3 仍 No-Go。
- 残余：采购链路字段级映射 5/12（未解析 7 条登记 `MAPPING_UNRESOLVED`）、33 条证据无版本、233 条关系主体为平台服务/表结构、TXT 无真实样本、7 个库存存货域作业缺 PRD。
- **代码主线已推进到 P8**：`22a0291 feat(purchase): P7 采购订单全操作闭环`、`ef5baad feat(rules): 字段规则引擎与采购订单规则集`。P8 仅覆盖采购订单表头 12 条（4 verified / 7 skipped / 1 warning），明细与其余 14 个采购作业未覆盖。
- **legacy Phase 2 底座已完成（2026-11-08）**：P2.0 配置/门禁/run manifest、P2.1 浏览器/会话/导航、P2.2 九类控件适配器、P2.3 页面对象与字段映射、P2.4 采购四单据流程；11 个模块提交 `82d5edd`~`899b14d`，位于 P1-P7 平台提交之前。
- **Phase 2 真实链路**：订单 `PO0501-2026110800001`~`0005`、到货 `PO0602-2611080001`~`0004`、入库 `IM0301-2026110800002`~`0004` 已跑通；退货 `P2RTN-20261108-02/03`（供应商范围）与 `P2RTN-20261108-04`（库存过账）未通过。
- **Phase 2 缺陷**：`BUG-20261108-01` 入库审核未过账（对照实验：临时开启允许负库存后审批 `code=0`，出库单 `IM0402-202611080001` 已过账；配置已恢复，遗留 00CP/01-2-00011 负库存 1 KG）；`DIR-09` 取单弹窗 0 条；`DIR-10` 储位选择器；`DIR-11` 品号财务信息缺失。
- **Phase 2 验证口径**：P2.4 通过的是流程贯通与输入回填一致性；字段级业务规则（金额/税额/数量上限/项目/仓库/储位）未验证，清单见 `docs/PHASE3-字段规则校验要求.md`。
- `artifacts/` 被 gitignore，知识库为可再生产物；第二轮整改的 10 个提交位于 P2 平台提交之前。
- **知识库漂移（2026-11-08 发现）**：外部 PRD 根已把 `采购退货单PRD.v1.11.md` 移到 `_history/`，顶层升为 `v1.12`；当前 `artifacts/knowledge` 仍是 2026-11-07 15:48 批次，引用 v1.11 路径，`evidence-grain.js` / `contrary.js` 等读原文的脚本会 ENOENT。第三轮验收前必须先 `npm run prd:scan` 重建并重跑复算，否则数字不可比。

## 工作约定

- 只读验收：不连 ERP、不启浏览器、不跑 Playwright、不调 OpenAPI/MCP、不执行 ERP 业务操作。
- `prd:validate`/`prd:report` 已改为只读；`prd:scan` 会重建知识库，需先快照再 diff。
- 报告统一 UTF-8 无 BOM + CRLF；写盘含反引号的中文文本先落脚本文件再执行，禁止 `python -c` 内联。
- 未实际验证的项一律标「未验证」，不得虚构通过结论。
