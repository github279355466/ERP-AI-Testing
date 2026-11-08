# 契约：运行清单 v2 Run Manifest

- Schema：`platform/contracts/schemas/run-manifest-v2.schema.json`
- 示例：`platform/contracts/examples/run-manifest-v2.valid.json`
- 适配器：`src/platform/governance/run-manifest-v2.ts`

## 必填结构

| 字段 | 说明 |
| --- | --- |
| `schema_version` | 固定 `2.0` |
| `run_id` | 运行标识 |
| `platform_version` | 平台语义化版本 |
| `module_packs` | 参与的模块与版本 |
| `integration_packs` | 参与的集成包与版本 |
| `environment` | 名称、类型、租户 |
| `operator` | 操作者标识，不含凭据 |
| `test_case_id` | 当前用例或套件标识 |
| `started_at` / `finished_at` | 起止时间，未结束用 `null` |
| `outcome` | `passed` / `failed` / `blocked` / `skipped` / `cancelled` / `error` |
| `failure_category` | `none` / `environment` / `data_preparation` / `step` / `assertion` / `platform` / `manual` |
| `created_documents` | 创建的单据，含 `document_type` 与 `identifier` |
| `data_recipe_runs` | 数据配方执行记录 |
| `cleanup_status` | `passed` / `failed` / `blocked` / `skipped` / `not_run` |
| `evidence_files` | 证据文件路径 |

## v1 适配

`fromRunManifestV1` 用于读取旧版 `manifest.json`，不修改旧文件。

| v1 字段 | v2 映射 |
| --- | --- |
| `runId` / `startedAt` / `finishedAt` | 同名 snake_case 字段 |
| `environmentName` / `environmentType` | `environment.name` / `environment.type` |
| `testCaseId` | `test_case_id` |
| `createdDocumentIdentifiers` | `created_documents[]`，`document_type` 标 `UNKNOWN` |
| `evidenceFiles` | `evidence_files` |
| `outcome=not_run` | `outcome=skipped` |
| `outcome=failed` | `failure_category=step`（v1 无分类，需人工复核） |
| `outcome=blocked` | `failure_category=manual` |

旧清单缺少租户时写 `tenant_id=UNKNOWN`，缺少操作者时写 `operator=UNKNOWN`，不得猜测真实值。

## 规则

- 六状态与执行报告保持一致，禁止新增未登记状态。
- 运行清单只记录事实，不写入账号、口令、Token、Cookie。
- P1 只提供契约与适配器；执行引擎接入在 P5。
