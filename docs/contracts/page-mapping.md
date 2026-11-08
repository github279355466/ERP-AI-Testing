# 契约：页面映射 Page Mapping

- Schema：`platform/contracts/schemas/page-mapping.schema.json`
- 示例：`platform/contracts/examples/page-mapping.valid.json`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `module_id` | 所属模块 |
| `page_key` | 页面键，小写字母开头 |
| `page_name` | 页面名称 |
| `navigation` | `menu_path`、`work_item_code`、`route` |
| `status` | `candidate` / `confirmed` / `deprecated` |
| `review_status` | `draft` / `needs_review` / `approved` / `blocked` |
| `locator_priority` | 定位策略优先级，至少 1 项 |
| `fields` | 至少 1 个字段映射 |

## 字段映射

每个字段必须声明 `name`、`label`、`control_type`、`locator`、`required`、`readonly`、`verified`、`source_ref`。

- `control_type` 使用统一控件枚举，未知控件标 `UNKNOWN`。
- `locator.strategy` 只能是 `role` / `label` / `placeholder` / `testid` / `css` / `xpath`。
- `locator.unique` 表示该定位在当前页面是否唯一。
- `verified=false` 的字段不得作为正式断言依据。

## 边界

页面映射属于业务模块资产，必须放在 `business-modules/<module-id>/page-mappings/`，不得进入平台核心。
