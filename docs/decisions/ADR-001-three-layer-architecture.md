# ADR-001：采用三层平台架构

- 状态：Accepted
- 日期：2026-11-08
- 背景：现有项目是采购示范脚本 + PRD 建模子系统的叠加，第二模块接入需要改平台代码。
- 决策：采用 Platform Core / Business Module Packs / Integration Test Packs 三层结构；采购作为第一个模块包。
- 影响：采购页面对象、流程、CLI、诊断、导航、知识、测试计划逐步迁入 `business-modules/purchase`；平台核心不得出现采购字段/流程/选择器。
- 依据：`docs/plan/Athena-ERP-Automation-Platform-Upgrade-v2.0/02-总体架构与目录规范.md`、`docs/upgrade/P0-GAP-MATRIX.md`。
