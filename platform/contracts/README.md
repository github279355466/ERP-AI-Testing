# Platform Contracts

P1 核心契约位于 `platform/contracts/schemas/`，示例位于 `platform/contracts/examples/`。

## 契约清单

| Schema | 用途 |
| --- | --- |
| `module-manifest.schema.json` | 业务模块包清单 `module.yaml` |
| `scenario.schema.json` | 业务场景 |
| `test-case.schema.json` | 可评审测试用例 |
| `page-mapping.schema.json` | 页面/字段/控件映射 |
| `data-recipe.schema.json` | UI 测试数据配方 |
| `execution-report.schema.json` | 执行报告 |
| `run-manifest-v2.schema.json` | 运行清单 v2（六状态、失败分类、模块版本） |
| `integration-pack.schema.json` | 跨模块集成包 |
| `action-registry.schema.json` | 受控动作注册表 |
| `test-suite.schema.json` | 测试套件 |
| `execution-plan.schema.json` | 执行计划 |
| `run-config.schema.json` | 单次运行授权与范围 |
| `environment-profile.schema.json` | 环境配置 |
| `user-profile.schema.json` | 操作者/账号引用（不含凭据） |
| `common.schema.json` | 公共定义 |

## 校验

```powershell
npm run platform:validate
npm run platform:module -- business-modules/purchase
npm run platform:integration -- integration-tests/purchase-to-ap
npm run platform:file -- platform/contracts/examples/testcase.valid.json --schema test-case
```

## 约定

- `schema_version` 固定为 `1.0`。
- 运行清单 v2 使用独立 `schema_version: "2.0"`，v1 通过适配器转换。
- 平台 API 版本固定为 `1.0.0`；模块通过 `compatibility.platform_api` 声明兼容范围。
- 资产状态使用 `draft / reviewed / approved / deprecated`。
- 正式场景/用例必须保留来源引用；正式用例至少有一条可观察断言。
- 不兼容版本、缺字段、错类型、未知字段均失败，不静默降级。
