# 契约：受控动作注册表 Action Registry

- Schema：`platform/contracts/schemas/action-registry.schema.json`
- 注册表：`platform/contracts/action-registry.json`

## 结构

每个动作必须声明：

| 字段 | 说明 |
| --- | --- |
| `type` | 动作类型 |
| `description` | 动作说明 |
| `parameters` | 参数结构 |
| `risk_level` | `low` / `medium` / `high` / `critical` |
| `retry_safe` | 失败后是否可安全重试 |
| `idempotent` | 是否幂等 |
| `requires_authorization` | 是否需要显式授权 |
| `evidence_policy` | 截图、DOM、Trace 的采集策略 |

## 动作分级

- 只读：`navigate`、`search`、`open_record`、`assert_*`、`capture_evidence`。
- 输入：`select_master_data`、`fill`、`select_option`。
- 写操作：`upload`、`save`、`submit` 为 `high`。
- 高风险：`approve`、`unapprove`、`delete` 为 `critical`。

## 规则

- 写操作必须 `requires_authorization=true`，且不允许自动重试。
- 执行引擎只能调度注册表中存在的动作。
- 新增动作必须先改注册表与 Schema，再补契约测试。
- 注册表属于平台核心，不得包含具体模块字段或页面选择器。
