# P0 资产清单：文件级映射

> 目的：补充 `P0-AS-IS.md` 的模块级盘点，做到“每个源码/测试/配置/知识/用例文件都有目标与处置”。
> 处置：保留 / 适配 / 迁移 / 重构 / 废弃（P0/P1 不删除）。
> 目标路径为 v2.0 目标结构，不代表 P1 会立即搬迁。

## 1. `src/` 源码（87 个）

### 1.1 adapters（12）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/adapters/base/adapter-context.ts` | 适配器上下文 | `platform/page-adapter-engine/controls/base/` | 迁移 |
| `src/adapters/base/base-adapter.ts` | 基础适配器 | `platform/page-adapter-engine/controls/base/` | 迁移 |
| `src/adapters/button-adapter.ts` | Button | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/date-adapter.ts` | Date | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/dropdown-adapter.ts` | Dropdown | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/grid-adapter.ts` | Grid | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/index.ts` | 适配器工厂 | `platform/page-adapter-engine/controls/` | 迁移/适配 |
| `src/adapters/input-adapter.ts` | Input | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/lookup-adapter.ts` | Lookup | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/modal-adapter.ts` | Modal | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/tab-adapter.ts` | Tab | `platform/page-adapter-engine/controls/` | 迁移 |
| `src/adapters/tree-adapter.ts` | Tree | `platform/page-adapter-engine/controls/` | 迁移 |

### 1.2 assertion / discovery / logging（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/assertion/assertion-engine.ts` | 三级断言 | `platform/assertion-engine/` | 重构 |
| `src/discovery/page-explorer.ts` | 页面探索/candidate | `platform/page-adapter-engine/discovery/` | 保留/迁移 |
| `src/logging/console-capture.ts` | console/pageerror | `platform/evidence/logging/` | 迁移 |

### 1.3 browser（7）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/browser/browser-manager.ts` | 浏览器生命周期 | `platform/browser-engine/` | 迁移 |
| `src/browser/cdp-adapter.ts` | CDP | `adapters/browser/cdp/` | 迁移/适配 |
| `src/browser/context-manager.ts` | Context | `platform/browser-engine/context/` | 迁移 |
| `src/browser/page-manager.ts` | 页面管理/列表就绪/复位 | `platform/browser-engine/page/` + `adapters/athena-web/page-state/` | 重构 |
| `src/browser/page-match.ts` | 页面匹配 | `platform/browser-engine/page-match/` | 保留/迁移 |
| `src/browser/playwright-adapter.ts` | Chromium 启动 | `adapters/browser/playwright/` | 迁移/适配 |
| `src/browser/session.ts` | BrowserSession 类型 | `platform/browser-engine/session/types.ts` | 迁移 |

### 1.4 cli（2）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/cli/main.ts` | 平台 + 采购命令混合 | `platform/cli/` + `business-modules/purchase/runner/` | 重构/迁移 |
| `src/cli/prd.ts` | PRD CLI | `platform/cli/prd/` | 适配/迁移 |

### 1.5 config（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/config/athena-config.ts` | 配置模型/解析 | `platform/governance-engine/config/` | 重构 |
| `src/config/config-schema.ts` | 配置 Schema 校验 | `platform/governance-engine/config/schema/` | 适配 |
| `src/config/load-env.ts` | `.env` 加载 | `platform/governance-engine/config/env/` | 迁移 |

### 1.6 controls（8，legacy）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/controls/control-classifier.ts` | 控件分类 | `platform/page-adapter-engine/legacy-controls/` | 保留/逐步废弃 |
| `src/controls/control-types.ts` | 控件类型 | `platform/page-adapter-engine/legacy-controls/` | 保留/逐步废弃 |
| `src/controls/erp-dropdown.ts` | 下拉读取 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |
| `src/controls/erp-form.ts` | 表单读取 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |
| `src/controls/erp-grid.ts` | 表格读取 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |
| `src/controls/erp-lookup.ts` | 开窗读取 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |
| `src/controls/erp-modal.ts` | 弹窗读取 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |
| `src/controls/erp-tabs.ts` | 页签 | `platform/page-adapter-engine/legacy-controls/` | 重构/逐步废弃 |

### 1.7 diagnostics（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/diagnostics/control-probe.ts` | 采购订单控件探测 | `business-modules/purchase/tools/` | 迁移 |
| `src/diagnostics/failure-collector.ts` | 失败证据 | `platform/evidence/diagnostics/` | 迁移 |
| `src/diagnostics/page-recon.ts` | 采购订单侦察 | `business-modules/purchase/tools/` | 迁移 |

### 1.8 environment（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/environment/environment-guard.ts` | 环境门禁 | `platform/governance-engine/runtime/guard/` | 迁移/适配 |
| `src/environment/run-context.ts` | runId/上下文 | `platform/governance-engine/runtime/context/` | 迁移/适配 |
| `src/environment/run-session.ts` | run session/manifest | `platform/governance-engine/runtime/session/` | 迁移/适配 |

### 1.9 evidence（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/evidence/evidence-manager.ts` | 截图/DOM/日志/请求/脱敏 | `platform/evidence/manager/` | 迁移/适配 |
| `src/evidence/run-manifest.ts` | manifest | `platform/governance-engine/manifest/` | 重构 |
| `src/evidence/trace-manager.ts` | Trace | `platform/evidence/trace/` | 迁移 |

### 1.10 knowledge（5）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/knowledge/knowledge-base.ts` | legacy 4 份知识库 | `platform/knowledge-engine/legacy/` | 适配/逐步废弃 |
| `src/knowledge/model-version.ts` | `KM-*` 版本 | `platform/governance-engine/version/` | 迁移 |
| `src/knowledge/page-mapper.ts` | 页面映射 | `platform/page-adapter-engine/mapping/` | 重构 |
| `src/knowledge/prd-index.ts` | legacy PRD 索引 | `platform/knowledge-engine/prd-index/` | 适配/合并 |
| `src/knowledge/prd-knowledge.ts` | Phase 1 查询适配 | `platform/knowledge-engine/query/` | 保留/迁移 |

### 1.11 locator（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/locator/athena-profile.ts` | Athena 控件 profile | `adapters/athena-web/profile/` | 迁移 |
| `src/locator/selectors.ts` | Athena 选择器 | `adapters/athena-web/selectors/` | 迁移 |
| `src/locator/strategy.ts` | 通用定位策略 | `platform/page-adapter-engine/locator/` | 重构/适配 |

### 1.12 navigation（1）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/navigation/navigation-manager.ts` | 菜单导航 | `platform/browser-engine/navigation/` | 重构 |

### 1.13 pages（9）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/pages/base/page-object.ts` | 页面对象基类 | `platform/page-adapter-engine/page-object/` | 保留/迁移 |
| `src/pages/purchase/purchase-arrival.flow.ts` | 到货流程 | `business-modules/purchase/flows/` | 迁移/重构 |
| `src/pages/purchase/purchase-arrival.page.ts` | 到货页面 | `business-modules/purchase/pages/` | 迁移/重构 |
| `src/pages/purchase/purchase-inbound.flow.ts` | 入库流程 | `business-modules/purchase/flows/` | 迁移/重构 |
| `src/pages/purchase/purchase-inbound.page.ts` | 入库页面 | `business-modules/purchase/pages/` | 迁移/重构 |
| `src/pages/purchase/purchase-order.flow.ts` | 订单流程 | `business-modules/purchase/flows/` | 迁移/重构 |
| `src/pages/purchase/purchase-order.page.ts` | 订单页面 | `business-modules/purchase/pages/` | 迁移/重构 |
| `src/pages/purchase/purchase-return.flow.ts` | 退货流程 | `business-modules/purchase/flows/` | 迁移/重构 |
| `src/pages/purchase/purchase-return.page.ts` | 退货页面 | `business-modules/purchase/pages/` | 迁移/重构 |

### 1.14 prd（17）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/prd/cases.ts` | 已有用例解析 | `platform/knowledge-engine/existing-cases/` | 迁移 |
| `src/prd/config.ts` | PRD 配置/模块规则 | `platform/prd-scanner/config/` | 重构（模块规则外置） |
| `src/prd/evidence.ts` | 证据切片 | `platform/knowledge-engine/evidence/` | 迁移 |
| `src/prd/extract.ts` | 知识抽取 | `platform/knowledge-engine/extract/` | 重构 |
| `src/prd/ids.ts` | 稳定 ID | `platform/knowledge-engine/ids/` | 保留/迁移 |
| `src/prd/link.ts` | 版本/冲突/覆盖率 | `platform/knowledge-engine/link/` | 迁移/重构 |
| `src/prd/parsers.ts` | MD/JSON 解析 | `platform/prd-scanner/parsers/` | 迁移 |
| `src/prd/pipeline.ts` | 建模流水线 | `platform/knowledge-engine/pipeline/` | 迁移/重构 |
| `src/prd/relations.ts` | 单据关系 | `platform/knowledge-engine/relations/` | 重构（去采购常量） |
| `src/prd/remediation.ts` | 整改 OQ | `platform/knowledge-engine/remediation/` | 保留/迁移 |
| `src/prd/reports.ts` | 报告渲染 | `platform/knowledge-engine/reports/` | 迁移/适配 |
| `src/prd/scanner.ts` | 扫描器 | `platform/prd-scanner/scanner/` | 迁移 |
| `src/prd/scenarios.ts` | 场景生成 | `platform/scenario-engine/` | 重构（去采购节点） |
| `src/prd/schema.ts` | Schema 生成 | `platform/knowledge-engine/schema/` | 迁移 |
| `src/prd/store.ts` | 知识库加载 | `platform/knowledge-engine/store/` | 迁移 |
| `src/prd/types.ts` | 知识类型 | `platform/knowledge-engine/types/` | 迁移 |
| `src/prd/validate.ts` | 语义/结构校验 | `platform/knowledge-engine/validate/` | 迁移/适配 |

### 1.15 reporting（3）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/reporting/html-reporter.ts` | HTML 报告 | `platform/report-engine/html/` | 重构/适配 |
| `src/reporting/markdown-reporter.ts` | Markdown 报告 | `platform/report-engine/markdown/` | 重构/适配 |
| `src/reporting/types.ts` | RunResult/CaseResult | `platform/report-engine/types/` | 重构 |

### 1.16 runner（4）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/runner/actions/master-data-actions.ts` | 列表动作 | `platform/page-adapter-engine/actions/` | 重构/通用化 |
| `src/runner/readonly-executor.ts` | 只读执行 | `platform/execution-engine/readonly/` | 重构/迁移 |
| `src/runner/safety-policy.ts` | 安全策略 | `platform/governance-engine/safety/` | 重构 |
| `src/runner/write-executor.ts` | 写入执行 | `platform/execution-engine/write/` | 重构 |

### 1.17 session（1）

| 文件 | 现状 | 目标 | 处置 |
| --- | --- | --- | --- |
| `src/session/session-manager.ts` | 登录/会话 | `platform/browser-engine/session/` | 迁移/适配 |

## 2. `tests/`（28 个）

| 文件 | 目标 | 处置 |
| --- | --- | --- |
| `tests/integration/adapters.spec.ts` | `tests/integration/controls/` | 迁移 |
| `tests/integration/failure-evidence.spec.ts` | `tests/integration/evidence/` | 迁移 |
| `tests/smoke/cdp-discovery.spec.ts` | `tests/platform/smoke/` | 迁移 |
| `tests/unit/assertion.spec.ts` | `tests/unit/platform/assertion/` | 迁移 |
| `tests/unit/config.spec.ts` | `tests/unit/platform/config/` | 迁移 |
| `tests/unit/control-classifier.spec.ts` | `tests/unit/legacy-controls/` | 保留/迁移 |
| `tests/unit/discovery.spec.ts` | `tests/unit/platform/discovery/` | 迁移 |
| `tests/unit/environment-guard.spec.ts` | `tests/unit/platform/governance/` | 迁移 |
| `tests/unit/evidence-hardening.spec.ts` | `tests/unit/platform/evidence/` | 迁移 |
| `tests/unit/evidence.spec.ts` | `tests/unit/platform/evidence/` | 迁移 |
| `tests/unit/knowledge.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/model-version.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/navigation.spec.ts` | `tests/unit/platform/navigation/` | 迁移 |
| `tests/unit/page-match.spec.ts` | `tests/unit/platform/browser/` | 迁移 |
| `tests/unit/phase2-config.spec.ts` | `tests/unit/platform/config/` | 迁移 |
| `tests/unit/prd-ids.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-index.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-modeling.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-phase1-fix.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-phase1-r2.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-rule-source.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/prd-supplement.spec.ts` | `tests/unit/knowledge/` | 迁移 |
| `tests/unit/reporting.spec.ts` | `tests/unit/platform/reporting/` | 迁移 |
| `tests/unit/run-context.spec.ts` | `tests/unit/platform/runtime/` | 迁移 |
| `tests/unit/run-manifest.spec.ts` | `tests/unit/platform/governance/` | 迁移 |
| `tests/unit/safety-hardening.spec.ts` | `tests/unit/platform/governance/` | 迁移 |
| `tests/unit/safety-policy.spec.ts` | `tests/unit/platform/governance/` | 迁移 |
| `tests/unit/session-diagnose.spec.ts` | `tests/unit/platform/session/` | 迁移 |

## 3. `schemas/`（17 个）

| 文件 | 目标 | 处置 |
| --- | --- | --- |
| `schemas/Action.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/common.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Control.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Dependency.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Document.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Entity.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Evidence.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/ExistingCase.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Field.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/OpenQuestion.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Page.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Rule.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/Scenario.schema.json` | `platform/scenario-engine/schemas/` | 迁移/适配 |
| `schemas/Workflow.schema.json` | `platform/knowledge-engine/schemas/` | 迁移 |
| `schemas/athena-config.schema.json` | `platform/governance-engine/config/schemas/` | 适配 |
| `schemas/page-mapping.schema.json` | `platform/page-adapter-engine/schemas/` | 扩展 v2 |
| `schemas/run-manifest.schema.json` | `platform/governance-engine/manifest/schemas/` | 扩展 v2 |

## 4. `config/`（5 个）

| 文件 | 目标 | 处置 |
| --- | --- | --- |
| `config/athena.config.json` | `runtime/environments/athena-test.json` | 拆分/迁移 |
| `config/athena.write.config.json` | `runtime/run-configs/write.example.json` | 重构（per-run） |
| `config/phase2.navigation.json` | `business-modules/purchase/page-mappings/navigation.json` + `runtime/environments/` | 拆分/迁移 |
| `config/prd-modeling.config.json` | `platform/prd-scanner/config/` + 模块包 | 拆分/迁移 |
| `config/prd-modeling.config.local.json` | 保持本地、Git 忽略 | 保留 |

## 5. `knowledge/`（6 个）

| 文件 | 目标 | 处置 |
| --- | --- | --- |
| `knowledge/athena-page-map.json` | `business-modules/*/knowledge/legacy/` | 迁移/逐步废弃 |
| `knowledge/athena-component-map.json` | `adapters/athena-web/legacy/` | 迁移/逐步废弃 |
| `knowledge/athena-business-rules.json` | 模块知识 | 迁移/逐步废弃 |
| `knowledge/athena-prd-map.json` | `platform/knowledge-engine/prd-index/legacy/` | 迁移/合并 |
| `knowledge/purchase-metadata.candidate.json` | `business-modules/purchase/knowledge/` | 迁移 |
| `knowledge/purchase-prerequisite-plan.json` | `business-modules/purchase/data-recipes/` | 迁移 |

## 6. `cases/`（7 个）

| 文件 | 目标 | 处置 |
| --- | --- | --- |
| `cases/invnt-param-readonly.json` | `business-modules/inventory/testcases/legacy/` | 迁移 |
| `cases/tp-002-invnt-param-readonly.json` | `business-modules/inventory/testcases/legacy/` | 迁移 |
| `cases/tp-064-acctg-perid-table-readonly.json` | `business-modules/finance/testcases/legacy/` | 迁移 |
| `cases/tp-064-acctg-perid-table-write.json` | `business-modules/finance/testcases/legacy/` | 迁移/重构 |
| `cases/tp-064-cleanup-hook-selftest.json` | `tests/fixtures/execution/` | 迁移 |
| `cases/tp-065-acctg-perid-info-readonly.json` | `business-modules/finance/testcases/legacy/` | 迁移 |
| `cases/tp-065-acctg-perid-info-write.json` | `business-modules/finance/testcases/legacy/` | 迁移/重构 |

## 7. 缺失但 P1 必须新增的契约

| 契约 | 目标 |
| --- | --- |
| Module Manifest | `platform/contracts/schemas/module-manifest.schema.json` |
| TestCase | `platform/contracts/schemas/test-case.schema.json` |
| DataRecipe | `platform/contracts/schemas/data-recipe.schema.json` |
| ExecutionReport | `platform/contracts/schemas/execution-report.schema.json` |
| IntegrationPack | `platform/contracts/schemas/integration-pack.schema.json` |
| ActionRegistry | `platform/contracts/schemas/action-registry.schema.json` |
| TestSuite | `platform/contracts/schemas/test-suite.schema.json` |
| ExecutionPlan | `platform/contracts/schemas/execution-plan.schema.json` |
| RunConfig | `platform/contracts/schemas/run-config.schema.json` |
| EnvironmentProfile | `platform/contracts/schemas/environment-profile.schema.json` |
| UserProfile | `platform/contracts/schemas/user-profile.schema.json` |

## 8. 说明

- “保留/逐步废弃”表示 P0/P1 不删除；迁移完成、适配器能力对齐、验收通过后再处置。
- 目标路径是建议值，P1 可在不改变三层边界的前提下微调。
- `artifacts/`、`reports/`、`probe/`、`athena-erp-test-plans/` 的目录级处理见 `P0-AS-IS.md` 与 `P0-MIGRATION-PLAN.md`。
