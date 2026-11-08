# P3 验收报告：场景编译、DAG 与执行计划

> 状态：**P3 已完成，等待人工确认后进入 P4**。
> 验收日期：2026-11-08。
> 基线：`ff5d8ac` + P2 变更。
> 范围：把知识库场景编译为平台用例/套件/执行计划；只做静态推演，不启动浏览器、不访问 ERP。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| Dry-run 不启动浏览器 | 通过 | `platform-plan` 只读 JSON，无 browser 依赖 |
| 不访问 ERP | 通过 | 无网络调用 |
| 不写业务数据 | 通过 | 仅写 `artifacts/modules/<id>/compiled/` |
| 采购逻辑不进平台核心 | 通过 | 编译器只认 Scenario/TestCase 契约与 action-registry |
| 未批准用例不进正式套件 | 通过 | `SUITE_HAS_UNAPPROVED_CASE` 校验 + dry-run 审批闸门 |

## 2. 交付物

| 类别 | 交付物 |
| --- | --- |
| DAG | `src/platform/plan/dag.ts`（拓扑排序、缺失依赖、环检测、失败传播 block/skip/continue） |
| 编译器 | `src/platform/plan/compile.ts`（Scenario → PlatformScenario/TestCase/Suite，步骤映射 action-registry） |
| 计划器 | `src/platform/plan/module-plan.ts`（模块编译、执行计划、DAG 校验、产物落盘） |
| 产物校验 | `src/platform/plan/artifacts.ts`（四类产物逐条 schema 校验 + dry-run 摘要） |
| CLI | `src/cli/platform-plan.ts`（`compile` / `validate` / `dry-run`） |
| 脚本 | `platform:plan:compile`、`platform:plan:validate`、`platform:plan:dry-run` |
| 测试 | `tests/platform/dag.spec.ts`（4）、`compile.spec.ts`（6）、`plan.spec.ts`（4） |

## 3. purchase 编译结果

命令：`node dist/cli/platform-plan.js compile --module purchase`

| 指标 | 数值 |
| --- | --- |
| 场景 | 1,664 |
| 用例 | 1,664 |
| 跳过（缺来源） | 0 |
| DAG | acyclic，1,664 节点全部排序 |
| 语义问题 | 0 |
| 契约校验 | valid（scenario 1,664 / test-case 1,664 / suite 1 / plan 1） |

产物：`artifacts/modules/purchase/compiled/{scenarios,testcases,test-suite,execution-plan,compile-summary}.json`。

## 4. Dry-run 推演

命令：`node dist/cli/platform-plan.js dry-run --module purchase`

| 项 | 结果 |
| --- | --- |
| 风险分布 | low 839 / medium 508 / high 317 / critical 0 |
| 动作分布 | navigate 1,586、assert_value 1,663、assert_visible 481、fill 473、save 438、select_master_data 132、approve 31、unapprove 4 |
| 需授权动作 | save、approve、unapprove |
| 审批闸门 | required=true，executable=false（已批准 0/1,664） |
| 契约 | valid |

结论：计划可生成，但按治理规则**不可执行**，必须先完成用例评审与写操作授权。产物：`compiled/dry-run.json`。

## 5. P3 验收项逐条核对

| 验收指标 | 结果 | 证据 |
| --- | --- | --- |
| 100% 正式用例至少一个有效来源引用 | 通过 | 跳过 0；`validateCompiled` 的 `CASE_SOURCE_MISSING` 为 0 |
| 未批准用例不能进入正式套件 | 通过 | `SUITE_HAS_UNAPPROVED_CASE` 单测；dry-run `approval_gate.executable=false` |
| DAG 正确排序、环与缺失可检测 | 通过 | `dag.spec.ts` 4 项 + `plan.spec.ts` 依赖排序/缺失依赖 |
| Dry-run 不启动浏览器、不访问 ERP、不写业务数据 | 通过 | 纯静态命令，产物仅落 `artifacts/` |
| 上游阻塞后下游状态正确 | 通过 | `propagateFailure` 覆盖 blocked / skipped / continue |

## 6. 已知限制

| 限制 | 影响 | 处理计划 |
| --- | --- | --- |
| 步骤由 PRD 文本启发式映射 | 部分步骤动作可能过于保守（落入 assert_visible） | P4 页面映射落地后按实际控件细化 |
| 用例 `dependencies` 暂为空 | 单模块内无跨用例依赖，DAG 仅验证机制 | P6 采购主流程按业务顺序补充依赖 |
| 全部用例 `draft` | 不可直接执行 | 由评审流程推进到 `approved` |

## 7. 复现命令

```bash
npm run platform:plan:compile -- --module purchase
npm run platform:plan:validate -- --module purchase
npm run platform:plan:dry-run -- --module purchase
npm run test:platform
```
