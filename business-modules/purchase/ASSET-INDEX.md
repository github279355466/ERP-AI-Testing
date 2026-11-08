# 采购模块资产索引（P1 骨架）

> 状态：draft。P1 只登记，不迁移实现；P4/P6 按迁移计划搬迁。

| 资产 | 当前位置 | 目标位置 | 状态 |
| --- | --- | --- | --- |
| 页面对象/流程 | `src/pages/purchase/` | `business-modules/purchase/pages/` + `flows/` | 待迁移 |
| 页面导航 | `config/phase2.navigation.json` | `business-modules/purchase/page-mappings/navigation.json` | 待拆分 |
| 控件/页面侦察 | `src/diagnostics/control-probe.ts`、`page-recon.ts` | `business-modules/purchase/tools/` | 待迁移 |
| 采购 CLI 命令 | `src/cli/main.ts` 中的 create-po/arrival/inbound/return | `business-modules/purchase/runner/` | 待迁移 |
| 采购知识 | `knowledge/purchase-*`、`artifacts/knowledge` 中采购实体 | `business-modules/purchase/knowledge/` | 待迁移 |
| 采购测试计划 | `athena-erp-test-plans/plans/采购管理-*` | `business-modules/purchase/test-plans/` | 待迁移 |
| 采购用例 | `cases/` 与 Phase 2 流程 | `business-modules/purchase/testcases/` | 待迁移/重构 |
| 采购数据配方 | `knowledge/purchase-prerequisite-plan.json` | `business-modules/purchase/data-recipes/` | 待迁移 |
| 采购证据 | `artifacts/phase2/`、`artifacts/<runId>/` | 证据归档，不进模块运行时 | 保留 |

P6 验收范围（已确认）：订单→到货→入库→采购退货；采购退货出库 Bug 暂不处理，只登记为已知阻断。
