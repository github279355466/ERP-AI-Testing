# 契约：集成测试包 Integration Pack

- Schema：`platform/contracts/schemas/integration-pack.schema.json`
- 示例：`platform/contracts/examples/integration.valid.yaml`
- 首个骨架：`integration-tests/purchase-to-ap/integration.yaml`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `integration` | `id`、`name`、`version`、`status`、`owner`、`description` |
| `module_dependencies` | 至少 1 个模块依赖，含 `module_id` 与 `version_range` |
| `business_goal` | 跨模块业务目标 |
| `steps` | 集成步骤 |
| `data_mapping` | 模块间数据映射 |
| `assertions` | 跨模块断言 |
| `cleanup_policy` | 清理策略 |
| `failure_propagation` | `block_downstream` / `skip_downstream` / `continue` |

## 校验规则

- 依赖模块不存在时：草稿包只告警；`approved` 包硬失败。
- 模块实际版本不满足 `version_range` 时硬失败。
- `approved` 集成包必须至少有 1 个步骤和 1 条断言。
- 步骤通过 `case_ref` 引用模块用例，不得复制模块内部页面步骤。
- 集成包不得包含采购、应付等模块专属字段定义。
