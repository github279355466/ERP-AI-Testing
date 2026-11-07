# Athena ERP 自动化测试框架

基于 TypeScript + Playwright 的 Athena ERP 测试框架，支持接管已登录 Chrome（CDP）与独立 Chromium 回归两种模式。

当前阶段：**框架 MVP + 只读验证**。未实现写入型用例，也不会批量执行测试计划。

工作区交接与目录说明见 `docs/WORKSPACE-HANDOFF-20261106.md`；浏览器 profile 位于 `probe/chrome-profile`，用 `npm run browser:start` 启动。

## 环境要求

| 项 | 要求 |
| --- | --- |
| Node.js | 22 或更高（本机 v24 已验证） |
| Playwright | 1.62.1（与已安装的 Chromium 1234 匹配） |
| 网络 | 需经代理 `http://127.0.0.1:10808` 访问 ERP |
| 浏览器 | 已登录的 Chrome，开启远程调试端口 `9333` |

## 安装

```bash
npm install
npm run build
```

## 启动可接管的 Chrome

```bash
npm run browser:start
```

等价原始命令（profile 取 `config/athena.config.json` 的 `browser.userDataDir`）：

```text
chrome.exe
  --no-sandbox
  --remote-debugging-port=9333
  --user-data-dir=D:\AIProject\ERP-AI-Testing\probe\chrome-profile
  --proxy-server=http://127.0.0.1:10808
  --ignore-certificate-errors
  --no-first-run --no-default-browser-check
  https://athena-test.digiwincloud.com.cn/
```

在窗口中人工登录（鼎捷云帐号，租户 `digichannel`），并在左侧菜单打开目标作业（例如「基础管理 → 系统参数 → 存货参数」），使其成为一个独立业务窗口。详见 [浏览器连接说明](docs/BROWSER-CONNECTION.md)。

## 常用命令

```bash
# 环境自检：配置、CDP、知识库、可见页面
npm run athena -- doctor

# 查看当前页面状态（页签、行数、表单字段数，URL 已脱敏）
npm run athena -- status

# 探索当前业务页（列表）
npm run athena -- explore --id invnt-param --workItemCode DTBBArnXZHrt --entity ops_unit_invnt_param

# 探索详情表单（打开「查看」后采集字段，结束自动关闭页签）
npm run athena -- explore --id invnt-param --detail

# 只读冒烟
npm run athena -- verify --page-id invnt-param

# 执行只读用例
npm run athena -- verify --case cases/invnt-param-readonly.json

# 执行 TP-002 存货参数完整只读用例
npm run athena -- verify --case cases/tp-002-invnt-param-readonly.json

# 重新生成报告
npm run athena -- report --results artifacts/<run-id>/results.json

# 生成 PRD 索引（扫描 paths.prd，取每个作业最新版）
npm run athena -- prd:index

# 查看作业或测试计划关联的最新 PRD
npm run athena -- prd:show --work-item 应付单
npm run athena -- prd:show --plan TP-052

# 读取 PRD 业务逻辑章节原文
npm run athena -- prd:section --work-item 应付单 --section 2.4

# 单元测试
npm run test:unit

# 真实浏览器冒烟（需要 Chrome 已打开业务页）
npm run test:smoke
```

运行产物位于 `artifacts/<run-id>/`：`results.json`、`report.md`、`report.html`、`shots/`、`dom/`、`logs/`。

## 目录结构

```
config/athena.config.json     环境、浏览器、超时、安全策略、PRD 目录
knowledge/                    页面 / 控件 / 业务规则 / PRD 索引
cases/                        只读用例定义
src/
  browser/   CDP 与 Chromium 适配器、页面管理
  locator/   稳定选择器与字段锚点
  controls/  Form / Grid / Dropdown / Lookup / Modal / Tabs
  discovery/ 页面探索与候选元数据生成
  assertion/ 三级断言引擎
  evidence/  截图、DOM、日志、请求（自动脱敏）
  reporting/ Markdown 与 HTML 报告
  runner/    只读执行器与安全策略
  knowledge/ 知识库加载与校验
  cli/       命令行入口
tests/unit/  纯逻辑单元测试
tests/smoke/ 真实浏览器冒烟
docs/        架构、连接、探索报告、验收报告
skills/      项目级 athena-erp-testing Skill
```

## 安全边界

- 默认只读：执行器只接受 `open`、`click`、`waitFor`、`assert*`、`dropdownOptions`、`lookupInfo`、`screenshot`、`snapshot`、`closeTab`。
- 点击前先解析目标元素文本；文本为空或命中「保存 / 删除 / 审核 / 反审核 / 结账 / 过账 / 作废」等词会被直接拒绝。
- `open` 仅允许门户与低代码业务主机；下拉和选择器只允许打开、读取、关闭，不选择、不确认。
- 不保存账号口令；URL 与日志中的 `token`、`password`、`cookie` 自动脱敏。
- 关闭未保存页签统一选择「直接离开」。

## 当前状态

- 已实现：CDP 接管、页面管理、DOM/截图采集、控件识别、只读执行、三级断言、证据与报告、知识库校验。
- 未实现：测试计划（Markdown）解析与批量调度、写入型用例、数据清理、跨租户参数化、云端发布。

详见 [MVP 验证报告](docs/MVP-VALIDATION.md) 与 [技术设计](docs/ARCHITECTURE.md)。
