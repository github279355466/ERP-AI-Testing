# P7 回滚演练报告

- 演练时间：2026-11-08
- 当前版本：`1.0.0`
- 回滚目标：`1.0.0-rc1`
- 结论：**回滚与恢复均成功**

## 1. 演练步骤

1. 将 `releases/ACTIVE.json` 切换到 `1.0.0-rc1`。
2. 在 `releases/1.0.0-rc1/deploy-drill-rc1b` 执行健康检查与契约校验。
3. 将 `ACTIVE.json` 切回 `1.0.0`。
4. 在 `releases/1.0.0/deploy-drill-100` 执行健康检查与契约校验。
5. 不删除任何业务数据。

## 2. 结果

| 版本 | 健康检查 | 契约校验 | 部署目录 |
| --- | --- | --- | --- |
| 1.0.0-rc1 | success=true（node/config/schemas/modules/artifacts/CDP 全通过） | 19/19 | `releases/1.0.0-rc1/deploy-drill-rc1b` |
| 1.0.0 | success=true（node/config/schemas/modules/artifacts/CDP 全通过） | 19/19 | `releases/1.0.0/deploy-drill-100` |

机器可读结果：`reports/release/rollback-drill.json`。

## 3. 兼容性

- 两个版本的契约 Schema 均为 17 个，模块兼容范围 `>=1.0.0 <2.0.0`。
- rc1 与 1.0.0 使用同一代码基线，回滚不涉及数据结构变更。

## 4. 数据安全

- 回滚过程未删除任何业务数据。
- 未执行写操作，未产生新的测试数据。
- 最终 `ACTIVE.json` 已恢复到 `1.0.0`。
