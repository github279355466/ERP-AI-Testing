# 业务模块包模板

复制本目录到 `business-modules/<module-id>/`，然后：

1. 修改 `module.yaml` 的 `module.id`、`name`、`owner`、`description`。
2. 在 `source-index/` 登记 PRD 来源。
3. 在 `knowledge/` 放模块知识模型。
4. 在 `page-mappings/` 放页面/控件映射。
5. 在 `scenarios/`、`testcases/`、`data-recipes/`、`test-suites/` 放测试资产。
6. 运行 `npm run platform:validate -- --module business-modules/<module-id>`。

模板不包含采购、销售等具体业务字段；模块业务差异只放在模块包内。
