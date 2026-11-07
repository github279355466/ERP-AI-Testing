# Athena ERP 自动化测试平台 — 项目长期索引

> 本文件为项目级快速索引，权威规则以 `.workbuddy/memory/MEMORY.md` 为准；每日细节见 `YYYY-MM-DD.md`。

## 项目定位

TypeScript + Playwright 的 Athena ERP 自动化测试框架，默认只读；分阶段推进（Phase 1 PRD 建模 → Phase 2 UI 底座 → Phase 3 测试设计编排 → Phase 4 数据管理 → Phase5 执行断言 → Phase6 管理报告）。铁律见根目录 `AGENTS.md`。

## 关键路径索引

| 用途 | 路径 |
| --- | --- |
| 项目铁律 | `AGENTS.md`（默认只读、不虚构、不写凭据、分层断言） |
| 技术设计 | `docs/ARCHITECTURE.md` |
| Phase 1 需求（目标值） | `docs/plan/Athena-ERP-Test-Development-Kit/docs/01~05`，尤其 `02-PRD扫描建模规范.md` §3/§4/§5/§9/§10/§11/§12/§15、`03-Phase-1-PRD建模子项目.md` F1~F8 与 §7 |
| 数据契约 | `docs/plan/Athena-ERP-Test-Development-Kit/docs/04-知识模型与数据契约.md`；正式 Schema 为仓库 `schemas/`（13 类 + common，由 `npm run prd:schemas` 生成） |
| 阶段门禁 | `docs/plan/Athena-ERP-Test-Development-Kit/docs/05-后续开发路线图.md` |
| Phase 1 配置 | `config/prd-modeling.config.json`（外部 PRD 目录、includeExtensions、policy） |
| Phase 1 源码 | `src/prd/*`（含 evidence/relations/schema/store）、`src/cli/prd.ts` |
| Phase 1 产出 | `artifacts/knowledge/`（13 JSON）、`artifacts/source-index/`、`reports/`（10 md） |
| Phase 1 读取适配层 | `src/knowledge/prd-knowledge.ts`（`PrdKnowledgeBase.load`），与 legacy `knowledge/athena-*.json` 并存 |
| 框架运行时知识库 | `knowledge/athena-*.json` + `src/knowledge/knowledge-base.ts` |
| 测试 | `tests/unit/`（14 spec）、`tests/smoke/`（需浏览器，默认不跑） |
| 独立验收报告 | `artifacts/acceptance/01~08 + PHASE1-ACCEPTANCE-REPORT.md` |
| 整改与复验 | `artifacts/acceptance/PHASE1-REMEDIATION-REPORT.md`、`PHASE1-REGRESSION-REPORT.md` |
| 团队收口 | `deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md` |
| 取证脚本 | `probe/acceptance/`、`probe/acc_*.py`、`probe/acceptance-*.js` |

## 当前状态（2026-11-07 整改后）

- **Phase 1 独立验收原结论：🔴 不通过**（`artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md`，17 项严重缺陷）。
- **整改已完成自检**：17 项中 16 项关闭，TXT 真实样本待确认（R1）；P0 动作全部落地。`prd:validate` PASS（0 error / 33 warning），单测 **76 passed**，14/14 独立复算通过，`validate`/`report` 对 27 个交付文件只读。
- **当前状态：申请独立复验**，复验通过前 Phase 1 门禁仍为 No-Go；Phase 3 仍 No-Go。
- 残余：TXT 无真实样本、481 条依赖未解析、2390 条 EXPLICIT 平台服务口径待裁决、33 条证据无版本、根级/`_diff` 文档不建模、7 个库存存货域作业缺 PRD。
- 仓库仍 1 个提交 `7c13b44`（整改改动未提交）；`artifacts/` 被 gitignore，知识库为可再生产物。

## 工作约定

- 只读验收：不连 ERP、不启浏览器、不跑 Playwright、不调 OpenAPI/MCP、不执行 ERP 业务操作。
- `prd:validate`/`prd:report` 已改为只读；`prd:scan` 会重建知识库，需先快照再 diff。
- 报告统一 UTF-8 无 BOM + CRLF；写盘含反引号的中文文本先落脚本文件再执行，禁止 `python -c` 内联。
- 未实际验证的项一律标「未验证」，不得虚构通过结论。
