# P5 验收报告：执行、断言与报告引擎

> 状态：**P5 已完成，等待人工确认后进入 P6**。
> 验收日期：2026-11-08。
> 范围：按执行计划调度用例、超时/取消/重试安全、断言留痕、三格式报告。P5 用占位执行器验证引擎，不连接 ERP。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| 不启动浏览器 | 通过 | `platform-run simulate` 只读编译产物 |
| 不访问 ERP | 通过 | 无网络调用 |
| 非幂等写动作不盲目重试 | 通过 | `retryEligible` 读取 action-registry 的 `retry_safe && idempotent` |
| 每条断言留预期/实际/来源 | 通过 | `AssertionResult` + 报告 `assertions[]` |
| 报告可复现 | 通过 | 报告含平台版本、模块版本、环境、操作者、时间 |

## 2. 交付物

| 类别 | 交付物 |
| --- | --- |
| 调度器 | `src/platform/execution/scheduler.ts`（依赖顺序、受控并发、超时、取消、重试安全、失败传播、失败分类） |
| 断言引擎 | `src/platform/assertion/engine.ts`（visible/text/value/row/count/status/document_no/summary_value/relation） |
| 报告引擎 | `src/platform/report/engine.ts`（JSON / Markdown / HTML，契约校验） |
| CLI | `src/cli/platform-run.ts`（`simulate`） |
| 脚本 | `platform:run:simulate` |
| 测试 | `tests/platform/execution.spec.ts`（12 项） |

## 3. 模拟运行结果

命令：`node dist/cli/platform-run.js simulate --module purchase --limit 12 --fail-at 5`

| 项 | 结果 |
| --- | --- |
| 计划用例 | 12 |
| 通过 | 11 |
| 注入失败 | 1（`ASSERT_VALUE_FAILED` / assertion） |
| 报告契约 | valid |
| 报告文件 | `artifacts/<run-id>/report.{json,md,html}` |

## 4. P5 验收项逐条核对

| 验收指标 | 结果 | 证据 |
| --- | --- | --- |
| 依赖顺序正确，取消/超时状态正确 | 通过 | 调度测试覆盖拓扑顺序、超时 `TIMEOUT`、取消 `cancelled` |
| 每条断言保存预期值、实际值和证据引用 | 通过 | 报告断言含 expected/actual/source_ref，测试断言 markdown 输出 |
| HTML/JSON/Markdown 完整报告 | 通过 | 三格式同时生成并通过 `execution-report` 契约 |
| 失败分类可区分环境/造数/步骤/断言/平台 | 通过 | `classifyFailure` 单测五类 |
| 非幂等写操作不自动盲目重试 | 通过 | save 用例重试 1 次，只读用例按 3 次重试 |
| 报告记录平台/模块/用例/环境版本 | 通过 | 报告字段与契约一致 |

## 5. 已知限制

| 限制 | 影响 | 处理计划 |
| --- | --- | --- |
| 真实 UI 用例执行器尚未接入调度器 | P5 只证明引擎，不证明采购流程 | P6 实现 `BrowserCaseRunner` 并跑真实流程 |
| 报告证据目前来自运行器输出 | 模拟运行无截图 | P6 接入 EvidenceManager 与失败诊断 |
| 清理仅汇总状态 | 未执行物理删除 | 需单独授权后实现清理执行器 |

## 6. 复现命令

```bash
npm run platform:run:simulate -- --module purchase --limit 12 --fail-at 5
npm run test:platform
```
