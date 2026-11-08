# Adapters

业务无关的控件与页面适配原语目标目录。

P1 只建立边界，不放实现：

- 现有控件能力仍在 `src/controls/`，P4 迁移。
- 适配器不得包含采购、销售等模块字段或流程。
- 模块专属定位与页面结构放 `business-modules/<module-id>/page-mappings/`。
