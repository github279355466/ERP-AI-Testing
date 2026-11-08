# P0 架构决策记录（ADR）

> 状态说明：
> **DECIDED** = P0 盘点后形成、可直接作为 P1 输入；
> **PROPOSED** = 建议方案，需人工确认；
> **BLOCKED** = 未裁决前不得进入对应阶段。
> 本文件不修改 `DECISIONS.md` 中的 D-001/D-002，二者继续作为 Phase 1 规则/关系判定口径。

## 1. 已形成决策

### D-P0-001 保留 TypeScript + Playwright + JSON Schema/ajv 技术栈

- 状态：DECIDED
- 背景：现有 87 个 TS 文件、139 单测、27 集成测试、Phase 1 ajv 校验均可用。
- 决策：继续使用 TypeScript 严格模式、Playwright Test 1.62.1、ajv Draft 2020-12、JSON/Markdown 文件资产；不引入微服务、消息队列、向量数据库或第二套测试框架。
- 影响：P1 只增加契约/校验/目录，不换技术栈。
- 证据：`package.json`、`tsconfig.json`、`src/prd/validate.ts`、`tests/unit`。

### D-P0-002 采用“渐进式迁移 + 兼容层”，不做大爆炸重写

- 状态：DECIDED
- 背景：Phase 2 代码已分 10 个提交纳入 Git（HEAD 899b14d），采购链路部分可用；一次性搬迁 87 个文件会放大回退风险。
- 决策：先建目标目录/契约，再按组件波次迁移；旧路径保留 re-export/适配器，测试通过后再废弃。
- 影响：P1 不迁移采购业务实现；P4/P6 才迁采购页面对象/flow。
- 证据：`P0-MIGRATION-PLAN.md` 第 3、4 节。

### D-P0-003 三层目录作为目标结构，采购作为第一个模块包

- 状态：DECIDED
- 背景：v2.0 明确 Platform Core / Business Module Packs / Integration Test Packs。
- 决策：目标目录采用 `platform/`、`adapters/`、`business-modules/`、`integration-tests/`、`runtime/`、`executions/`、`reports/`；采购包 id 为 `purchase`。
- 影响：现有 `src/pages/purchase`、采购导航、采购知识、采购测试计划均以 `business-modules/purchase` 为目标。
- 证据：`docs/plan/Athena-ERP-Automation-Platform-Upgrade-v2.0/02-总体架构与目录规范.md`。

### D-P0-004 Phase 1 知识库先作为“候选冻结快照”，不作为唯一断言来源

- 状态：DECIDED（P1/P2 输入口径）
- 背景：当前 `prd:validate` PASS（0 error / 40 warning），但独立语义复验未闭环；620 个 OQ（616 OPEN / 33 HIGH）、481 条依赖未解析、33 条证据无版本。
- 决策：P1/P2 可将当前知识库作为候选冻结快照消费；正式用例断言必须带 `source_refs`，并允许标注 `PRD_EXPLICIT / PRD_DERIVED / PLATFORM_SERVICE / UI_OBSERVED / USER_CONFIRMED / PENDING`；不得把候选规则直接升级为正式断言。
- 影响：P2 需要独立语义抽检与冻结清单；P3 用例编译必须保留来源。
- 证据：`artifacts/knowledge/summary.json`、`reports/PRD_ANALYSIS_REPORT.md`、`artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md`、`artifacts/acceptance/PHASE1-REMEDIATION-R2.md`。

### D-P0-005 Phase 2 P2.0-P2.3 作为可复用底座，P2.4 仅作为参考 E2E

- 状态：DECIDED
- 背景：P2.0/P2.1/P2.2/P2.3 通过；P2.4 采购链路部分通过，退货/出库被 B1/B2 阻塞。
- 决策：P1/P4 复用 P2.0-P2.3 的浏览器/会话/导航/适配器/证据/manifest；采购模块正式验收推迟到 P6，不以 P2.4 作为采购模块通过依据。
- 影响：P6 必须重跑采购主流程并处理 B1/B2/DIR 缺陷；P0 不宣称采购平台验收通过。
- 证据：`artifacts/phase2/PHASE2-FINAL-REPORT.md`、`P2.4-ACCEPTANCE-REPORT.md`、`P2.4-DIRECTION-BUGS.md`。

### D-P0-006 写操作冻结，直到动作级授权与审计完成

- 状态：SUPERSEDED（2026-11-08 人工裁决：P1-P3 不完全冻结写操作；动作级授权与审计要求仍保留）
- 背景：`rowAction` 仅按 `row-action` 放行；页面对象 `audit()` 绕过 `SafetyPolicy`；写配置全局开启高风险动作；`browser.retry` 未使用。
- 决策：P0/P1 不执行任何 ERP 写操作；P1 先完成 ActionRegistry、per-run/per-case 授权、高风险动作审计、重试安全元数据；P4 再恢复受控写入。
- 影响：P1/P2/P3 只读；P4 需重新验收写入门禁。
- 证据：`src/runner/safety-policy.ts`、`src/runner/write-executor.ts`、`src/runner/actions/master-data-actions.ts`、`src/pages/purchase/*.page.ts`、`config/athena.write.config.json`。

### D-P0-007 采用 JSON Schema + 语义化版本 + 兼容范围

- 状态：DECIDED
- 背景：v2.0 要求平台/模块/集成包独立版本化，破坏性变更升主版本并提供迁移器。
- 决策：核心契约使用 JSON Schema Draft 2020-12；每份资产带 `schema_version`；ModuleManifest 带 `compatibility.platform_api`；运行时拒绝不兼容资产。
- 影响：P1 新增 Module/TestCase/DataRecipe/Report/Integration/ActionRegistry/Suite/RunConfig Schema 与 validator。
- 证据：`schemas/`、`02-总体架构与目录规范.md`、`03-核心数据契约.md`。

### D-P0-008 保留 legacy 兼容层，不在 P0/P1 删除

- 状态：DECIDED
- 背景：`src/controls`、`knowledge/athena-*.json`、`cases/*.json`、`src/knowledge/knowledge-base.ts` 仍在用。
- 决策：P0/P1 不删除；标记 legacy/deprecated 候选；迁移完成并验收后再处置。
- 影响：P1 可创建新路径，但旧路径仍可运行；文档需明确“legacy”。
- 证据：`P0-AS-IS.md` 第 10 节。

### D-P0-009 文档单一事实源

- 状态：DECIDED
- 背景：README/ARCHITECTURE/MVP-VALIDATION/PHASE2/memory 对“当前状态”描述不一致。
- 决策：P1 建立 `docs/architecture/`（当前架构）、`docs/contracts/`（契约）、`docs/decisions/`（ADR）、`docs/runbooks/`（运行手册）；旧文档标记 historical/legacy，不再新增事实。
- 影响：P1 需要迁移/合并文档，避免读者误用旧数字。
- 证据：`P0-AS-IS.md` 第 13 节。

### D-P0-010 证据与知识产物必须可冻结、可追溯

- 状态：DECIDED
- 背景：`artifacts/` 被 Git 忽略；知识库版本来自本地文件哈希；Phase 2 manifest 记录 code commit，但知识库本身无冻结清单。
- 决策：P1 建立冻结快照清单（模型版本、生成时间、文件 SHA-256、来源批次、已知残余）；P5 报告固定记录平台/模块/用例/环境版本组合。
- 影响：P1 需定义 `knowledge/frozen/<version>/` 或等价归档策略；P5 报告需带版本组合。
- 证据：`src/knowledge/model-version.ts`、`artifacts/knowledge/summary.json`、`config/athena.config.json`。

## 2. 待人工裁决的阻塞决策

> 以下问题会直接影响 P1/P2 的范围与顺序；未确认前不进入对应阶段。

### Q-P0-01 是否授权冻结当前工作区为基线提交/标签？

- 状态：BLOCKED
- 背景：当前 `HEAD 899b14d`，Phase 2 代码已提交；3 个 P0 文档修改未提交；200 个未跟踪文件（199 个 `probe/` P2 证据 + 1 个 Phase3 文档）。
- 需要决定：是否允许提交/打标签作为迁移基线；提交范围是否包含 `probe/` 下 100+ 诊断文件（建议只提交源码/测试/配置/文档，probe 继续本地保留）。
- 阻塞：P1 Wave 0。

### Q-P0-02 是否接受 Phase 1 知识库作为“候选冻结快照”进入 P2？

- 状态：BLOCKED
- 背景：独立语义复验未闭环；620 OQ / 33 HIGH；481 依赖未解析；33 证据无版本。
- 需要决定：接受“带残余快照 + 来源标记 + 不作为唯一断言来源”，还是要求先完成第三轮独立语义复验再进入 P2。
- 阻塞：P2 知识库消费与 P3 用例编译。

### Q-P0-03 采购模块边界与 P6 验收范围？

- 状态：BLOCKED
- 背景：P2.4 采购订单/到货/入库通过，退货/出库阻塞；采购测试计划有 73 份中的采购子集。
- 需要决定：P6 是否以“采购订单→到货→入库”主流程 + 关键异常为验收范围，退货/出库列为已知阻塞；还是要求五单链路全部闭环后才验收。
- 阻塞：P6 验收标准与 P4/P6 排序。

### Q-P0-04 是否接受 P1 只建骨架/契约、不迁移业务实现？

- 状态：BLOCKED
- 背景：P1 目标是平台骨架与契约治理；采购页面对象迁移放在 P4/P6 风险更低。
- 需要决定：P1 是否允许创建空 `business-modules/purchase/module.yaml` 与资产索引，但不移动 `src/pages/purchase`。
- 阻塞：P1 范围。

### Q-P0-05 是否确认写操作冻结与恢复条件？

- 状态：BLOCKED
- 背景：审核/删除授权存在绕过；Phase 2 已在测试环境创建并保留单据。
- 需要决定：P1-P3 是否完全禁止写操作；P4 恢复写入前需要哪些门禁（per-case 授权、审计、清理计划、环境确认）。
- 阻塞：P4 写入能力。

### Q-P0-06 现有 Phase 2 测试数据如何处理？

- 状态：BLOCKED
- 背景：P2.4 创建了采购订单/到货/入库/退货单，默认保留；无清理记录。
- 需要决定：保留作为证据、还是通过 UI 清理（需授权与清理方案）；是否登记为已知测试数据。
- 阻塞：测试环境数据治理与 P6 复跑。

### Q-P0-07 第二模块演练对象与集成链路优先级？

- 状态：BLOCKED
- 背景：v2.0 要求 P6 做第二模块最小接入演练；集成链路候选为 purchase-to-ap、sales-to-ar、purchase-to-inventory、sales-to-inventory。
- 需要决定：第二模块选销售还是库存；首条集成链路选 purchase-to-ap 还是 purchase-to-inventory。
- 阻塞：P6 演练范围与 integration-tests 目录优先级。

## 3. 与旧决策的关系

| 旧决策 | 处理 |
| --- | --- |
| `DECISIONS.md` D-001（规则证据有效性口径） | 保留，继续作为 Phase 1 知识抽取/校验口径；P2 迁入 `docs/decisions/` |
| `DECISIONS.md` D-002（关系否定/方向口径） | 保留，继续作为关系抽取口径；P2 迁入 `docs/decisions/` |
| Phase 2 开发包“P2.0-P2.4 顺序验收” | 保留为历史验收；v2.0 以 P4/P6 重新组织 |
| Phase 1 开发包“先建模后执行” | 保留；v2.0 继续要求来源追溯与人工治理 |

## 4. 决策影响矩阵

| 决策 | 影响 P1 | 影响 P2 | 影响 P3 | 影响 P4 | 影响 P6 |
| --- | --- | --- | --- | --- | --- |
| D-P0-001 技术栈 | 高 | 中 | 中 | 中 | 低 |
| D-P0-002 渐进迁移 | 高 | 高 | 中 | 高 | 高 |
| D-P0-003 三层目录 | 高 | 高 | 高 | 高 | 高 |
| D-P0-004 知识候选快照 | 中 | 高 | 高 | 中 | 高 |
| D-P0-005 P2 底座复用 | 中 | 中 | 中 | 高 | 高 |
| D-P0-006 写操作冻结 | 高 | 高 | 高 | 高 | 中 |
| D-P0-007 Schema/版本 | 高 | 高 | 高 | 高 | 高 |
| D-P0-008 legacy 兼容 | 高 | 中 | 中 | 中 | 中 |
| D-P0-009 文档单一事实源 | 高 | 中 | 中 | 中 | 中 |
| D-P0-010 冻结/追溯 | 高 | 高 | 中 | 中 | 高 |

## 5. 人工裁决结果（2026-11-08）

用户已对 P0 阻塞决策作出如下裁决，作为 P1 的输入：

| 决策点 | 裁决结果 | 对 P1/P6 的影响 |
| --- | --- | --- |
| Q-P0-01 基线冻结 | 授权冻结当前工作区为基线提交/标签 | P1 首步执行基线冻结；Phase 2 代码已在 HEAD 899b14d，标签可直接指向该提交；当前 200 个未跟踪文件约 24 MB，主要是 `probe/` 下 P2 截图/脚本 |
| Q-P0-02 Phase 1 知识库 | 接受作为“候选冻结快照” | P1/P2 可按候选快照消费；正式断言仍须保留来源标记，不把候选规则直接升级为正式断言 |
| Q-P0-03 P6 采购范围 | 按“订单→到货→入库→采购退货”主流程验收；采购退货出库 Bug 可暂不处理 | P6 不要求五单链路全部闭环；退货出库作为已知阻断登记，不作为 P6 放行条件 |
| Q-P0-04 P1 范围 | 接受 P1 只建骨架/契约、不迁移采购代码 | P1 不移动 `src/pages/purchase`；采购 manifest/资产索引可建，实现迁移留到 P4/P6 |
| Q-P0-05 写操作 | P1-P3 不完全冻结写操作 | 保留现有写能力与门禁；P1 开发本身仍不主动执行 ERP 写操作；动作级授权/审计整改仍纳入 P1 |
| Q-P0-06 Phase 2 测试单据 | 现有 Phase 2 测试单据保留 | 不做清理；在 P6 复跑与报告中登记为既有测试数据 |
| Q-P0-07 第二模块/集成链路 | 第二模块后续评估；先搭建系统；首条集成链路选 `purchase-to-ap` | P1 先建集成包模板；P6 优先准备 `purchase-to-ap`，第二模块演练后置 |

### 5.1 当前执行状态

- 上述裁决已记录，但本轮因目标 token 预算耗尽，**尚未执行基线提交/标签，尚未开始 P1**。
- 下一步顺序：基线冻结 → 更新 P0 状态/提交范围 → 执行 P1-01～P1-12。
