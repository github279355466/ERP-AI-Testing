# P1 详细实施计划：平台骨架与契约治理

> 状态：已完成，验收结果见 `docs/acceptance/P1-ACCEPTANCE.md`。
> 范围：v2.0 P1“平台骨架与契约治理”。
> 不在本阶段：PRD 引擎重写、场景/用例生成、ERP 执行、采购业务迁移、写操作。

## 1. P1 目标

建立 v2.0 三层架构的“骨架”和“契约”，使后续 P2-P6 可以在稳定边界上增量建设：

1. 目标目录与模块包/集成包模板。
2. Module Manifest、Scenario、TestCase、Page Mapping、Data Recipe、Execution Report、Integration Pack、Action Registry、Suite、Run Config 等核心契约。
3. Schema validator、版本兼容检查、示例资产。
4. 运行配置拆分、错误分类、runId、run manifest v2。
5. 契约测试、CI 基线、文档单一事实源。

## 2. P1 非目标

- 不重写 Phase 1 PRD 扫描/知识抽取。
- 不实现场景评审、用例编译器、DAG、Dry-run（P3）。
- 不实现 DataRecipe 执行器、页面适配器迁移（P4）。
- 不实现执行调度、断言来源绑定、报告分层（P5）。
- 不迁移采购页面对象/flow/诊断（P4/P6）。
- 不执行任何 ERP 连接、导航、点击、写入。
- 不删除 `src/controls`、`knowledge/athena-*.json`、`cases/*.json` 等 legacy 资产。

## 3. P1 交付物

```text
docs/
├── architecture/
│   ├── AS-IS.md                 # 引用 P0-AS-IS，不重复事实
│   ├── TO-BE.md                 # v2.0 三层架构与边界
│   └── BOUNDARIES.md            # 平台/模块/集成边界
├── contracts/
│   ├── README.md
│   ├── module-manifest.md
│   ├── scenario.md
│   ├── test-case.md
│   ├── page-mapping.md
│   ├── data-recipe.md
│   ├── execution-report.md
│   ├── integration-pack.md
│   └── action-registry.md
├── decisions/
│   └── ADR-*.md
└── runbooks/
    ├── validate-contracts.md
    └── module-onboarding.md

platform/
├── contracts/
│   ├── schemas/
│   │   ├── module-manifest.schema.json
│   │   ├── scenario.schema.json
│   │   ├── test-case.schema.json
│   │   ├── page-mapping.schema.json
│   │   ├── data-recipe.schema.json
│   │   ├── execution-report.schema.json
│   │   ├── integration-pack.schema.json
│   │   ├── action-registry.schema.json
│   │   ├── test-suite.schema.json
│   │   ├── execution-plan.schema.json
│   │   ├── run-config.schema.json
│   │   ├── environment-profile.schema.json
│   │   └── user-profile.schema.json
│   ├── examples/
│   └── validator.ts
├── governance-engine/
│   ├── version/
│   └── run-manifest/
└── cli/

business-modules/
├── _template/
│   ├── module.yaml
│   ├── source-index/
│   ├── knowledge/
│   ├── page-mappings/
│   ├── scenarios/
│   ├── testcases/
│   ├── data-recipes/
│   ├── test-suites/
│   └── fixtures/
└── purchase/
    ├── module.yaml              # 先只登记资产，不搬代码
    └── ASSET-INDEX.md

integration-tests/
└── _template/
    └── integration.yaml

runtime/
├── environments/
├── users/
└── run-configs/

tests/
├── contract/
└── platform/

scripts/
└── validate-contracts.mjs        # 可选，CLI 入口也可直接 node dist
```

## 4. 工作拆分

### P1-01 基线冻结与快照

- 目标：让 P1 改动可回溯、可回滚。
- 输入：当前 Git 状态（HEAD 899b14d，Phase 2 已提交）、P0 文档状态、知识库批次、测试结果。
- 任务：
  1. 记录 `git status`、`HEAD`、文件清单、知识库 `generated_at`、`KM-*`、测试计数。
  2. 与用户确认提交范围（建议：源码/测试/配置/文档；`probe/` 诊断文件本地保留）。
  3. 创建基线提交/标签（需人工授权）。
  4. 生成 `docs/upgrade/baseline-manifest.json`（可选）记录文件 SHA-256。
- 产物：基线提交/标签、baseline manifest。
- 验收：可从基线复现 `typecheck/build/test:unit/test:integration`。
- 风险：基线标签遗漏 P0 文档；提交范围不当把临时证据带入 Git。
- 依赖：无。
- 工作量：S。

### P1-02 文档信息架构与单一事实源

- 目标：消除 README/ARCHITECTURE/PHASE2/memory 互相矛盾。
- 任务：
  1. 建立 `docs/architecture/`、`docs/contracts/`、`docs/decisions/`、`docs/runbooks/`、`docs/legacy/`。
  2. `AS-IS.md` 引用 P0 报告；`TO-BE.md` 描述三层架构；`BOUNDARIES.md` 明确平台/模块/集成边界。
  3. 旧文档加 `status: historical/legacy`，指定替代文档。
  4. 更新 `AGENTS.md`：三层架构、模块包规则、写操作冻结、契约优先。
  5. 更新 `README.md`：只保留当前有效入口与命令。
- 产物：docs IA + AGENTS/README 更新。
- 验收：任意“当前架构/当前状态”问题只有一个权威文档；旧文档不再被当作事实源。
- 风险：文档迁移遗漏；旧链接失效。
- 依赖：P1-01。
- 工作量：M。

### P1-03 目标目录骨架与兼容层

- 目标：建立目标目录，但不搬迁业务实现。
- 任务：
  1. 创建 `platform/`、`adapters/`、`business-modules/`、`integration-tests/`、`runtime/`、`executions/`、`reports/`、`tools/`、`tests/contract/`、`tests/platform/`。
  2. 创建 `platform/README.md` 说明各引擎边界。
  3. 旧 `src/` 保持可运行；新目录先放 README/占位/契约，不复制实现。
  4. 在 `tsconfig`/`package.json` 中预留路径别名/脚本，不破坏现有构建。
- 产物：目录骨架 + 边界说明。
- 验收：`npm run build` 仍通过；旧 CLI 仍可运行；新目录无业务逻辑。
- 风险：空目录被误认为已实现；路径别名影响构建。
- 依赖：P1-01。
- 工作量：S。

### P1-04 核心契约 Schema

- 目标：定义 v2.0 核心数据契约。
- 任务：
  1. `module-manifest.schema.json`：schema_version、module id/name/version/status/owner/description、compatibility.platform_api、sources、assets。
  2. `scenario.schema.json`：id、module_id、title、business_goal、source_refs、preconditions、business_flow、risk_level、status、tags。
  3. `test-case.schema.json`：id/module_id/version、title/objective、scenario_refs/source_refs、preconditions、data_recipe_refs、dependencies、steps、assertions、cleanup_policy、status、timeout、retry_policy。
  4. `page-mapping.schema.json` v2：module_id、page_key、route/menu_path、work_item_code、locator_priority、fields、controls、uniqueness、review_status。
  5. `data-recipe.schema.json`：entities、create_order、references、uniqueness_strategy、reuse_policy、cleanup、rollback_notes、assertions。
  6. `execution-report.schema.json`：run/module/integration、status、steps、assertions、evidence、failure_category、data_preparation、cleanup、versions。
  7. `integration-pack.schema.json`：id、module_dependencies、business_goal、steps、data_mapping、assertions、cleanup_policy、failure_propagation。
  8. `action-registry.schema.json`：action type、parameters、risk_level、retry_safe、idempotent、requires_authorization、evidence_policy。
  9. `test-suite.schema.json`、`execution-plan.schema.json`、`run-config.schema.json`、`environment-profile.schema.json`、`user-profile.schema.json`。
- 产物：12 个 Schema + 示例 + 契约文档。
- 验收：示例通过；缺字段/错类型/不兼容版本被拒绝；采购字段不出现在通用 Schema。
- 风险：Schema 过度设计；与现有 Phase 1 Schema 命名冲突。
- 依赖：P1-03。
- 工作量：L。

### P1-05 契约校验器与 CLI

- 目标：让契约可执行校验。
- 任务：
  1. 使用 ajv Draft 2020-12 实现 `platform/contracts/validator.ts`。
  2. 实现 `platform:validate` / `module:validate` / `integration:validate` 命令。
  3. 输出结构化结果：文件、schema、passed/failed、错误码、路径。
  4. 支持目录扫描（模块包/集成包）和单文件校验。
  5. 失败退出码非 0；不得静默跳过。
- 产物：validator + CLI + 示例。
- 验收：正常样例通过；缺字段/错类型/非法 status/版本不兼容失败；退出码正确。
- 风险：Schema `$ref` 解析；Windows 路径。
- 依赖：P1-04。
- 工作量：M。

### P1-06 版本兼容与资产加载

- 目标：防止运行时静默加载不兼容资产。
- 任务：
  1. 定义平台 API 版本（如 `1.0.0`）与模块 manifest `compatibility.platform_api` 范围。
  2. 实现 semver 范围检查（可复用轻量实现，不引入大依赖）。
  3. 加载模块/集成包时校验 schema_version、module version、platform compatibility。
  4. 不兼容时拒绝并输出原因；不得降级/忽略。
- 产物：版本检查 + 测试。
- 验收：兼容通过；不兼容拒绝；错误信息包含期望/实际版本。
- 风险：semver 实现边界；旧 manifest 无版本字段。
- 依赖：P1-04/P1-05。
- 工作量：M。

### P1-07 运行时配置拆分

- 目标：把环境、用户、运行配置、模块页面映射分开。
- 任务：
  1. `runtime/environments/athena-test.json`：环境名、type、baseUrl、tenant、applicationCode、lowcodeHost、allowed/blocked origins。
  2. `runtime/users/`：只存用户名/角色/组织标识，不存密码；凭据引用环境变量键名。
  3. `runtime/run-configs/`：只读/写/高风险授权 profile；写配置改为 per-run。
  4. 模块页面导航迁到 `business-modules/purchase/page-mappings/`（P1 可先建空/索引，P4 迁实现）。
  5. 移除 tracked 配置中的本机绝对 PRD 路径；改为环境变量/占位符。
- 产物：runtime 配置 + 迁移说明。
- 验收：无凭据入库；环境/用户/运行配置分离；旧配置仍可兼容。
- 风险：旧 CLI 读取路径变化；配置重复。
- 依赖：P1-03。
- 工作量：M。

### P1-08 run manifest v2、错误分类与日志

- 目标：让运行结果可审计、可分类。
- 任务：
  1. 定义 manifest v2：runId、platformVersion、modulePackVersions、integrationPackVersions、environment、operator、testCaseId、startedAt/finishedAt、outcome、failureCategory、createdDocuments、dataRecipeRuns、cleanupStatus、evidenceFiles。
  2. 统一状态：`passed/failed/blocked/skipped/cancelled/error`。
  3. 失败分类：环境/登录、数据准备、步骤/动作、断言、平台异常、人工阻塞。
  4. 保持 v1 manifest 兼容读取（adapter）。
  5. 日志结构化 JSONL；脱敏；不记录密码/Cookie/Token。
- 产物：manifest v2 schema + adapter + 测试。
- 验收：v2 合法/非法样例；v1 可读；失败分类可枚举。
- 风险：现有 `RunResult`/报告类型需同步。
- 依赖：P1-04。
- 工作量：M。

### P1-09 模块包/集成包模板

- 目标：让第二个模块可以“只加资产，不改平台”。
- 任务：
  1. `business-modules/_template/module.yaml` + 空目录 + README。
  2. `integration-tests/_template/integration.yaml` + README。
  3. 模板包含：source-index、knowledge、page-mappings、scenarios、testcases、data-recipes、test-suites、fixtures。
  4. 模板通过 validator；不包含采购/销售等具体业务字段。
- 产物：模板 + 示例。
- 验收：空白模板通过；复制模板即可开始新模块；模板无业务字段。
- 风险：模板过度复杂。
- 依赖：P1-04/P1-05。
- 工作量：S。

### P1-10 采购模块 manifest 骨架

- 目标：登记采购资产，不搬代码。
- 任务：
  1. 创建 `business-modules/purchase/module.yaml`：id `purchase`、name 采购管理、version `0.1.0`、status `draft`、compatibility `>=1.0.0 <2.0.0`。
  2. 创建 `ASSET-INDEX.md`：列出现有采购资产位置（`src/pages/purchase`、`config/phase2.navigation.json`、`knowledge/purchase-*`、`athena-erp-test-plans/plans/采购管理-*`、`cases`、`artifacts/phase2`）。
  3. 不移动代码；不修改采购实现。
- 产物：采购 manifest + 资产索引。
- 验收：manifest 通过校验；索引与实际路径一致；平台核心无新增采购逻辑。
- 风险：索引过期；误以为已迁移。
- 依赖：P1-04/P1-05。
- 工作量：S。

### P1-11 契约测试与 CI 基线

- 目标：让契约治理可持续。
- 任务：
  1. `tests/contract/`：每个 Schema 的正向/负向样例；版本兼容；目录扫描。
  2. `tests/platform/`：不连接 ERP 的平台自检。
  3. `package.json` 增加 `test:contract`、`test:platform`、`platform:validate`；`engines: { node: ">=22" }`。
  4. CI（如 GitHub Actions/本地脚本）：`npm ci`、`typecheck`、`build`、`test:unit`、`test:contract`；不跑 ERP。
  5. 保留现有 139 unit + 27 integration。
- 产物：contract tests + CI 配置。
- 验收：契约测试全绿；非法样例必失败；CI 可复现。
- 风险：CI 环境无 Windows Chrome；只跑无浏览器测试。
- 依赖：P1-04/P1-05/P1-06。
- 工作量：M。

### P1-12 P1 验收报告与文档更新

- 目标：按阶段门禁收口。
- 任务：
  1. 输出 `docs/acceptance/P1-ACCEPTANCE.md`。
  2. 更新 README/AGENTS/架构/契约/runbook。
  3. 记录变更文件清单、测试结果、契约样例结果、已知问题。
  4. 给出 P2 计划，但不执行 P2。
- 产物：P1 验收报告 + 更新文档。
- 验收：P1 指标逐项通过；无 ERP 连接；无写操作；无破坏性代码改动。
- 风险：文档再次分叉。
- 依赖：P1-01~P1-11。
- 工作量：S。

## 5. 实施顺序

```text
P1-01 基线冻结
  → P1-02 文档 IA
  → P1-03 目录骨架
  → P1-04 核心契约
  → P1-05 校验器
  → P1-06 版本兼容
  → P1-07 配置拆分
  → P1-08 manifest v2
  → P1-09 模块/集成模板
  → P1-10 采购 manifest 骨架
  → P1-11 契约测试/CI
  → P1-12 验收报告
```

可并行：

- P1-07 与 P1-09/P1-10 可在 P1-04 后并行。
- P1-11 的测试框架可在 P1-05 后开始，随 Schema 增加补齐。

## 6. P1 验收标准

对照 `06-阶段验收标准.md` P1：

| 指标 | 通过标准 | P1 证据 |
| --- | --- | --- |
| 契约覆盖 | Module、Scenario、TestCase、PageMapping、DataRecipe、Report 均有 schema | `platform/contracts/schemas/*.schema.json` |
| 校验器 | 正常样例通过，缺字段/错类型/不兼容版本失败 | `tests/contract/` + `platform:validate` 输出 |
| 模块隔离 | 采购业务字段不进入通用 schema | Schema review + 模板无业务字段 |
| 自动化测试 | 契约校验核心路径全部通过 | `test:contract` 全绿 |
| 示例模块 | 空白示例模块通过契约校验 | `business-modules/_template` |
| 采购资产 | 可逐步迁入新契约 | `business-modules/purchase/module.yaml` + `ASSET-INDEX.md` |
| 代码变更 | 不破坏现有构建/测试 | `typecheck/build/test:unit/test:integration` |
| 无 ERP | 不连接、不启动浏览器、不写业务数据 | 命令/日志证据 |

## 7. P1 风险与缓解

| 风险 | 等级 | 缓解 |
| --- | --- | --- |
| Schema 过度设计 | 中 | 先覆盖 v2.0 必填字段，P3/P4 再扩展；每个 Schema 有最小示例 |
| 目录骨架空转 | 中 | P1 只建骨架，不宣称实现；P1 验收以契约/校验器为主 |
| 旧代码兼容破坏 | 高 | 不移动业务实现；旧路径保留；每次提交跑全量单测 |
| 版本检查过严 | 中 | 先支持 `>=1.0.0 <2.0.0`；旧 manifest 通过 adapter |
| 文档再次分叉 | 中 | 旧文档标 legacy；ADR 记录变更；P1 验收检查链接 |
| 采购资产索引过期 | 低 | P1 只登记，P4 迁移时更新；加校验脚本可选 |
| CI 无浏览器 | 低 | P1 CI 只跑 unit/contract；smoke 手动 |

## 8. P1 工作量与里程碑

| 里程碑 | 包含任务 | 产出 |
| --- | --- | --- |
| M1 基线/文档 | P1-01/P1-02 | 基线、文档 IA |
| M2 骨架/契约 | P1-03/P1-04/P1-05 | 目录、12 Schema、validator |
| M3 版本/配置/运行 | P1-06/P1-07/P1-08 | 版本检查、runtime 配置、manifest v2 |
| M4 模板/采购骨架 | P1-09/P1-10 | 模块/集成模板、采购 manifest |
| M5 测试/验收 | P1-11/P1-12 | contract tests、CI、P1 验收 |

工作量级：S（1-2 天）、M（3-5 天）、L（5-10 天），仅用于排序，不作为承诺。

## 9. P1 停止条件

- P1-12 验收报告生成后立即停止。
- 不自动进入 P2。
- 不自动迁移采购代码。
- 不自动执行 ERP。
- 等待人工确认 P2 范围。
