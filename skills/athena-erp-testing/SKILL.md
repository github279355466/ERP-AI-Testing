---
name: athena-erp-testing
displayName: 雅典娜ERP自动化测试
description: 在 ERP-AI-Testing 项目中探索 Athena ERP 页面、执行只读 Playwright 用例、维护页面知识库并生成测试报告时使用。
---

# 雅典娜 ERP 自动化测试（项目内技能）

本技能服务于仓库 `ERP-AI-Testing`，不重复框架实现细节，只规定在项目中如何安全、正确地使用与演进它。

## 1. 先读什么

| 目的 | 文档 |
| --- | --- |
| 项目结构、安装、命令 | `README.md` |
| 技术设计与分层 | `docs/ARCHITECTURE.md` |
| 浏览器接管与故障排查 | `docs/BROWSER-CONNECTION.md` |
| 已确认页面事实 | `docs/PAGE-DISCOVERY-REPORT.md` |
| 当前验收状态与缺口 | `docs/MVP-VALIDATION.md` |
| 代码约定与开发方式 | `AGENTS.md` |
| PRD 关联与最新版本 | `docs/PRD-MAPPING.md` |

## 2. 三条工作流

### 探索

```bash
npm run athena -- doctor
npm run athena -- explore --id <page-id> [--detail]
```

- 结果写入 `artifacts/<run-id>/`，候选页面条目只在 `candidate-page.json`，不得直接改 `confirmed`。
- 未知结构标 `UNKNOWN`。

### 验证

```bash
npm run athena -- verify --page-id <page-id>
npm run athena -- verify --case cases/<case>.json
```

- 只用白名单动作：`open`、`click`、`waitFor`、`assert*`、`screenshot`、`snapshot`。
- 断言分 `ui` / `business` / `persistence`；只读阶段不伪造持久化断言。

### 维护

- 页面变化：重新探索 → 对比差异 → 更新 `knowledge/*.json` → 跑冒烟。
- 冲突：保留双条并标 `conflict`，人工裁决前相关用例标 `blocked`。
- 每次变更更新 `verifiedAt`。
- PRD 更新：`npm run athena -- prd:index` 重新扫描 `paths.prd`，取每个作业最新版；用 `prd:show` 核对关联，用 `prd:section --work-item <作业> --section <标题片段>` 读取业务逻辑原文。

## 3. 硬规则

1. 默认只读，写操作零实现；高风险动作需当次授权。
2. 定位优先 `label[for="<entity>.<field>"]`、`col-id`、ARIA；禁止绝对坐标。
3. 列表页等待「真实数据行」，不要只看页签是否出现。
4. 重复点击已激活的「列表」页签会触发空查询，状态复位必须幂等。
5. 详情只读态控件不可交互；下拉与选择器交互需在编辑态或专项授权下验证。
6. token、口令、Cookie 一律脱敏，不写入报告与知识库。

## 4. 页面知识位置

| 文件 | 用途 |
| --- | --- |
| `knowledge/athena-page-map.json` | 页面入口、`workItemCode`、实体、字段 |
| `knowledge/athena-component-map.json` | 控件 → 定位配方（含 `verified`） |
| `knowledge/athena-business-rules.json` | 已验证业务规则 |
| `knowledge/athena-prd-map.json` | 作业 → 最新 PRD、实体、字段、测试计划 |

单页示例：`invnt-param`（存货参数），实体 `ops_unit_invnt_param`，`workItemCode` `DTBBArnXZHrt`。

## 5. 完成标准

- `npm run build` 通过。
- `npm run test:unit` 全绿。
- 真实页面验证有截图与 DOM 证据。
- 文档、知识库、用例三处保持一致。
