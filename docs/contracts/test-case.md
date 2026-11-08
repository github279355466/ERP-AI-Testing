# 契约：测试用例 Test Case

- Schema：`platform/contracts/schemas/test-case.schema.json`
- 示例：`platform/contracts/examples/testcase.valid.json`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `id` / `module_id` / `version` | 用例标识与所属模块版本 |
| `title` / `objective` | 标题与验证目标 |
| `scenario_refs` | 至少 1 个场景引用 |
| `source_refs` | 至少 1 条来源 |
| `preconditions` | 前置条件 |
| `data_recipe_refs` | 数据配方引用 |
| `dependencies` | 用例依赖，含 `case_id` 与 `required` |
| `steps` | 至少 1 个受控动作步骤 |
| `assertions` | 至少 1 条断言 |
| `cleanup_policy` | `keep` / `delete_after_run` / `mark_for_cleanup` / `manual` |
| `status` | `draft` / `reviewed` / `approved` / `deprecated` |
| `timeout_ms` | 正整数超时 |
| `retry_policy` | `max_attempts` 与 `retry_safe_actions_only` |

## 断言分层

- `ui`：可观察的可见、文本、字段值。
- `business`：单据号、状态、汇总值、关联关系。
- `persistence`：重新进入页面或查询后的持久化结果。

每条断言必须携带 `source_ref`，禁止无来源断言。步骤只能使用 `action-registry` 注册的受控动作。
