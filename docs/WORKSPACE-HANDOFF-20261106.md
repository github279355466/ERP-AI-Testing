# 工作区交接说明（2026-11-06）

> **时效声明（2026-11-08）**：本文件是 2026-11-06 工作区迁移当天的快照，文中的单测数量、知识库份数、run 数与目录清单已过期。
> 当前状态与目录以 `README.md`、`docs/ARCHITECTURE.md`、`.workbuddy/memory/MEMORY.md` 为准；迁移结论（profile 不进会话目录、产物留仓库）仍然有效。

> 给后续会话/协作者看：项目资产已全部迁到 `D:\AIProject\ERP-AI-Testing`，agent 会话目录不再存放任何文件。
> 后续工作请直接在本目录进行，不要再读写 `C:\Users\Administrator\Documents\IndepthAI\2026-11-06\new-chat`。

## 1. 为什么迁移

会话「ERP-AI-Testing」点开就卡死，根因不是历史记录太大（4.5 MB / 556 条条目 / 6 轮全部 completed），而是会话工作区里躺着浏览器 profile：

- 位置：`new-chat\probe\chrome-profile`
- 体量：285 个文件 / 109.5 MB
- 后果：每次打开会话都要扫描工作区找产物，卡在该目录上；当日日志出现 27 条 artifact-scan 拒绝记录，并伴随多次「窗口无响应」，渲染长任务分别持续 390 秒和 404 秒。

## 2. 已完成的处理

| 项 | 结果 |
| --- | --- |
| 浏览器 profile 迁出会话目录 | 迁至 `probe/chrome-profile`，迁移前后均为 285 文件 / 109.5 MB |
| 探测脚本与截图迁出 | 26 项（15 个脚本、1 个 Python 工具、截图与诊断文件）迁至 `probe/` |
| 会话交付物迁出 | 5 份迁至 `artifacts/session-outputs/` |
| 会话目录清理 | `new-chat` 现有 0 个文件，空子目录已删除 |
| 重复 Skill 清理 | 只保留 `skills/athena-erp-testing`；工作区副本 13 个文件归档到 `.archive/athena-erp-testing-workspace-copy-20261106` |
| 产物登记清理 | DevCenter 里指向工作区的那条 Skill 登记已删除；会话产物清单里失效的 42 条记录已清理 |
| 浏览器启动配置 | 新增 `browser.userDataDir`，`npm run browser:start` 一键启动 |

## 3. 目录结构与内容

项目根：`D:\AIProject\ERP-AI-Testing`

| 目录/文件 | 内容 | 谁写入 |
| --- | --- | --- |
| `src/` | 框架源码，25 个 TS 文件，分层为 `browser` / `locator` / `controls` / `discovery` / `assertion` / `evidence` / `reporting` / `runner` / `knowledge` / `config` / `cli` | 开发改动 |
| `tests/unit/` | 纯逻辑单测 9 个 spec（33 个用例，当前全绿） | 开发改动 |
| `tests/smoke/` | 真实页面冒烟 `cdp-discovery.spec.ts`，依赖 CDP 浏览器 | 开发改动 |
| `knowledge/` | 3 份知识库：`athena-page-map.json`（页面入口/实体/字段）、`athena-component-map.json`（控件定位配方含 verified）、`athena-business-rules.json`（已验证规则） | 探索后更新 |
| `cases/` | 只读用例，当前 `invnt-param-readonly.json` | 用例编写 |
| `config/athena.config.json` | 环境、浏览器（含 `userDataDir`）、路径、安全策略 | 配置维护 |
| `docs/` | `ARCHITECTURE.md`（分层设计）、`BROWSER-CONNECTION.md`（启动与登录）、`PAGE-DISCOVERY-REPORT.md`（已确认页面事实）、`MVP-VALIDATION.md`（验收状态）、`screenshots/` 5 张 | 文档维护 |
| `probe/` | 探索期脚手架：15 个探针脚本（`01-home.js`~`11-grid.js`、`lib.js`、`spawn-chrome.js` 等）、1 个 Python 工具、`shots/` 21 张页面截图、根目录 4 张抓图、`chrome-profile/` 登录态 profile（109.5 MB）、`chrome-profile2/` 旧 profile（4 MB） | 探索过程 |
| `artifacts/` | 运行证据，按 `artifacts/<run-id>/` 存放（当前 11 个 run） | 运行产出 |
| `artifacts/session-outputs/` | 上一轮会话交付物：`页面元素分析报告.md`、`component-tree.json`、`field-dict.json`、`menu-tree.json`、`page-design-存货参数.json` | 会话交付 |
| `athena-erp-test-plans/` | 历史规划：`plans/`、`templates/`、`knowledge/`、`README.md`、`CODEX-EXECUTION-INSTRUCTIONS.md` | 规划文档 |
| `skills/athena-erp-testing/` | 项目内 Skill：`SKILL.md` + `digi_meta.json`（唯一保留的一份） | 技能维护 |
| `scripts/` | `start-chrome.ps1`（按配置启动 Chrome）、`debug-state.js` | 运维脚本 |
| `.archive/` | 归档区，仅 `athena-erp-testing-workspace-copy-20261106/`，不进 Git | 人工 |
| `dist/` | `tsc` 编译产物，`npm run athena` 依赖 | 构建 |
| `node_modules/` | 依赖，Playwright 1.62.1 + TypeScript 5.9.3 | 安装 |
| `AGENTS.md` | 不可违反的只读原则、开发方式、代码约定、命令、测试规范、数据落盘约定 | 人工 |

## 4. 后续应读取哪些

按目的选，不用全读：

1. 接手项目：`AGENTS.md` → `README.md` → `docs/ARCHITECTURE.md`
2. 连浏览器 / 登录：`docs/BROWSER-CONNECTION.md`
3. 已确认的页面事实：`docs/PAGE-DISCOVERY-REPORT.md`，再看 `knowledge/*.json`
4. 当前完成度与缺口：`docs/MVP-VALIDATION.md`
5. 上一轮的页面分析结论：`artifacts/session-outputs/页面元素分析报告.md`
6. 项目内作业规范：`skills/athena-erp-testing/SKILL.md`

## 5. 浏览器与 profile 约定

- profile 路径由 `config/athena.config.json` 的 `browser.userDataDir` 决定，当前值 `probe/chrome-profile`，相对项目根解析为 `D:\AIProject\ERP-AI-Testing\probe\chrome-profile`。
- 支持环境变量覆盖：`ATHENA_USER_DATA_DIR`。
- 启动：`npm run browser:start`（等价参数见 `docs/BROWSER-CONNECTION.md` 第 2 节），端口取 `browser.cdpEndpoint`（当前 9333），代理取 `browser.proxy`。
- 自检：`npm run athena -- doctor` 的 `profile` 检查项会打印实际绝对路径。
- `probe/chrome-profile`、`probe/chrome-profile2`、`.archive/` 已加入 `.gitignore`；profile 含登录 Cookie，不得提交。

## 6. 验证记录

- `npm run typecheck` 通过
- `npm run build` 通过
- `npm run test:unit` 33 个用例全绿
- `npm run athena -- doctor`：`config` / `profile` / `knowledge` 三项 ok，`profile` 返回 `D:\AIProject\ERP-AI-Testing\probe\chrome-profile`；`cdp` 与 `browser` 失败属预期（当时未启动 Chrome）

## 7. 硬约束（沿用于后续会话）

1. 默认只读，保存/删除/审核/结账等写操作零实现，需当次授权。
2. 不得把账号、口令、token、Cookie 写入代码、配置、日志、报告或 Git。
3. 不得把浏览器 profile、大批量截图、临时诊断文件写回 agent 会话目录。
4. 新增页面知识只写 `candidate`，人工确认后再改 `confirmed` 并补 `verifiedAt`。
5. 测试结果必须带证据：截图 + DOM + 错误信息。

## 8. 待确认事项

- `probe/` 下的一次性诊断脚本是否归拢到 `probe/scratch/`，只保留 `shots/` 与常用脚本。

## 9. 2026-11-06 增量变更

- 已初始化 Git 仓库，`.gitignore` 覆盖 `node_modules/`、`dist/`、`artifacts/`、`test-results/`、浏览器 profile 与 `.archive/`；profile 未进入暂存区。
- 只读策略收口：`click` 先解析目标文本再判定（空文本拒绝）、`open` 限制在门户/低代码主机、下拉与选择器改用 `popup` 只读动作、`closeTab` 使用独立动作；新增对应单测 4 个。
- 新增 TP-002 只读用例 `cases/tp-002-invnt-param-readonly.json`，覆盖列表结构、详情字段、下拉枚举、基础资料选择器与关闭详情后的列表恢复。
- 执行器新增 `assertSwitch`、`assertReadonly`、`assertGrid`，并扩展 `dropdownOptions` / `lookupInfo` 的断言字段。
- 当前单测 37 个全绿，`typecheck` 与 `build` 通过。

## 10. PRD 关联

- PRD 根目录配置在 `config/athena.config.json` 的 `paths.prd`，可用 `ATHENA_PRD_DIR` 覆盖；`--dir` 可临时指定。
- `npm run athena -- prd:index` 扫描 19 个作业目录，按语义化版本取最新版（`v1.10 > v1.9`），生成 `knowledge/athena-prd-map.json`。
- 当前 19 个作业中 15 个匹配到 TP 计划；`其他应付单`、`其他应收单`、`应付单`、`应收单` 暂无对应计划。
- 索引抽取 PRD 类型、业务对象/实体、章节、子章节和字段清单；`KnowledgeBase` 会加载并校验该索引。
- 查询：`npm run athena -- prd:show --work-item 应付单` 或 `--plan TP-052`；业务逻辑用 `prd:section --work-item 应付单 --section 2.4` 读取原文。
- 详细映射见 `docs/PRD-MAPPING.md`。PRD 只作为预期来源，不能直接替代页面运行证据。

## 11. 2026-11-06 TP-064 / TP-065 执行

- 会计期间表：`workItemCode=cEBGcJzbDWkQ`，页面 `acctg-perid-table`，TP-064 通过 23 条断言。
- 会计期间信息：`workItemCode=hoRpQwPEmnlK`，页面 `acctg-perid-info`，TP-065 通过 30 条断言。
- 两支作业均只读；执行后列表分别为 8 条、3 条，无残留详情页签。
- 合并报告：`artifacts/session-outputs/TP-064-065-测试报告.md`。
- 运行证据：`artifacts/20261106-072308-6c8b/`、`artifacts/20261106-072333-838n/`。
