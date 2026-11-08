# TO-BE：Athena ERP 自动化测试平台 v2.0

## 1. 三层结构

```text
Platform Core
  ├── prd-scanner         PRD 递归扫描/索引
  ├── knowledge-engine    实体/字段/规则/流程/依赖
  ├── scenario-engine     知识 → 候选场景
  ├── testcase-engine     场景 → 测试用例
  ├── dependency-engine   DAG/拓扑/循环检测
  ├── browser-engine      Playwright 生命周期/会话/导航
  ├── page-adapter-engine 页面对象/控件适配/定位
  ├── data-engine         UI 造数/批次/幂等/清理
  ├── execution-engine    套件调度/超时/取消/重试安全
  ├── assertion-engine    UI 可观察断言/来源绑定
  ├── report-engine       模块/集成/回归报告
  └── governance-engine   审批/版本/审计/门禁

Business Module Packs
  ├── purchase
  ├── sales
  ├── inventory
  ├── ar
  ├── ap
  └── production

Integration Test Packs
  ├── purchase-to-ap
  ├── sales-to-ar
  ├── purchase-to-inventory
  └── sales-to-inventory
```

## 2. 建设顺序

| 阶段 | 目标 |
| --- | --- |
| P1 | 骨架、契约、validator、版本兼容、运行时配置、manifest v2 |
| P2 | PRD/知识引擎平台化，采购常量外置 |
| P3 | 场景评审、TestCase 编译、DAG、Dry-run |
| P4 | 浏览器/页面适配/数据配方，采购资产迁入模块包 |
| P5 | 执行/断言/报告，失败分类与版本组合 |
| P6 | 采购模块包验收，`purchase-to-ap` 集成包骨架 |

## 3. 原则

- 平台核心只建设一次；模块只提供业务差异。
- 集成包只引用模块资产，不复制模块步骤。
- 所有正式用例保留来源；所有正式断言可追溯到规则/PRD/批准设计。
- 所有写操作受运行配置、动作风险和审计约束。
- 所有资产通过契约校验后才能被执行引擎消费。
