# Platform Core

本目录是 v2.0 三层架构中的 Platform Core（通用平台核心）。

P1 阶段只建立骨架与契约，不迁移现有 `src/` 实现。现有代码继续可运行，后续按 `docs/upgrade/P0-MIGRATION-PLAN.md` 的波次逐步迁入。

## 目录

| 目录 | 目标职责 | P1 状态 |
| --- | --- | --- |
| `contracts/` | 核心 JSON Schema、示例、validator | 已建立 |
| `prd-scanner/` | PRD 递归扫描、文件索引、增量 | 待 P2 |
| `knowledge-engine/` | 实体/字段/规则/流程/依赖模型 | 待 P2 |
| `scenario-engine/` | 知识 → 候选场景、评审 | 待 P3 |
| `testcase-engine/` | 场景 → 测试用例、版本 | 待 P3 |
| `dependency-engine/` | 依赖图、DAG、拓扑、循环检测 | 待 P3 |
| `browser-engine/` | Playwright 生命周期、会话、导航 | 待 P4 |
| `page-adapter-engine/` | 页面对象、控件适配、定位策略 | 待 P4 |
| `data-engine/` | 数据配方、批次、幂等、清理 | 待 P4 |
| `execution-engine/` | 套件调度、超时、取消、重试安全 | 待 P5 |
| `assertion-engine/` | UI 可观察断言、来源绑定 | 待 P5 |
| `report-engine/` | 模块/集成/回归报告 | 待 P5 |
| `governance-engine/` | 审批、版本、审计、门禁、运行清单 | P1 建立契约与 v1 适配，P4/P5 扩展 |

## 边界

- 平台核心不得出现采购、销售、库存、应收、应付、生产等具体业务字段、流程或页面选择器。
- 业务差异进入 `business-modules/<module-id>/`。
- 跨模块链路进入 `integration-tests/<integration-id>/`。
- 环境、账号、运行配置进入 `runtime/`，不写死在模块包。
- 所有资产必须通过 `platform:validate` 校验后才能被执行引擎消费。

## P1 验证

```powershell
npm run build
npm run platform:validate
npm run test:contract
```

`platform:validate` 只做静态契约校验，不连接 ERP、不启动浏览器、不写业务数据。
