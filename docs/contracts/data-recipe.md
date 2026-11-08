# 契约：数据配方 Data Recipe

- Schema：`platform/contracts/schemas/data-recipe.schema.json`
- 示例：`platform/contracts/examples/data-recipe.valid.json`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `id` / `module_id` / `title` | 配方标识 |
| `entities` | 至少 1 个实体，含 `id`、`type`、`key`、`create_order`、`reuse_policy` |
| `create_order` | 至少 1 个实体创建顺序 |
| `references` | 实体引用关系，含 `from`、`to`、`field`、`required` |
| `uniqueness_strategy` | `prefix`、`include_run_id`、`timestamp` |
| `reuse_policy` | `never` / `within_run` / `approved_shared` |
| `cleanup` | `policy`、`order`、`notes` |
| `assertions` | 至少 1 条数据准备断言 |

## 规则

- 默认唯一性策略必须包含 `runId`，避免并行运行冲突。
- `reuse_policy` 默认 `never`；共享数据必须经人工批准并记录。
- 清理顺序必须与创建顺序相反；无法清理时标 `manual` 并写明原因。
- 配方只描述数据准备，不写保存、审核等动作的具体页面实现。
