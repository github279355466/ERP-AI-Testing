# 最终验收报告：Athena ERP 自动化测试平台 v2.0

> 验收日期：2026-11-08。
> 范围：P0-P6 全阶段交付 + 当前环境真实执行（基础管理 / 应收 / 应付 / 采购）。
> 结论：**平台三层架构已落地，采购主流程真实执行通过，四模块只读冒烟通过；AR/AP 业务深度与采购其余单据仍为后续扩展项。**

## 1. 阶段成果

| 阶段 | 提交 | 成果 |
| --- | --- | --- |
| P0 | `c4243c7` | 现状盘点、资产映射、差距矩阵、迁移计划、风险清单 |
| P1 | `ff5d8ac` | 三层骨架、15 个契约 Schema（含 common 共 16 个文件）、校验器、模块/集成模板、契约测试 |
| P2 | `363db75` | 模块化 PRD 来源索引、扫描编排、术语表、增量扫描 |
| P3 | `363db75` | 场景编译、审批闸门、DAG、执行计划、dry-run |
| P4 | `58292d9` | 页面映射、控件动作、Data Recipe、失败诊断、真实浏览器冒烟 |
| P5 | `4df7f05` | 调度器、断言引擎、JSON/Markdown/HTML 报告 |
| P6 | 本提交 | 采购主流程真实执行、base/ar/ap 模块试接入、全系统冒烟、集成包骨架 |
| P7 | 后续提交 | 采购订单全操作闭环（新增/修改/提交/审核/撤审/删除） |

## 2. 平台结构

```text
platform/contracts/     契约 Schema、示例、动作注册表
src/platform/prd/       PRD/知识引擎（模块化扫描）
src/platform/plan/      场景编译、DAG、执行计划
src/platform/pages/     页面映射与控件动作（模块无关）
src/platform/data/      Data Recipe 规划/执行/审计
src/platform/execution/ 调度器与浏览器执行器
src/platform/assertion/ 断言引擎
src/platform/report/    报告引擎
src/platform/evidence/  失败诊断
src/platform/governance/运行清单 v2
business-modules/       purchase / base / ar / ap 模块包
integration-tests/      purchase-to-ap 集成包（draft）
src/modules/            模块流程实现（采购流程适配层）
```

采购选择器/字段不在平台核心；平台通过 `invoke_flow` 调用模块注册流程。

## 3. 验证证据

| 检查 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `npm run test:unit` | 139 passed |
| `npm run test:contract` | 92 passed |
| `npm run test:platform` | 48 passed |
| `npm run platform:validate` | 19/19 通过（2 条预期 warning：模板包） |
| `npm run platform:plan:compile -- --module purchase` | 1,664 场景/用例，0 语义问题，契约通过 |
| `npm run test:smoke` | 2 skipped（未开 UI 门禁时） |
| 启用 `ALLOW_ERP_UI_TEST=true` 的浏览器冒烟 | passed（CDP，13 个业务页） |

## 4. 真实全系统执行

### 4.1 采购主流程（写）

| 项 | 值 |
| --- | --- |
| 运行 | `P6-PO-20261108-04` |
| 用例 | `SMOKE-PURCHASE-ORDER-CREATE` |
| 结论 | passed |
| 单据号 | `PO0501-2026110800006` |
| 断言 | 14/14 |
| 报告 | `artifacts/P6-PO-20261108-04/report.{json,md,html}` |

### 4.2 四模块只读冒烟

运行：`node scripts/run-system-smoke.mjs`（2026-11-08T13:36:04）

| 模块 | 用例 | 结论 | 列头 | 行数 |
| --- | --- | --- | --- | --- |
| base | SMOKE-INVENTORY-PARAM-LIST | passed | 7 | 9 |
| ar | SMOKE-AR-BIZ-TYPE-LIST | passed | 13 | 17 |
| ap | SMOKE-AP-BIZ-TYPE-LIST | passed | 11 | 8 |
| purchase | SMOKE-PURCHASE-ORDER-LIST | passed | 12 | 20 |

汇总：`artifacts/session-outputs/system-smoke-20261108T133604.json`。

## 5. 测试数据与清理

| 数据 | 标识 | 清理状态 |
| --- | --- | --- |
| 采购订单 | `PO0501-2026110800006`（备注前缀 P6AUTO-） | `mark_for_cleanup`，未删除（删除需单独授权） |
| 采购订单 | `PO0501-2026110800007`（P7 全操作闭环 A 单） | 保留，`mark_for_cleanup` |
| 采购订单 | `PO0501-2026110800008`（P7 删除专用 B 单） | 已按授权删除，列表不可见 |

AR/AP/base 冒烟均为只读，未产生业务数据。

## 6. 覆盖与未覆盖

| 范围 | 状态 |
| --- | --- |
| 采购订单创建/修改/提交/审核/撤审/删除 | 已验证（`P7-PO-LIFECYCLE-01`，9/9 断言） |
| 采购到货/入库/退货 | 页面对象存在，未在本轮真实执行 |
| 采购审核/过账 | 未验证（高风险，需专项授权） |
| 基础管理 | 存货参数列表只读 |
| 应收/应付 | 业务单别列表只读 |
| 跨模块 purchase→ap | 仅骨架与候选数据映射 |

## 7. 使用方式

```bash
npm ci
npm run build
npm run platform:validate
npm run platform:prd:scan -- --module purchase
npm run platform:plan:compile -- --module purchase
npm run platform:plan:dry-run -- --module purchase

# 只读全系统冒烟（需已登录的 CDP Chrome）
$env:ALLOW_ERP_UI_TEST='true'
npm run p6:system-smoke

# 采购写入用例（显式授权）
npm run p6:system-smoke:write
```

## 8. 风险与后续

| 风险 | 说明 | 建议 |
| --- | --- | --- |
| 页面映射复核不足 | 多数 `verified=false` | 每跑通一个页面即翻转标记 |
| PRD 场景为启发式编译 | 步骤不能直接执行 | 以模块流程 + 评审用例作为执行单元 |
| 测试数据清理未自动化 | 残留单据 | 授权后实现清理执行器 |
| AR/AP 覆盖浅 | 仅列表 | 按测试计划逐页扩充 |
| 单环境 | 仅 athena-test | 扩展 environment-profile 后接入多环境 |
