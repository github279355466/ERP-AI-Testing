# 跨模块集成包模板

集成包只描述跨模块链路，不复制模块内部页面/用例。

1. 修改 `integration.id`、`name`、`owner`。
2. 在 `module_dependencies` 声明模块 ID 与兼容版本。
3. 在 `steps` 引用模块用例/动作，不复制模块步骤。
4. 在 `data_mapping` 描述模块间数据传递。
5. 在 `assertions` 写端到端断言。
6. 运行 `npm run platform:validate -- --integration integration-tests/<id>`。

已批准的集成包必须至少有一个步骤和一条断言；草稿允许为空，待 P3/P4 填充。
