# 契约：模块清单 Module Manifest

- Schema：`platform/contracts/schemas/module-manifest.schema.json`
- 文件位置：`business-modules/<module-id>/module.yaml`
- 示例：`platform/contracts/examples/module.valid.yaml`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `1.0` |
| `module.id` | 小写字母开头，仅小写字母、数字、连字符 |
| `module.name` | 人类可读名称 |
| `module.version` | 语义化版本，如 `0.1.0` |
| `module.status` | `draft` / `reviewed` / `approved` / `deprecated` |
| `module.owner` | 负责人或团队 |
| `module.description` | 模块范围说明 |
| `compatibility.platform_api` | 平台 API 版本范围，如 `>=1.0.0 <2.0.0` |
| `sources.prd_index` | PRD 索引相对路径 |
| `assets` | `knowledge` / `page_mappings` / `scenarios` / `testcases` / `data_recipes` / `test_suites` |

## 校验规则

- 平台当前 API 版本为 `1.0.0`；范围不满足时模块被拒绝加载，错误信息包含期望与实际版本。
- `draft` 模块允许资产目录暂缺，只产生 warning。
- `approved` 模块必须资产目录齐全，否则硬失败。
- 清单只描述模块与资产位置，不得写入采购等具体业务字段。

## 变更规则

- 新增模块先复制 `business-modules/_template`，再修改 `module.id`、`name`、`owner`。
- 资产内容就绪、评审通过后才可把 `status` 改为 `approved`。
- 模块版本变化必须与 `version` 字段同步，集成包依赖范围据此校验。
