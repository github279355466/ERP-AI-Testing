# 契约：执行报告 Execution Report

- Schema：`platform/contracts/schemas/execution-report.schema.json`
- 示例：`platform/contracts/examples/execution-report.valid.json`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `run_id` | 运行标识 |
| `platform_version` | 语义化版本 |
| `module_packs` | 参与的模块与版本 |
| `environment` | 环境名称、类型、租户 |
| `operator` | 操作者标识，不包含凭据 |
| `started_at` / `finished_at` | 起止时间 |
| `outcome` | `passed` / `failed` / `blocked` / `skipped` / `cancelled` / `error` |
| `failure_category` | 失败分类，未失败用 `none` |
| `cases` | 用例结果 |
| `data_preparation` | 数据准备状态与配方引用 |
| `cleanup` | 清理状态与说明 |
| `evidence` | 证据路径列表 |

## 用例结果

每个用例必须包含 `case_id`、`status`、`duration_ms`、`steps`、`assertions`、`evidence`。

- 步骤记录动作与状态，可附 `detail`。
- 断言记录名称、层级、期望、实际、是否通过与来源。
- 证据统一指向脱敏后的截图、DOM、日志或 Trace。

## 规则

- 报告不得写入账号、口令、Token、Cookie。
- 未执行与阻塞必须区分：未执行用 `skipped`，环境或数据不满足用 `blocked`。
- 报告是运行产物，不得回写知识库或模块资产。
