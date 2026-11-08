# P1–P6 平台验收报告

- 生成时间：2026-11-08
- 分支：`master`
- 验收 commit：`b020c47`（验收时工作区已清理并提交字段规则引擎）
- 平台版本：`1.0.0`（`src/platform/plan/module-plan.ts`）
- 结论：**PASS WITH CONDITIONS**
- S0/S1 未关闭：0
- 开放缺口：S2 × 5、S3 × 3
- P7 准入：**有条件准入**（发布范围限定为已验证能力）

## 1. 执行摘要

本轮以真实代码、自动化质量门禁、历史真实 UI 运行记录和当前测试环境为依据，逐项复核 P1–P6。所有质量门禁通过；采购订单创建与全操作闭环、四模块列表只读冒烟均有可追溯 run id 与报告。未发现凭证泄露、非测试环境写入或数据清理失控。主要缺口集中在知识覆盖率、场景用例批准状态、页面映射复核率和第二模块业务深度，均为 S2，不构成 S0/S1 阻断。

## 2. 质量门禁

| 检查 | 结果 | 证据 |
| --- | --- | --- |
| `npm run typecheck` | 通过 | `reports/acceptance/gate-a-evidence.json` |
| `npm run build` | 通过 | 同上 |
| `npm run test:unit` | 139 passed | 同上 |
| `npm run test:contract` | 92 passed | 同上 |
| `npm run test:integration` | 27 passed | 同上 |
| `npm run test:platform` | 56 passed | 同上 |
| `npm run platform:validate` | 19/19 通过 | 同上 |
| 凭证扫描 | 1 条命中，为单测假密码，非真实凭证 | `tests/unit/run-manifest.spec.ts:47` |

## 3. 实现盘点

| 能力 | 代码路径 | 测试 | 真实 UI 证据 |
| --- | --- | --- | --- |
| 契约与校验 | `src/platform/contracts/`、`platform/contracts/schemas/` | `tests/contract`（92） | `platform:validate` |
| PRD 知识引擎 | `src/platform/prd/`、`src/prd/` | `tests/platform/prd-scanner.spec.ts` | `artifacts/modules/purchase/knowledge/` |
| 场景编译/DAG | `src/platform/plan/` | `compile/dag/plan.spec.ts` | `artifacts/modules/purchase/compiled/` |
| 浏览器/页面适配 | `src/platform/pages/`、`src/adapters/`、`src/browser/` | `tests/integration/adapters.spec.ts` | `P6-BASE/AR/AP/PURCHASE-*` |
| 数据配方 | `src/platform/data/` | `runtime.spec.ts` | 采购订单造数流程 |
| 执行/断言/报告 | `src/platform/execution|assertion|report/` | `tests/platform/execution.spec.ts` | `artifacts/*/report.{json,md,html}` |
| 模块流程 | `src/modules/`、`business-modules/` | `modules.spec.ts` | `P6-PO-*`、`P7-PO-LIFECYCLE-01` |
| 字段规则（新增） | `src/platform/rules/` | `field-rules.spec.ts` | `P8-PO-FIELD-RULES-05` |

## 4. 逐阶段矩阵

| 阶段 | 结论 | 关键证据 | 主要缺口 | 严重度 |
| --- | --- | --- | --- | --- |
| P1 骨架与契约 | PASS | 16 个 schema 文件、19/19 校验、92 契约测试 | 无 | — |
| P2 知识引擎 | PASS WITH CONDITIONS | 122 文档/2,616 字段/9,316 规则/1,664 场景；增量与来源测试通过 | 规则覆盖现有用例仅 26.63%；381 条待确认 | S2 |
| P3 场景/用例/DAG | PASS WITH CONDITIONS | 1,664 场景与用例、0 跳过、DAG 无环、dry-run 可执行门槛生效 | 1,664 用例全部 draft；编译步骤为启发式，不能直接执行 | S2 |
| P4 浏览器与数据 | PASS WITH CONDITIONS | CDP 冒烟、13 业务页识别、采购订单 UI 造数、脱敏证据 | 页面映射 36 字段仅 8 个 verified；AR/AP/base 各仅 1–2 页 | S2 |
| P5 执行/断言/报告 | PASS | 依赖顺序、超时、取消、重试安全、三格式报告、失败证据 | 通用执行器仅支持已注册流程与基础动作 | S3 |
| P6 示范与通用性 | PASS WITH CONDITIONS | 采购订单创建 14/14；全操作闭环 9/9；base/ar/ap 列表冒烟通过 | 第二模块仅列表只读；到货/入库/退货未全操作 | S2 |

## 5. 真实 UI 演练

环境：`https://athena-test.digiwincloud.com.cn/`，租户 `digichannel`，CDP Chrome。

| run id | 结论 | 断言 | 说明 |
| --- | --- | --- | --- |
| `P6-PO-20261108-04` | passed | 14/14 | 采购订单创建、列表/详情重查，单号 `PO0501-2026110800006` |
| `P7-PO-LIFECYCLE-01` | passed | 9/9 | 新增/修改/提交/审核/撤审/删除；A 单 0007 保留，B 单 0008 删除 |
| `P8-PO-FIELD-RULES-05` | passed | 13/13 | 必填标记、默认值、供应商联动货币、只读/未渲染字段跳过 |
| `SYS-BASE-20261108T133604` | passed | 3/3 | 基础管理存货参数列表只读 |
| `SYS-AR-20261108T133604` | passed | 3/3 | 应收业务单别列表只读 |
| `SYS-AP-20261108T133604` | passed | 3/3 | 应付业务单别列表只读 |
| `SYS-PURCHASE-20261108T133604` | passed | 3/3 | 采购订单列表只读 |

写入范围：仅测试环境；仅本代理创建数据；A 单保留，B 单按授权删除。证据目录：`artifacts/<run-id>/`。

## 6. 风险与缺陷

| ID | 问题 | 严重度 | 影响 | 整改 |
| --- | --- | --- | --- | --- |
| GAP-01 | 采购知识规则仅 26.63% 被现有用例覆盖 | S2 | 规则驱动测试覆盖不足 | Gate C 建立字段规则矩阵并补充用例 |
| GAP-02 | 1,664 编译用例全部 draft | S2 | 不能进入正式套件 | 评审后推进 approved |
| GAP-03 | 页面映射 36 字段仅 8 verified | S2 | 通用适配可信度不足 | Gate C 逐页复核回填 |
| GAP-04 | AR/AP/base 仅列表只读 | S2 | 第二模块通用性未充分证明 | Gate C 扩展基础管理；AR/AP 列后续 |
| GAP-05 | 编译步骤为启发式 | S2 | 不能直接调度执行 | 以模块流程 + 评审用例作为执行单元 |
| GAP-06 | 保存拦截未纳入自动执行 | S3 | 必填拦截仅验证 UI 标记 | 专用数据+清理授权后单独验证 |
| GAP-07 | 证据部分为无 trace 的截图/报告 | S3 | 诊断深度有限 | 后续运行启用 trace 并归档 |
| GAP-08 | 第二模块无写入闭环 | S2 | P6 通用性门槛仅部分满足 | Gate C 完成基础管理 CRUD |

详见 `P1-P6-DEFECTS.md`。

## 7. P7 准入结论

**有条件准入**：

1. 质量门禁与契约校验全部通过，S0/S1=0。
2. 真实 UI 链路可追溯，写入范围受控。
3. 发布范围限定为已验证能力：采购订单闭环、字段规则、四模块列表只读。
4. 未验证能力（到货/入库/退货、AR/AP 深度、保存拦截）不得在发布说明中宣称通过。

## 8. 证据索引

见 `P1-P6-EVIDENCE-INDEX.md` 与 `P1-P6-TRACEABILITY-MATRIX.csv`。
