# Athena ERP 自动化测试框架

基于 TypeScript + Playwright 的 Athena ERP 测试框架，支持接管已登录 Chrome（CDP）与独立 Chromium 回归两种模式。

当前阶段：**v2.0 P6 采购示范验收与平台固化**。平台核心、模块包、执行/断言/报告链路已打通；采购订单主流程真实 UI 执行通过，基础管理/应收/应付完成列表只读冒烟。默认只读，写操作必须由运行配置显式授权。

架构入口：`docs/architecture/TO-BE.md`；边界规则：`docs/architecture/BOUNDARIES.md`；升级过程：`docs/upgrade/`。

## v2.0 三层架构

```text
Platform Core            通用能力：浏览器、定位、控件、场景、用例、执行、断言、报告、治理
Business Module Packs    业务差异：purchase / sales / inventory / ar / ap / production
Integration Test Packs   跨模块链路：purchase-to-ap 等
```

- 平台核心只建设一次，不得写入采购等具体业务字段、流程或选择器。
- 模块包只提供本模块的页面映射、场景、用例、数据配方与套件。
- 集成包只引用模块用例，不复制模块内部步骤。
- 当前 P1 只建立骨架与契约；`src/`、`knowledge/`、`cases/` 保留为 legacy，P2-P6 分阶段迁移。

契约校验：

```bash
npm run platform:validate   # 全量校验示例、模块包、集成包
npm run platform:check      # typecheck + 单测 + 契约测试
npm run test:contract       # 契约正反例与版本兼容测试
npm run platform:prd:scan -- --module purchase   # 模块化 PRD 扫描
npm run platform:plan:dry-run -- --module purchase  # 场景编译 + 执行计划推演（不连 ERP）
npm run p6:system-smoke     # 四模块只读冒烟（需 ALLOW_ERP_UI_TEST=true）
npm run p6:system-smoke:write  # 追加采购订单创建（写授权）
```

工作区交接与目录说明见 `docs/WORKSPACE-HANDOFF-20261106.md`；浏览器 profile 位于 `probe/chrome-profile`，用 `npm run browser:start` 启动。

## Phase 1：PRD 扫描与业务知识建模

Phase 1 是纯静态建模阶段：**不连接 ERP、不启动浏览器、不执行任何业务操作**。

```bash
npm run prd:scan              # 全量扫描 + 建模 + 报告（写 artifacts/knowledge）
npm run prd:scan:incremental  # 增量扫描，未变化文档复用 .parse-cache
npm run prd:validate          # 只读校验现有知识库（不重扫、不写文件）
npm run prd:report            # 只读渲染报告（不重扫；--out <dir> 可重定向）
```

产出：

- `artifacts/knowledge/*.json`：Document / Entity / Page / Field / Control / Rule / Action / Workflow / Dependency / Scenario / OpenQuestion / ExistingCase / Evidence 共 13 类对象。
- `artifacts/source-index/DOCUMENT_REGISTER.json`：540 个扫描文件全登记，含未建模与不支持格式原因。
- `reports/*.md`：PRD 索引、分析、覆盖率矩阵、待确认问题、版本冲突、场景草案。
- `schemas/*.schema.json`：正式 JSON Schema，由 `npm run prd:schemas` 生成，`prd:validate` 用 ajv 执行。

PRD 路径不写死在仓库：默认配置使用 `${PRD_WORKSPACE}` 占位符，本机路径放在被 Git 忽略的
`config/prd-modeling.config.local.json`；也可用环境变量 `PRD_INPUT_DIR` 或 `--prd <dir>` 覆盖。

规则证据必须可定位：`source_refs` 内含 `doc_version`、`sha256`、`line_start` 与该行逐字 `excerpt`，
`prd:validate` 会对每条 `PRD_EXPLICIT` 规则回读原文比对，不一致即 ERROR。

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
platform/                     平台核心契约、校验器与后续引擎
adapters/                     业务无关控件/页面适配原语（P4）
business-modules/             业务模块包（purchase 为示范模块）
integration-tests/            跨模块集成测试包（purchase-to-ap）
runtime/                      环境、用户标识与运行配置（不含凭据）
executions/                   单次运行产物（P5）
tools/                        平台治理工具（当前入口 src/cli/platform.ts）
docs/architecture/            AS-IS / TO-BE / 边界（当前架构事实源）
docs/contracts/               契约说明
docs/decisions/               ADR
docs/runbooks/                校验与模块接入操作手册
knowledge/                    [legacy] 页面 / 控件 / 业务规则 / PRD 索引
cases/                        [legacy] 只读用例定义
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
tests/unit/     纯逻辑单元测试
tests/contract/ 契约正反例、版本兼容与 CLI 测试
tests/platform/ 平台自检（P1 静态检查在 contract）
tests/smoke/    真实浏览器冒烟
docs/        架构、连接、探索报告、验收报告
skills/      项目级 athena-erp-testing Skill
```

`src/`、`knowledge/`、`cases/` 在 P1 保持可运行，但不再作为新能力的落点；P2-P6 按 `docs/upgrade/P0-MIGRATION-PLAN.md` 迁移。

## 安全边界

- 默认只读：运行配置默认 `read_only`，高风险动作默认关闭。
- `controlled_write` 必须显式授权，并声明允许动作、专用测试数据与清理方案；未授权时保存、提交、审核、撤审、删除一律拒绝。
- 点击前先解析目标元素文本；文本为空或命中「保存 / 删除 / 审核 / 反审核 / 结账 / 过账 / 作废」等词时，只在已授权动作范围内放行。
- `open` 仅允许门户与低代码业务主机；下拉和选择器只允许打开、读取、关闭，不选择、不确认。
- 不保存账号口令；URL 与日志中的 `token`、`password`、`cookie` 自动脱敏。
- 关闭未保存页签统一选择「直接离开」。

## 当前状态

- 已实现：三层架构骨架、15 个核心 Schema（含公共定义）、校验器、运行清单 v2 与 v1 适配、模块/集成包模板、运行时配置骨架、版本兼容检查、契约测试与 CLI。
- 保留可用：CDP 接管、页面管理、DOM/截图采集、控件识别、执行器、三级断言、证据与报告、Phase 1 PRD 静态建模。
- 已完成：P1 平台骨架、P2 知识引擎、P3 场景编译、P4 页面适配与数据配方、P5 执行/断言/报告、P6 采购示范与多模块试接入。
- 验收文档：`docs/acceptance/P1-ACCEPTANCE.md` ~ `P6-ACCEPTANCE.md`、`docs/acceptance/FINAL-ACCEPTANCE.md`。
- 后续扩展：采购到货/入库/退货流程迁移、应收/应付业务深度、跨模块 purchase→ap、测试数据清理执行器。
- 未实现：跨租户参数化、云端发布；采购退货出库已知 Bug 暂不处理。

详见 [MVP 验证报告](docs/MVP-VALIDATION.md)、[历史技术设计](docs/ARCHITECTURE.md) 与 [当前架构](docs/architecture/TO-BE.md)。
