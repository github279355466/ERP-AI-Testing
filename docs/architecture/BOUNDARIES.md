# 平台、模块、集成边界

| 能力 | 放在哪里 | 禁止 |
| --- | --- | --- |
| 浏览器/会话/导航 | `platform/browser-engine` | 不写采购页面流程 |
| 通用控件/定位 | `platform/page-adapter-engine` + `adapters/` | 不写某模块字段选择器 |
| 采购字段/流程/页面 | `business-modules/purchase` | 不放进平台核心 |
| 采购测试计划/用例/数据 | `business-modules/purchase` | 不复制到集成包 |
| 跨模块链路 | `integration-tests/purchase-to-ap` | 不复制采购/应付内部步骤 |
| 环境/账号/运行授权 | `runtime/` | 不写入模块包或代码 |
| 执行结果/证据 | `executions/` + `reports/` | 不写回知识库/模块资产 |

判断规则：

1. 如果一段逻辑只对某个业务模块成立，放模块包。
2. 如果一段逻辑只组合多个模块，放集成包。
3. 如果一段逻辑对所有模块都成立，才放 Platform Core。
4. 不确定时先放模块包，等第二个模块复用时再上提平台核心。
