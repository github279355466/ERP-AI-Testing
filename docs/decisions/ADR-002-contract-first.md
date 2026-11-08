# ADR-002：先契约后迁移

- 状态：Accepted
- 日期：2026-11-08
- 背景：Phase 1/2 成果可用，但缺少 Module/TestCase/DataRecipe/Report/Integration 契约，直接搬迁会反复返工。
- 决策：P1 先建立 JSON Schema、validator、版本兼容、示例和模板；P2-P6 再迁移实现。
- 影响：所有模块/集成/用例资产必须先通过 `platform:validate`；不兼容版本、缺字段、错类型、未知字段一律失败。
- 依据：`docs/upgrade/P1-IMPLEMENTATION-PLAN.md`、`platform/contracts/README.md`。
