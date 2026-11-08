# P6 验收报告：采购示范模块验收与平台固化

> 状态：**P6 已完成，等待人工确认**。
> 验收日期：2026-11-08。
> 范围：采购主流程真实 UI 执行、第二/第三模块试接入、全系统只读冒烟、集成包骨架。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| 写操作显式授权 | 通过 | 采购写入运行使用 `--allow-write` + `config/athena.write.config.json`（`safety.allowWrite=true`） |
| 采购逻辑不进平台核心 | 通过 | 采购流程在 `src/modules/purchase/`，平台只调用 `invoke_flow` |
| 仅创建不审核/不过账/不删除 | 通过 | 用例只含 navigate + invoke_flow(create)，无 approve/post/delete |
| 测试数据可识别 | 通过 | 备注前缀 `P6AUTO-` + 时间戳，单号 `PO0501-2026110800006` |
| 无凭据入库 | 通过 | 证据统一脱敏；本次未新增凭据 |
| 未验证内容不宣称 | 通过 | 页面映射 `status: candidate`，未复核字段 `verified: false` |

## 2. 采购主流程真实执行

运行：`node dist/cli/platform-run.js run --module purchase --case SMOKE-PURCHASE-ORDER-CREATE --allow-write --config config/athena.write.config.json --run-id P6-PO-20261108-04`

| 项 | 结果 |
| --- | --- |
| 结论 | passed |
| 单据号 | `PO0501-2026110800006` |
| 断言 | 14/14 通过（表头 3、明细 3、保存 1、列表重查 1、详情重查 6） |
| 耗时 | 70,588 ms |
| 证据 | `artifacts/P6-PO-20261108-04/shots/{nav-purchase-order,flow-purchase-order-create}.png` |
| 报告 | `report.json` / `report.md` / `report.html` / `run-manifest.json`，均通过契约校验 |

覆盖范围：采购订单新增 → 表头（运营单元/供应商/单别）→ 明细（品号/数量/单价）→ 保存取单号 → 列表重查 → 详情重查。**未覆盖**：到货、入库、退货、审核、过账。

## 3. 多模块试接入

新增模块包：`business-modules/base`、`business-modules/ar`、`business-modules/ap`。

| 模块 | 页面 | workItemCode | 用例 |
| --- | --- | --- | --- |
| base | 存货参数 | DTBBArnXZHrt | SMOKE-INVENTORY-PARAM-LIST |
| ar | 应收业务单别 | keeZGBfszTdp | SMOKE-AR-BIZ-TYPE-LIST |
| ap | 应付业务单别 | pYIaGDZuhRRK | SMOKE-AP-BIZ-TYPE-LIST |
| purchase | 采购订单 | ujtGFTEuPMdk | SMOKE-PURCHASE-ORDER-LIST |

只读冒烟结果（`node scripts/run-system-smoke.mjs`）：

| 模块 | 结论 | 列头 | 行数 |
| --- | --- | --- | --- |
| base | passed | 7 | 9 |
| ar | passed | 13 | 17 |
| ap | passed | 11 | 8 |
| purchase | passed | 12 | 20 |

汇总：`artifacts/session-outputs/system-smoke-20261108T133604.json`。

## 4. 集成包

`integration-tests/purchase-to-ap` 保持 draft，新增候选数据传递：`purchase.purchase_order.document_no → ap.payable.source_doc_no`。跨模块步骤与端到端断言待应付立账用例建立后补齐，不宣称已验证。

## 5. P6 验收项逐条核对

| 验收指标 | 结果 | 证据 |
| --- | --- | --- |
| 至少一条经评审的采购主流程真实 UI 执行通过 | 通过 | `P6-PO-20261108-04`，14 条断言 |
| 覆盖范围与 PRD/测试计划一致，未覆盖项透明列出 | 通过 | 本文第 2 节列出未覆盖范围 |
| 前置资料和上游单据通过 UI 自动准备 | 部分通过 | 主数据通过开窗查询选择；上游单据造数配方仅登记未执行 |
| 每个关键步骤和断言有证据 | 通过 | 导航/流程截图 + 失败诊断目录 + 报告断言来源 |
| 平台固化：第二模块可接入 | 通过 | base/ar/ap 三包契约与真实列表冒烟 |

## 6. 已知限制与后续

| 限制 | 影响 | 建议 |
| --- | --- | --- |
| 采购仅验证订单创建，未验证到货/入库/退货 | 主流程覆盖不完整 | 复用现有页面对象逐段迁移为模块流程并补用例 |
| AR/AP 仅列表只读 | 业务深度不足 | 按 TP-060~072 扩充参数页读写用例 |
| 字段映射多数 `verified=false` | 不能作为已适配依据 | 每跑通一个页面翻转对应字段并记录 |
| 创建的测试订单未清理 | 测试环境残留 1 张单据 | 授权后按 `mark_for_cleanup` 清理 |

## 7. 复现命令

```bash
npm run build
npm run p6:system-smoke                # 四模块只读冒烟
npm run p6:system-smoke:write          # 追加采购订单创建（需写授权）
```
