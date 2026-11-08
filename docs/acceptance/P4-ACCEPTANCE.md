# P4 验收报告：浏览器与数据准备引擎

> 状态：**P4 已完成，等待人工确认后进入 P5**。
> 验收日期：2026-11-08。
> 基线：P3 提交之后。
> 范围：浏览器会话/证据复用、页面映射从模块包加载、控件动作执行、Data Recipe 规划与执行、失败诊断。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| 采购流程不进浏览器引擎 | 通过 | `src/platform/pages` 只消费模块包 `page-mappings/*.yaml`，无采购常量 |
| 默认只读 | 通过 | `PageActionExecutor` 对 fill/select/save 强制 `allowWrite`；配方未授权直接拒绝 |
| 所有造数经 UI | 通过 | 配方执行只调用 `RecipeCreator`（由页面动作实现），无 SQL/OpenAPI 通道 |
| 无凭据/Token 入库 | 通过 | 证据 JSON/DOM 统一脱敏；本次修复了 URL query token 泄漏并清除旧证据 |
| 定位失败有诊断 | 通过 | `captureFailureEvidence` 输出截图 + DOM + 定位尝试 + 错误码 |

## 2. 交付物

| 类别 | 交付物 |
| --- | --- |
| 页面映射契约消费 | `src/platform/pages/mapping.ts`（加载、契约校验、字段解析） |
| 控件动作执行 | `src/platform/pages/actions.ts`（fill / select_master_data / select_option / read / assert / save） |
| 数据配方 | `src/platform/data/recipe.ts`（加载、语义校验、依赖顺序、唯一值） |
| 配方执行 | `src/platform/data/executor.ts`（写授权、复用、幂等键、JSONL 审计、清理计划） |
| 失败诊断 | `src/platform/evidence/diagnostics.ts` |
| CLI | `src/cli/platform-runtime.ts`（`doctor` / `pages` / `recipes`，只读） |
| 模块包资产 | `business-modules/purchase/page-mappings/` 4 个页面、`data-recipes/purchase-order-basic.yaml` |
| 冒烟测试 | `tests/smoke/platform-browser.spec.ts` |
| 平台测试 | `tests/platform/runtime.spec.ts`（10 项） |

## 3. 页面映射现状

| 页面 | page_key | 字段数 | 已复核 |
| --- | --- | --- | --- |
| 采购订单 | `purchase-order` | 10 | 0 |
| 采购到货单 | `purchase-arrival` | 9 | 0 |
| 采购入库单 | `purchase-inbound` | 6 | 0 |
| 采购退货单 | `purchase-return` | 11 | 0 |

字段全部来自现有页面对象实际使用的字段路径（`source_ref` 指向对应 `src/pages/purchase/*.page.ts`），但本轮未逐字段在当前环境复核，因此统一标 `status: candidate`、`verified: false`，待 P6 真实流程中确认后翻转。

## 4. 真实浏览器冒烟

命令：`$env:ALLOW_ERP_UI_TEST='true'; npx playwright test tests/smoke/platform-browser.spec.ts`

| 项 | 结果 |
| --- | --- |
| CDP 连接 | 成功（Chrome/157.0.8103.39，端口 9333） |
| 门户 | `https://athena-test.digiwincloud.com.cn/`，标题「鼎捷雅典娜」 |
| 业务页识别 | 13 个低代码页签被识别为 business |
| 证据 | 截图 + DOM + 摘要 JSON 已落 `artifacts/<run-id>/` |
| 脱敏 | 证据中 token 值 0 处残留 |

## 5. P4 验收项逐条核对

| 验收指标 | 结果 | 证据 |
| --- | --- | --- |
| 浏览器基础能力可在独立 smoke test 验证 | 通过 | `platform-browser.spec.ts` 真实 CDP 通过 |
| 至少覆盖采购示范流程所需控件 | 通过 | LOOKUP / TEXT / DATE / DROPDOWN / GRID 五类已映射 |
| 所有业务数据创建都通过 UI | 通过 | 执行器仅接受 UI 动作实现；无其它写入通道 |
| 造数动作可追踪、可识别重复运行 | 通过 | 唯一值 + `RecipeReuseStore` + `audit.jsonl` |
| 页面定位失败提供诊断，不静默跳过 | 通过 | 失败证据包 + `errorCodeOf`；动作未捕获异常时向上抛 |

## 6. 已知限制

| 限制 | 影响 | 处理计划 |
| --- | --- | --- |
| 映射字段 `verified=false` | 不能在 P6 直接宣称页面已适配 | P6 真实流程逐页复核后更新 |
| 数据配方仅 1 个（采购订单） | 到货/入库/退货造数未落地 | P6 按主流程补充 |
| 清理仅生成计划，不执行删除 | 测试数据需人工或后续授权清理 | P5 接入授权后的清理执行器 |

## 7. 复现命令

```bash
npm run platform:runtime:doctor -- --module purchase
npm run platform:runtime:pages -- --module purchase
npm run platform:runtime:recipes -- --module purchase
npm run test:platform
```
