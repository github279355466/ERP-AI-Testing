# AGENTS.md

本仓库是 Athena ERP 的 Playwright 自动化测试框架。所有改动先读 `docs/ARCHITECTURE.md`。

## 1. 不可违反

- 默认只读。不得实现或触发保存、删除、审核、反审核、结账、过账、作废等写操作，除非用户当次明确授权并给出专用测试数据与清理方案。
- 不得虚构 ERP 页面结构、字段或业务规则。未验证内容标 `UNKNOWN`，推测内容标 `candidate`。
- 不得把账号、口令、token、Cookie 写入代码、配置、日志、报告或 Git。
- 常规操作不得使用页面绝对坐标；自定义组件必须真实点击时，用元素包围盒计算。
- 不得把「点击成功」「页面提示成功」当作业务成功，必须分层断言。

## 2. 开发方式

增量推进，一次只做一个模块：

1. 读现有实现与相关文档。
2. 先写或更新设计说明（必要时更新 `docs/ARCHITECTURE.md`）。
3. 实现该模块。
4. 补单元测试并运行。
5. 涉及真实页面时，用 CDP 做一次只读验证。
6. 输出验收结果，通过后再进入下一个模块。

禁止一次性铺开大量代码后再统一验证。

## 3. 代码约定

| 位置 | 职责 |
| --- | --- |
| `src/browser/` | 适配器与页面管理，不写业务断言 |
| `src/locator/` | 选择器与字段锚点，禁止散落魔法字符串 |
| `src/controls/` | 控件原语，读为主；不提供保存类方法 |
| `src/discovery/` | 采集与候选元数据生成，不直接写 confirmed |
| `src/assertion/` | 三级断言：ui / business / persistence |
| `src/evidence/` | 截图、DOM、日志、请求，统一脱敏 |
| `src/reporting/` | Markdown / HTML 渲染，纯函数 |
| `src/runner/` | 只读动作白名单与执行编排 |
| `src/knowledge/` | 知识库加载与结构校验 |

- TypeScript 严格模式，公共函数显式声明返回类型。
- 新增控件能力前，先在 `knowledge/athena-component-map.json` 里写清定位与 `verified` 状态。
- 新增页面知识只写 `candidate`，人工确认后再改 `confirmed` 并补 `verifiedAt`。

## 4. 常用命令

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:smoke
npm run athena -- doctor
npm run athena -- explore --id <page-id> [--detail]
npm run athena -- verify --page-id <page-id>
npm run athena -- verify --case <case.json>
```

## 5. 测试规范

- 单测覆盖纯逻辑；真实浏览器验证放 `tests/smoke` 或 `cases/`。
- 用例必须含：前置条件、步骤、预期、断言、证据。
- 失败必须留截图 + DOM + 错误信息；阻塞写 `blocked`，跳过写 `skipped`。
- 证据目录结构：`artifacts/<run-id>/{results.json,report.md,report.html,shots,dom,logs}`。

## 6. 知识库

- `knowledge/athena-page-map.json`：页面入口、`workItemCode`、实体、字段。
- `knowledge/athena-component-map.json`：控件到定位配方的映射。
- `knowledge/athena-business-rules.json`：仅收录已验证规则。
- 更新后运行 `npm run athena -- verify` 自查，并确认知识库能被 `KnowledgeBase.load` 正常加载。

## 7. 完成标准

- `npm run build` 无错误。
- `npm run test:unit` 全绿。
- 新增能力有对应测试或真实页面证据。
- 文档与知识库同步更新，未验证项明确标注。

## 8. 数据落盘约定

所有产出留在本仓库内，不写入 agent 会话目录（会话目录只放会话元数据）：

| 内容 | 位置 |
| --- | --- |
| 浏览器 profile（登录态） | `probe/chrome-profile`，经 `browser.userDataDir` 配置，不提交 |
| 探索脚本、抓图、临时诊断 | `probe/` |
| 会话交付物（分析报告、字典、设计稿） | `artifacts/session-outputs/` |
| 测试运行证据 | `artifacts/<run-id>/` |

浏览器 profile 含数万小文件与 Cookie，放进会话工作区会让客户端打开会话时扫描卡顿，必须留在仓库内。