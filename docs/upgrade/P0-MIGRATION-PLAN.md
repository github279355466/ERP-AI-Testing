# P0 迁移计划：从现有项目到 v2.0 三层平台

> 原则：增量迁移、先契约后搬迁、先冻结后重构、一次只做一个模块。
> 本文件只定义计划，不执行迁移；P0 不修改任何现有代码。

## 1. 迁移原则

1. **不推翻重写**：现有浏览器、适配器、证据、PRD 扫描、执行器是可复用资产，优先“适配/迁移”，避免“推倒重来”。
2. **先冻结基线**：在改动前把当前工作区（含 Phase 2 未提交成果）冻结为可回溯基线。
3. **先契约后代码**：P1 先建立 Module/Scenario/TestCase/PageMapping/DataRecipe/Report/Integration/ActionRegistry Schema，再迁移实现。
4. **平台与业务分离**：采购逻辑从 `src/` 平台核心迁出到 `business-modules/purchase`；平台核心不出现采购字段/流程/选择器。
5. **双轨兼容**：迁移期间保留旧路径/旧 API 作为兼容层，新路径稳定后再废弃；P0/P1 不删除旧代码。
6. **测试先行**：每个波次先补契约/回归测试，再搬迁；不为了通过测试弱化断言。
7. **写操作冻结**：在动作级授权与审计完成前，不新增/不执行 ERP 写操作。
8. **单一事实源**：文档、Schema、知识库、模块清单各自只有一个权威位置；旧文档标记 historical/legacy。

## 2. 目标目录与当前资产映射

```text
Athena-ERP-Automation-Platform/
├── AGENTS.md
├── README.md
├── docs/
│   ├── architecture/
│   ├── contracts/
│   ├── decisions/
│   └── runbooks/
├── platform/
│   ├── prd-scanner/
│   ├── knowledge-engine/
│   ├── scenario-engine/
│   ├── testcase-engine/
│   ├── dependency-engine/
│   ├── browser-engine/
│   ├── page-adapter-engine/
│   ├── data-engine/
│   ├── execution-engine/
│   ├── assertion-engine/
│   ├── report-engine/
│   └── governance-engine/
├── adapters/
│   ├── browser/
│   ├── controls/
│   └── athena-web/
├── business-modules/
│   ├── _template/
│   └── purchase/
│       ├── source-index/
│       ├── knowledge/
│       ├── page-mappings/
│       ├── scenarios/
│       ├── testcases/
│       ├── data-recipes/
│       ├── test-suites/
│       ├── fixtures/
│       └── module.yaml
├── integration-tests/
│   ├── _template/
│   ├── purchase-to-ap/
│   ├── sales-to-ar/
│   ├── purchase-to-inventory/
│   └── sales-to-inventory/
├── runtime/
│   ├── environments/
│   ├── users/
│   └── run-configs/
├── executions/
├── reports/
├── tools/
├── tests/
│   ├── unit/
│   ├── contract/
│   ├── integration/
│   └── platform/
└── scripts/
```

### 2.1 当前 → 目标映射

| 当前资产 | 目标位置 | 迁移方式 |
| --- | --- | --- |
| `src/browser/*` | `platform/browser-engine/` + `adapters/browser/` | 迁徙通用生命周期；Athena 页签/选择器下沉 |
| `src/locator/strategy.ts` | `platform/page-adapter-engine/locator/` | 保留通用策略 |
| `src/locator/athena-profile.ts`、`selectors.ts` | `adapters/athena-web/` | 迁移 Athena 专有知识 |
| `src/adapters/*` | `platform/page-adapter-engine/controls/` + `adapters/controls/` | 保留 9 类适配器；配置化 |
| `src/controls/*` | `platform/page-adapter-engine/legacy-controls/` | 兼容层；能力对齐后废弃 |
| `src/discovery/*` | `platform/page-adapter-engine/discovery/` | 保留 candidate 生成 |
| `src/assertion/*` | `platform/assertion-engine/` | 重构来源/失败分类 |
| `src/evidence/*` | `platform/evidence/` | 迁移；补秘密/PII 策略 |
| `src/reporting/*` | `platform/report-engine/` | 重构报告分层 |
| `src/runner/readonly-executor.ts` | `platform/execution-engine/readonly/` | 迁入动作注册表 |
| `src/runner/write-executor.ts` | `platform/execution-engine/write/` | 重构动作/授权/重试 |
| `src/runner/safety-policy.ts` | `platform/governance-engine/safety/` | 重构高风险判定 |
| `src/runner/actions/master-data-actions.ts` | `platform/page-adapter-engine/actions/` | 通用化 |
| `src/environment/*` | `platform/governance-engine/runtime/` | 迁移/适配 |
| `src/session/*` | `platform/browser-engine/session/` | 迁移 |
| `src/navigation/*` | `platform/browser-engine/navigation/` | 重构为模块 page mapping + runtime env |
| `src/logging/*` | `platform/evidence/logging/` | 迁移 |
| `src/config/*` | `platform/governance-engine/config/` + `runtime/` | 拆分运行时/模块配置 |
| `src/pages/base/page-object.ts` | `platform/page-adapter-engine/page-object/` | 保留 |
| `src/pages/purchase/*` | `business-modules/purchase/page-mappings/` + `adapters/` | 迁移/重构 |
| `src/diagnostics/failure-collector.ts` | `platform/evidence/diagnostics/` | 保留 |
| `src/diagnostics/control-probe.ts` | `business-modules/purchase/tools/` | 迁移 |
| `src/diagnostics/page-recon.ts` | `business-modules/purchase/tools/` | 迁移 |
| `src/knowledge/knowledge-base.ts` | `platform/knowledge-engine/legacy/` | 兼容层 |
| `src/knowledge/prd-knowledge.ts` | `platform/knowledge-engine/query/` | 保留 |
| `src/knowledge/model-version.ts` | `platform/governance-engine/version/` | 保留 |
| `src/knowledge/page-mapper.ts` | `platform/page-adapter-engine/mapping/` | 重构去采购化 |
| `src/knowledge/prd-index.ts` | `platform/knowledge-engine/prd-index/` | 适配/合并 |
| `src/prd/scanner.ts`、`parsers.ts`、`config.ts` | `platform/prd-scanner/` | 迁移 |
| `src/prd/extract.ts`、`link.ts`、`relations.ts`、`validate.ts`、`store.ts` | `platform/knowledge-engine/` | 迁移/重构 |
| `src/prd/scenarios.ts` | `platform/scenario-engine/` | 迁移/重构 |
| `src/prd/reports.ts`、`remediation.ts`、`schema.ts` | `platform/knowledge-engine/` | 迁移/适配 |
| `src/cli/prd.ts` | `platform/cli/` | 适配 |
| `src/cli/main.ts` 通用命令 | `platform/cli/` | 拆分 |
| `src/cli/main.ts` 采购命令 | `business-modules/purchase/runner/` | 迁移 |
| `schemas/*` | `docs/contracts/`（知识模型）+ `platform/*/schemas/`（核心契约） | 分类迁移 |
| `config/athena.config.json` | `runtime/environments/athena-test.yaml` | 拆分 |
| `config/athena.write.config.json` | `runtime/run-configs/write-*.yaml` | 重构为 per-run |
| `config/phase2.navigation.json` | `business-modules/purchase/page-mappings/navigation.yaml` + `runtime/environments/` | 拆分 |
| `config/prd-modeling.config.json` | `platform/prd-scanner/config/` + 模块包 | 拆分 |
| `knowledge/athena-*.json` | `business-modules/*/knowledge/legacy/` | 迁移 |
| `knowledge/purchase-*` | `business-modules/purchase/knowledge/` | 迁移 |
| `cases/*.json` | `business-modules/*/testcases/legacy/` | 迁移 |
| `athena-erp-test-plans/*` | `business-modules/*/test-plans/` | 迁移/保留 |
| `tests/unit/*` | `tests/unit/` + `tests/contract/` | 分层 |
| `tests/integration/*` | `tests/integration/` + `tests/platform/` | 分层 |
| `tests/smoke/*` | `tests/platform/` | 迁移 |
| `scripts/start-chrome.ps1` | `tools/scripts/` | 迁移/适配 |
| `scripts/generate-prd-schemas.mjs` | `tools/schema/` | 迁移/扩展 |
| `probe/*` | `tools/probe/` | 保留/归档 |
| `artifacts/phase2/*` | `docs/acceptance/phase2/` + `executions/` | 证据归档 |
| `artifacts/acceptance/*`、`deliverables/*` | `docs/acceptance/phase1/` | 证据归档 |

## 3. 迁移策略

### 3.1 Strangler（绞杀者）而不是大爆炸

- 新平台目录先建立“壳”和契约，旧 `src/` 继续可运行。
- 每迁移一个组件，旧路径保留 re-export 或适配器，直到新路径测试通过。
- `package.json` 同时保留旧命令与新命令，逐步切换。
- 不一次性移动 87 个 TS 文件；按组件波次迁移。

### 3.2 双知识库策略

- `knowledge/athena-*.json`（legacy）与 `artifacts/knowledge/*.json`（Phase 1）继续并存到 P2。
- P1 建立统一 `KnowledgeQuery` 接口，两个实现都实现该接口。
- P2 将 legacy 页面知识迁入模块包，Phase 1 知识库作为主模型；legacy 只读兼容。

### 3.3 双控件层策略

- `src/adapters` 作为主控件层继续演进。
- `src/controls` 作为只读兼容层，不再新增能力。
- P4 完成适配器对 legacy 用例的覆盖后，标记 `src/controls` deprecated；P6 再评估删除。

### 3.4 采购模块迁移策略

- P1 只建立 `business-modules/purchase/module.yaml` 与资产索引，不搬代码。
- P2 把采购知识/来源索引/场景迁入模块包。
- P3 把采购测试计划/用例迁入模块包。
- P4 把采购页面对象/flow/诊断迁入模块包，平台只保留通用页面对象基类。
- P6 用模块包跑采购验收；平台核心做纯度审计。

## 4. 迁移波次

### Wave 0：基线冻结与文档治理（P0/P1 交界）

目标：让后续迁移可回溯、可回滚。

任务：

1. 记录当前 Git 状态、文件哈希、知识库批次、依赖版本、测试结果。
2. 将 Phase 2 未提交成果提交为基线（需人工确认提交范围）。
3. 创建 `docs/architecture/`、`docs/contracts/`、`docs/decisions/`、`docs/runbooks/`。
4. 标记旧文档为 historical/legacy，指定单一事实源。
5. 建立 `docs/upgrade/` 索引（本目录）。

退出条件：

- 当前代码/配置/证据有可回溯基线。
- 文档不再出现两个互相矛盾的“当前架构”。

### Wave 1：平台骨架与契约治理（P1）

目标：建立 v2.0 的“骨架”，不迁移业务实现。

任务：

1. 创建目标目录骨架与 `_template` 模块包/集成包。
2. 定义 ModuleManifest、Scenario、TestCase、PageMapping、DataRecipe、ExecutionReport、IntegrationPack、ActionRegistry、Suite、RunConfig、EnvironmentProfile、UserProfile Schema。
3. 实现 Schema validator 与 `platform:validate` CLI。
4. 实现版本兼容检查（platform API / module pack / integration pack）。
5. 定义错误分类、日志、runId、run manifest v2（6 状态）。
6. 拆分运行时环境配置与模块配置；移除 tracked 本机绝对路径。
7. 建立 contract tests、CI 基线。
8. 建立采购模块 manifest 骨架（只登记资产，不搬代码）。

退出条件：

- 空白示例模块通过校验；缺字段/错类型/版本不兼容被拒绝。
- 采购资产索引可被 manifest 引用，但采购代码仍在原位。
- 无 ERP 连接、无写操作。

### Wave 2：PRD/知识引擎平台化（P2）

目标：让扫描/知识引擎可服务任意模块。

任务：

1. 迁移 `src/prd/scanner.ts`、`parsers.ts`、`config.ts` 到 `platform/prd-scanner`。
2. 迁移 `extract/link/relations/validate/store` 到 `platform/knowledge-engine`。
3. 把 `RELATION_DOC_NAMES`、`PURCHASE_NODES`、模块规则从平台代码移到模块包配置。
4. 建立模块级 source-index、knowledge、OQ、覆盖率。
5. 冻结 Phase 1 知识快照（版本、哈希、生成时间、已知残余）。
6. 补独立语义抽检计划（不要求本轮执行）。
7. 评估 DOCX/XLSX/PDF 解析适配器；TXT 用真实样本验证。

退出条件：

- 可指定任意模块 PRD 目录扫描。
- 采购模块知识可由模块包配置驱动。
- 平台代码不再出现采购单据名/采购字段名。
- Phase 1 知识快照可复现、可追溯。

### Wave 3：场景/用例/依赖编排（P3）

目标：从 DRAFT 场景走向可评审、可执行计划。

任务：

1. 迁移 `scenarios.ts` 到 `platform/scenario-engine`，去采购化。
2. 建立场景评审工作流（DRAFT → REVIEW_REQUIRED → APPROVED/REJECTED）。
3. 建立 TestCase 编译器（Scenario + Knowledge → TestCase）。
4. 建立依赖图/DAG/拓扑/循环检测/失败传播。
5. 建立套件、Dry-run、执行计划输出。
6. 把 73 份测试计划与外部用例库作为输入，不直接执行。

退出条件：

- 每条正式用例有来源引用。
- 未审批用例不能进入正式套件。
- DAG 排序正确，循环/缺失依赖可检测。
- Dry-run 不启动浏览器、不访问 ERP、不写数据。

### Wave 4：浏览器/页面适配/数据准备（P4）

目标：把 Phase 2 底座变成真正的通用页面适配与 UI 造数能力。

任务：

1. 迁移 browser/session/navigation/environment 到 `platform/browser-engine`。
2. 把 navigation 数据拆为 `runtime/environments` + 模块 `page-mappings`。
3. 迁移 9 类适配器到 `platform/page-adapter-engine/controls`，保留 `adapters/controls` 兼容。
4. 把 `AthenaProfile`/selectors 迁到 `adapters/athena-web`。
5. 实现定位唯一性、降级原因、`allowFixedCoordinates` 策略。
6. 迁移采购页面对象/flow/诊断到 `business-modules/purchase`。
7. 建立 DataRecipe Schema/执行器、批次/runId 前缀、幂等检查、清理计划/审计。
8. 修复审核/删除授权绕过；写操作默认冻结。

退出条件：

- 浏览器/控件可在独立 smoke 中验证。
- 采购页面对象不再位于平台核心。
- 所有业务数据创建经 UI，有配方/批次/清理记录。
- 定位失败有诊断；不静默跳过。

### Wave 5：执行/断言/报告（P5）

目标：端到端执行经评审的用例并输出可追溯报告。

任务：

1. 迁移/重构 readonly/write executor 到 `platform/execution-engine`。
2. 建立动作注册表：动作类型、参数 Schema、风险级别、重试安全性、幂等性。
3. 实现套件/DAG 调度、串行优先、受控并发、超时、取消、失败传播。
4. 实现断言来源绑定（规则/PRD/批准设计）、预期/实际/证据。
5. 统一状态：`passed/failed/blocked/skipped/cancelled/error`。
6. 实现模块报告、集成报告、回归总览、版本组合、失败分类。
7. 报告记录数据准备/清理、平台/模块/用例/环境版本。

退出条件：

- 一次运行生成完整可追溯报告。
- 失败步骤有截图/trace。
- 数据准备失败与业务断言失败可区分。
- 非幂等写操作不自动重试。

### Wave 6：采购模块验收与平台固化（P6）

目标：用采购验证平台通用性，并证明第二模块可接入。

任务：

1. 采购模块包独立加载/校验/执行。
2. 至少一条采购主流程 + 关键异常/边界，范围以 PRD/页面能力为准。
3. 供应商/品号/仓库等基础资料 UI 选择与造数。
4. 采购单据新增、查询、修改、审核/撤审等已批准动作。
5. 依赖、断言、证据、报告。
6. 第二模块最小接入演练（销售或库存，视 PRD 成熟度）。
7. 平台纯度审计：平台核心无采购字段/流程/选择器。
8. 输出模块接入指南与已知限制。

退出条件：

- 采购模块包可独立加载/校验/执行。
- 平台核心无采购专属逻辑。
- 第二模块只需新增模块资产和必要适配器扩展。
- 报告能识别平台/模块/用例版本。
- 采购结果来自真实 UI，不用 mock 冒充。

## 5. 依赖顺序

```text
Wave 0 基线冻结
  → Wave 1 契约/骨架
  → Wave 2 PRD/知识平台化
  → Wave 3 场景/用例/依赖
  → Wave 4 浏览器/页面/数据
  → Wave 5 执行/断言/报告
  → Wave 6 采购验收/第二模块演练
```

硬依赖：

- Wave 1 的 ModuleManifest/TestCase/DataRecipe/Report Schema 是 Wave 2-5 的前置。
- Wave 3 的 TestCase/DAG 是 Wave 5 执行计划的前置。
- Wave 4 的 DataRecipe/页面映射是 Wave 6 采购验收的前置。
- Wave 5 的断言来源绑定是 Wave 6 采购验收的前置。

软依赖：

- Wave 2 可与 Wave 4 的页面侦察并行，但知识冻结必须先于采购验收。
- Wave 3 可与 Wave 4 的适配器收敛并行，但 TestCase 编译器要先有契约。

## 6. 不迁移/废弃策略

| 资产 | 策略 | 时间点 |
| --- | --- | --- |
| `src/controls/*` | 兼容层，不再新增；适配器覆盖后 deprecated | P4/P6 |
| `src/knowledge/knowledge-base.ts` | legacy 读取层，保留兼容 | P2/P6 |
| `knowledge/athena-*.json` | 迁移到模块包 legacy；新模块不再使用 | P2/P6 |
| `cases/*.json` | 迁移为 v2 TestCase；旧格式只读 | P3/P6 |
| `config/athena.write.config.json` | 废弃全局写配置，改 per-run | P1/P4 |
| `config/phase2.navigation.json` | 拆分后废弃 | P4 |
| `src/prd/relations.ts` 采购常量 | 删除/外置 | P2 |
| `src/prd/scenarios.ts` `PURCHASE_NODES` | 删除/外置 | P3 |
| `src/diagnostics/control-probe.ts`、`page-recon.ts` | 迁入采购模块，不留在平台 | P4 |
| `src/cli/main.ts` 采购命令 | 迁入模块 runner | P4 |
| `.workbuddy/memory/*` | 归档，不作为权威 | P1 |
| `probe/*` | 保留为工具/证据，不进运行时 | 持续 |

## 7. 风险控制

| 风险 | 控制 |
| --- | --- |
| 迁移导致现有 Phase 2 能力回退 | 每个组件迁移前先固化回归测试；旧路径保留 re-export |
| 采购业务中断 | 采购模块迁移放在 P4/P6；之前保持现有 CLI/页面对象可运行 |
| 知识库口径漂移 | P2 冻结快照 + 哈希清单；报告固定记录批次 |
| 写操作误触发 | P1 起写操作冻结；先补授权/审计再恢复 |
| 文档再次分叉 | P1 建立单一事实源；旧文档标 legacy |
| 迁移范围失控 | 每波次有明确退出条件；未通过不进入下一波 |

## 8. 人工确认点

在开始 P1 前，需要确认：

1. 是否授权冻结当前工作区为基线提交/标签。
2. 是否接受“P1 只建骨架与契约、不迁移业务实现”的范围。
3. 是否接受采购模块包目录与命名。
4. 是否接受 Phase 1 知识库先作为“候选冻结快照”。
5. 是否确认 P6 采购验收范围与第二模块演练对象。
6. 是否确认写操作冻结，直到动作级授权/审计完成。
7. 是否确认现有 Phase 2 测试数据的保留/清理策略。

详见 `P0-DECISIONS.md`。
