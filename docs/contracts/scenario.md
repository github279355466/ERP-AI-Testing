# 契约：业务场景 Scenario

- Schema：`platform/contracts/schemas/scenario.schema.json`
- 示例：`platform/contracts/examples/scenario.valid.json`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `id` | 场景唯一标识 |
| `module_id` | 所属模块，小写字母开头 |
| `title` | 场景标题 |
| `business_goal` | 业务目标 |
| `source_refs` | 至少 1 条来源，含文档、路径、来源类型 |
| `preconditions` | 前置条件列表 |
| `business_flow` | 至少 1 个业务流程步骤 |
| `risk_level` | `low` / `medium` / `high` / `critical` |
| `status` | `draft` / `reviewed` / `approved` / `deprecated` |
| `tags` | 标签列表 |

## 校验规则

- 场景必须有可追溯来源，`source_refs` 不允许为空。
- 推导内容必须标为 `PRD_DERIVED` 或 `PENDING`，不得伪装为 `PRD_EXPLICIT`。
- 未人工确认的场景保持 `draft`，不得直接进入正式套件。
- 场景只描述业务目标与流程，不写定位器、选择器或页面实现。
