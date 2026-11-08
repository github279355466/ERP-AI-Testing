# P7 发布后冒烟测试报告

- 版本：1.0.0
- 环境：Athena 测试环境（`athena-test` / `digichannel`），CDP Chrome 157
- 执行目录：`releases/1.0.0/deploy-drill-100`
- 结论：**4/4 模块通过**

## 1. 测试项

| 模块 | 用例 | 类型 | run id | 断言 | 结果 |
| --- | --- | --- | --- | --- | --- |
| base | SMOKE-INVENTORY-PARAM-LIST | 只读列表 | `SYS-BASE-20261108T153437` | 3/3 | passed |
| ar | SMOKE-AR-BIZ-TYPE-LIST | 只读列表 | `SYS-AR-20261108T153437` | 3/3 | passed |
| ap | SMOKE-AP-BIZ-TYPE-LIST | 只读列表 | `SYS-AP-20261108T153437` | 3/3 | passed |
| purchase | SMOKE-PURCHASE-ORDER-LIST | 只读列表 | `SYS-PURCHASE-20261108T153437` | 3/3 | passed |

## 2. 断言内容

每个用例验证：

1. 页面就绪（表单/表格可观测状态）。
2. 列头可读（>0）。
3. 行数可读（>=0）。

## 3. 证据

- 汇总：`releases/1.0.0/deploy-drill-100/artifacts/session-outputs/system-smoke-20261108T153437.json`
- 各 run：`releases/1.0.0/deploy-drill-100/artifacts/<run-id>/{report.json,report.md,report.html,run-manifest.json,shots}`

## 4. 未覆盖

- 发布后未追加写入 smoke；写入闭环证据来自发布前 `P7-PO-LIFECYCLE-01`。
- AR/AP 仅列表只读，不代表业务深度。
