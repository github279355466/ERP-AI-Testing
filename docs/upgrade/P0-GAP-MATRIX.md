# P0 差距矩阵：当前项目 vs v2.0 三层架构

> 对照基线：`docs/plan/Athena-ERP-Automation-Platform-Upgrade-v2.0/`
> 盘点基线：`P0-AS-IS.md`
> 结论日期：2026-11-08

## 1. 总结论

v2.0 要求的三层结构是：

1. **Platform Core**：通用扫描、知识、场景、用例、依赖、浏览器、页面适配、数据、执行、断言、报告、治理。
2. **Business Module Packs**：采购、销售、库存、应收、应付、生产等模块独立接入。
3. **Integration Test Packs**：采购到应付、销售到应收、采购到库存等跨模块链路。

当前项目：

- **Platform Core 有较好的“零件”**：浏览器、适配器、证据、PRD 扫描、知识抽取、场景草案、只读/写入执行器。
- **Platform Core 没有“骨架”**：没有模块清单、没有统一契约、没有依赖 DAG、没有数据配方、没有治理层、没有模块/集成报告。
- **Business Module Packs 不存在**：采购资产散落在 `src/pages/purchase`、`config/phase2.navigation.json`、`knowledge/purchase-*`、`athena-erp-test-plans`、`cases`、`artifacts`。
- **Integration Test Packs 不存在**：Phase 2 的采购单证链路是单模块 E2E，不是跨模块集成包。

按 12 个平台核心组件粗略评级：

| 评级 | 数量 | 组件 |
| --- | ---: | --- |
| 强/可复用基础 | 3 | browser-engine、page-adapter-engine、prd-scanner |
| 部分具备 | 6 | knowledge-engine、scenario-engine、data-engine、execution-engine、assertion-engine、report-engine |
| 基本缺失 | 3 | testcase-engine（正式契约）、dependency-engine、governance-engine |

> 说明：这是“能力成熟度”评级，不是代码质量评级。强/可复用也不等于无需改造，采购耦合和安全缺口仍需处理。

## 2. Platform Core 组件矩阵

| v2.0 组件 | v2.0 要求 | 当前资产 | 差距 | 评级 | 目标阶段 |
| --- | --- | --- | --- | --- | --- |
| `prd-scanner` | 任意模块 PRD 目录递归扫描、文件索引、版本/时间/章节定位、增量扫描 | `src/prd/scanner.ts`、`parsers.ts`、`config.ts`；540 文件/333 文档/0 解析错误 | 模块规则硬编码；无模块 manifest；无 docx/xlsx/pdf；TXT 无真实样本；无模块级扫描范围 | 强/部分 | P2 |
| `knowledge-engine` | 实体/字段/规则/流程/状态/关系模型、来源追溯、冲突/缺失/歧义 | `src/prd/extract.ts`、`link.ts`、`relations.ts`、`validate.ts`、`store.ts`、`PrdKnowledgeBase`；13 类对象/33,510 证据 | 采购单据名硬编码；481 依赖未解析；620 OQ（33 HIGH）；语义复验未闭环；两套知识库 | 部分 | P2 |
| `scenario-engine` | 知识 → 候选场景，来源可追溯，状态治理 | `src/prd/scenarios.ts`；3,204 DRAFT 场景 | 采购节点硬编码；无评审工作流；无用例编译器；无覆盖设计闭环；`UI_READY=0` | 部分 | P3 |
| `testcase-engine` | 用例结构、步骤、前置、断言、依赖、清理、超时/重试、版本 | `src/runner` DSL、`cases/*.json`、外部用例库、`test-cases.v2.schema.json` 评估 | 无正式 TestCase Schema；无版本/来源/依赖/清理策略；外部用例库未编译；用例混模块 | 缺失/部分 | P1/P3 |
| `dependency-engine` | 依赖图、DAG、拓扑排序、循环检测、失败传播、跨模块版本 | `dependencies.json` 850 条；`DERIVED_FROM` 12 条 | 只有数据，无图算法/执行计划/循环检测/版本兼容；481 条 target 未解析 | 缺失 | P3 |
| `browser-engine` | 生命周期、登录态、上下文、截图、trace、等待、重试 | `src/browser`、`session`、`navigation`、`environment`、`evidence`；P2.0/P2.1 通过 | 单一导航文件；采购默认页；CORS `--disable-web-security`；direct token 回退；无多环境/多账号 profile；retry 未用 | 强/部分 | P1/P4 |
| `page-adapter-engine` | 页面对象、控件适配、定位策略、等待策略、唯一性检查 | `src/adapters` 9 类、`AthenaProfile`、`src/pages/base`；27 fixture 测试通过 | 定位不强制唯一；box 偏移硬编码；`allowFixedCoordinates` 未用；controls/adapters/raw locator 三套并存；页面映射采购专用 | 强/部分 | P4 |
| `data-engine` | 数据配方、创建顺序、关联键、唯一性、幂等、清理、审计 | `master-data-actions`、`write-executor` cleanup DSL；Phase 2 手工造数 | 无 DataRecipe Schema/执行器；无批次/运行标识/幂等检查；无清理计划/审计；Phase 2 数据保留 | 部分/缺失 | P4 |
| `execution-engine` | 套件调度、依赖、重试、超时、取消、失败传播、并发 | `readonly-executor`、`write-executor`、CLI 命令 | 串行单用例；无 DAG/套件/取消/恢复；无动作级重试安全；审核可绕过授权；无执行计划 | 部分 | P5 |
| `assertion-engine` | UI 可观察断言、预期/实际/来源、证据绑定、失败分类 | `assertion-engine.ts`；flow 内 ad-hoc assertions | 无 source_ref/规则绑定；无失败分类；预期值多来自硬编码；无断言库/契约 | 部分 | P5 |
| `report-engine` | Markdown/HTML/JSON、模块/集成/回归、版本组合、覆盖率、缺陷线索 | `reporting/*`；Markdown/HTML | 无模块/集成分层；无版本组合；无数据准备/清理；无失败分类；无报告 Schema | 部分 | P5 |
| `governance-engine` | 审批状态、版本、审计、风险控制、模块发布 | `schemas` 部分、`safety-policy`、`run-manifest` | 无审批工作流；无模块/包版本兼容；无 per-case 授权；无审计流水；无发布治理 | 缺失 | P1 |

## 3. 三层资产差距

### 3.1 Platform Core

| 能力 | 现状 | 差距 |
| --- | --- | --- |
| 通用浏览器运行时 | 有 | 需多环境/多账号、失败重试、取消、并发策略 |
| 通用控件库 | 有 9 类 | 需配置驱动、唯一性、控件扩展契约、真实页面覆盖矩阵 |
| 通用页面适配 | 有 base + AthenaProfile | 需模块 page mapping 加载、差异分类、评审状态 |
| 通用执行 | 有只读/写入执行器 | 需动作注册表、风险级别、幂等、重试安全、授权 |
| 通用断言 | 有基础 | 需来源绑定、失败分类、断言库 |
| 通用报告 | 有 Markdown/HTML | 需模块/集成报告、版本组合、覆盖率、趋势 |
| 通用治理 | 有门禁/manifest | 需审批、版本兼容、审计、发布 |

### 3.2 Business Module Packs

**不存在。**

当前采购资产分布：

| 资产 | 当前位置 | 应归属 |
| --- | --- | --- |
| 采购页面对象/流程 | `src/pages/purchase/*` | `business-modules/purchase/page-mappings` + adapters |
| 采购页面导航 | `config/phase2.navigation.json` | `business-modules/purchase/page-mappings` |
| 采购控件/页面侦察 | `src/diagnostics/control-probe.ts`、`page-recon.ts` | `business-modules/purchase/tools` |
| 采购 CLI 命令 | `src/cli/main.ts` | 模块 runner/CLI 插件 |
| 采购知识 | `knowledge/purchase-*`、`artifacts/knowledge` 中采购实体 | `business-modules/purchase/knowledge` |
| 采购测试计划 | `athena-erp-test-plans/plans/采购管理-*` | `business-modules/purchase/test-plans` |
| 采购用例/数据 | `cases/*`、`artifacts/phase2` | `business-modules/purchase/testcases` / `data-recipes` |
| 采购模块清单 | 不存在 | `business-modules/purchase/module.yaml` |

第二模块（销售/库存/应收/应付/生产）没有任何模块包骨架。

### 3.3 Integration Test Packs

**不存在。**

| 链路 | 现状 | 差距 |
| --- | --- | --- |
| purchase-to-ap | 无 | 需引用 purchase + ap 模块资产、跨模块数据传递、端到端断言 |
| sales-to-ar | 无 | 同上 |
| purchase-to-inventory | 无 | 同上 |
| sales-to-inventory | 无 | 同上 |

Phase 2 的采购订单→到货→入库→退货是单模块单证链路，不是跨模块集成包；且退货/出库未闭环。

## 4. 契约差距

| v2.0 契约 | 现有 | 状态 | 差距 | P1 动作 |
| --- | --- | --- | --- | --- |
| Module Manifest `module.yaml` | 无 | 缺失 | 无模块 id/version/status/owner/compatibility/assets | 新增 Schema + 示例 + 校验器 |
| Scenario | `schemas/Scenario.schema.json`（Phase 1） | 部分 | 字段名/状态与 v2 场景契约未对齐；无模块包引用 | 对齐/扩展；保留来源追溯 |
| Test Case | 无正式契约；`ReadonlyStep`/`WriteStep`/`cases/*.json` | 缺失/部分 | 无 version/source_refs/dependencies/cleanup_policy/timeout/retry_policy | 新增 TestCase Schema + 编译器接口 |
| Page Mapping | `schemas/page-mapping.schema.json` | 部分 | 缺 module_id/pack_version/menuPath/locatorPriority/uniqueness | 扩展 v2 PageMapping |
| Data Recipe | 无 | 缺失 | 无 entities/create_order/references/uniqueness/reuse/cleanup/rollback | 新增 DataRecipe Schema |
| Execution Report | `RunResult`/`renderMarkdown`/`renderHtml` | 部分 | 无模块/集成/版本组合/失败分类/数据准备/清理 | 新增 ExecutionReport Schema + 报告分层 |
| Integration Pack | 无 | 缺失 | 无 `integration.yaml`/模块依赖/跨模块步骤/数据传递/失败传播 | 新增 IntegrationPack Schema + 模板 |
| Action Registry | 无 | 缺失 | 无动作类型/参数 Schema/风险级别/重试安全性/高影响标记 | 新增 ActionRegistry Schema |
| Suite / Run Config | 无 | 缺失 | 无套件、运行配置、环境/用户/组织/账套 | 新增 Suite/RunConfig Schema |
| Environment / User Profile | 部分 `athena.config.json` | 部分 | 环境与模块/账号/组织/账套未分离 | 拆分 runtime/environments、runtime/users |

### 4.1 现有 Schema 盘点

| Schema | 用途 | 归属 |
| --- | --- | --- |
| `Action.schema.json` | Phase 1 知识动作 | 知识模型 |
| `common.schema.json` | Phase 1 公共定义 | 知识模型 |
| `Control.schema.json` | Phase 1 控件 | 知识模型 |
| `Dependency.schema.json` | Phase 1 依赖 | 知识模型 |
| `Document.schema.json` | Phase 1 文档 | 知识模型 |
| `Entity.schema.json` | Phase 1 实体 | 知识模型 |
| `Evidence.schema.json` | Phase 1 证据 | 知识模型 |
| `ExistingCase.schema.json` | Phase 1 已有用例 | 知识模型 |
| `Field.schema.json` | Phase 1 字段 | 知识模型 |
| `OpenQuestion.schema.json` | Phase 1 待确认 | 知识模型 |
| `Page.schema.json` | Phase 1 页面 | 知识模型 |
| `Rule.schema.json` | Phase 1 规则 | 知识模型 |
| `Scenario.schema.json` | Phase 1 场景 | 知识模型 |
| `Workflow.schema.json` | Phase 1 流程 | 知识模型 |
| `athena-config.schema.json` | Phase 2 运行时配置 | 平台配置 |
| `run-manifest.schema.json` | Phase 2 manifest | 治理/证据 |
| `page-mapping.schema.json` | Phase 2 页面映射 | 页面适配 |

缺失的 v2 核心契约：Module Manifest、TestCase、DataRecipe、ExecutionReport、IntegrationPack、ActionRegistry、Suite、RunConfig、EnvironmentProfile、UserProfile。

## 5. 架构边界差距

| 边界 | v2.0 要求 | 当前问题 | 影响 |
| --- | --- | --- | --- |
| 平台 vs 模块 | 采购字段/流程/选择器不得进入平台核心 | CLI、diagnostics、page-mapper、PRD relations/scenarios/config、navigation 均有采购硬编码 | 第二模块接入必须改平台代码 |
| 模块 vs 集成 | 集成包只引用模块资产，不复制模块步骤 | 无集成包；Phase 2 链路是 CLI 硬编码 | 跨模块链路无法组合 |
| 数据 vs 执行 | 数据配方独立、UI 造数、可清理 | 无数据配方；Phase 2 手工造数/数据保留 | 不可重复、不可清理、不可审计 |
| 断言 vs 实现 | 只断言 UI 可观察结果，保留来源 | 断言多为 flow 内硬编码，无 source_ref | 失败无法定位到规则/PRD |
| 执行 vs 治理 | 执行只接受受控动作/计划 | 页面对象可直接调用行操作/审核；写配置全局放行 | 高风险动作可绕过授权 |
| 知识 vs 运行 | 冻结模型只读，版本可追溯 | 知识产物 Git 忽略；无冻结清单；两套知识库 | 运行结果不可复现 |

## 6. 安全与治理差距

| 风险点 | 现状 | 差距 | 优先级 |
| --- | --- | --- | --- |
| 审核/删除动作授权 | `rowAction` 按 `row-action` 放行；页面对象 `audit()` 绕过 SafetyPolicy | 未按 `audit/delete` 高风险类型判定 | P0/P1 阻断写入 |
| 写配置 | `allowHighRiskActions=true` 全局开启 | 无 per-case/per-run 授权 | P1 |
| 动作审计 | 只有 manifest/日志 | 无开始/结束/目标单据/结果的结构化写动作审计 | P1 |
| 重试安全 | `browser.retry` 配置未用 | 无非幂等动作重试禁止/幂等键 | P5 |
| 数据清理 | cleanup DSL 只在写入用例失败时执行 | 无清理计划、清理审计、默认不删除策略 | P4 |
| 坐标/降级 | `allowFixedCoordinates` 未用；box 偏移硬编码 | 无降级原因/策略记录 | P4 |
| 秘密/PII | 脱敏正则；证据可能含截图/PII | 无证据秘密扫描/PII 策略；manifest 有 operator 真实姓名 | P1/P5 |
| 环境隔离 | 单测试环境、单租户、单组织 | 无环境/组织/账套 profile | P1 |
| 生产阻断 | 已有 host 类型/黑名单 | 无独立运行配置审批 | P1 |

## 7. 测试、数据与报告差距

| 维度 | 当前 | 差距 |
| --- | --- | --- |
| 单元测试 | 139 passed | 缺少 v2 契约校验、模块包校验、DAG、数据配方、报告 Schema 测试 |
| 契约测试 | 无 v2 契约 | P1 必须新增 |
| 集成测试 | 27 个适配器 fixture | 不是模块/跨模块集成测试 |
| 真实 E2E | P2.4 采购单证链路部分通过 | 退货/出库阻塞；无数据清理 |
| 数据准备 | 手工 + write DSL | 无 recipe、批次、幂等、清理 |
| 数据隔离 | 共享测试租户/组织 | 无专用测试组织/账套/账号策略 |
| 报告 | Markdown/HTML | 无模块/集成/回归总览；无版本组合；无趋势 |
| 覆盖率 | Phase 1 字段级 20.3% | 非业务语义覆盖；无场景/流程覆盖率 |
| CI | 无 | 无持续构建/测试/契约校验 |

## 8. 阶段差距

| 阶段 | 应有产物 | 当前 | 差距 |
| --- | --- | --- | --- |
| Phase 1 / v2 P2 | 可扫描任意模块、知识模型、来源追溯 | Phase 1 已实现，但采购/模块规则硬编码，语义复验未闭环 | 需平台化、模块化、冻结 |
| Phase 2 / v2 P4 | 通用 Playwright 运行时、页面适配、数据准备 | P2.0-P2.3 通过，P2.4 部分；数据准备未正式化 | 需页面适配通用化、数据配方、安全整改 |
| Phase 3 / v2 P3 | 场景评审、用例编译、DAG、Dry-run | 无 | 需从零建设 |
| Phase 4 / v2 P4 | 数据管理、批次、幂等、清理 | 无正式实现 | 需从零建设 |
| Phase 5 / v2 P5 | 执行、断言、报告、失败分类、重试 | 有基础执行/断言/报告 | 需调度、断言来源、报告分层 |
| Phase 6 / v2 P6 | 采购模块包验收、第二模块演练 | 无模块包；P2.4 未闭环 | 需迁移采购资产、补第二模块演练 |

## 9. 差距优先级

### P0 级（进入 P1 前必须确认/处理）

1. 冻结当前工作区（16 modified + 206 untracked），避免 Phase 2 成果丢失。
2. 停止继续写 ERP，直到动作级授权与审计补齐。
3. 确认 Phase 1 知识库是“候选快照”还是“正式冻结模型”。
4. 确认采购模块边界与 P6 验收范围。

### P1 级（平台骨架与契约治理）

1. 模块/场景/用例/页面映射/数据配方/报告/集成包 Schema。
2. Schema validator、版本兼容、示例模块包。
3. 文档单一事实源、AGENTS/README 更新。
4. 运行配置拆分、错误分类、run manifest v2。
5. 契约测试与 CI 基线。

### P2 级（PRD/知识引擎平台化）

1. 扫描器模块化、模块规则外置。
2. 知识抽取/关系/场景中的采购常量外置。
3. 独立语义抽检、冻结快照、版本清单。
4. 文件格式适配（TXT 真实样本、DOCX/XLSX/PDF 适配器）。

### P3 级（场景/用例/依赖）

1. 场景评审工作流。
2. TestCase 编译器。
3. DAG/拓扑/循环检测/失败传播。
4. 套件、Dry-run、执行计划。

### P4 级（浏览器/数据）

1. 控件层收敛（controls/adapters/raw locator）。
2. 页面映射配置化、唯一性、降级记录。
3. DataRecipe 执行器、批次/幂等/清理/审计。
4. 采购资产迁入模块包。

### P5 级（执行/断言/报告）

1. 执行调度、取消、超时、重试安全。
2. 断言来源绑定、失败分类。
3. 模块/集成/回归报告、版本组合。

### P6 级（采购验收/平台固化）

1. 采购模块包独立加载/校验/执行。
2. 采购主流程 + 关键异常/边界。
3. 第二模块最小接入演练。
4. 平台纯度审计。
