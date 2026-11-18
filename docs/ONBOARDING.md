# 快速上手与自动化测试开启指南

面向第一次克隆本仓库的同事：按本文顺序执行，可以从零跑通一次只读自动化测试。
架构设计见 `docs/architecture/OVERVIEW.md`；业务侧计划、执行与验收规范见 `docs/自动化测试平台-使用指导说明书.md`。

- 平台基线：1.0.0
- 本文命令实测环境：Windows 11 + PowerShell 7 + Node.js 24.19.0（2026-11-18）
- macOS / Linux：未验证，状态 `UNKNOWN`

## 0. 先判断环境是否可用

三步判断，全部通过再谈业务用例：

```powershell
npm run platform:health     # 运行时/配置/Schema/模块包/产物目录
npm run platform:validate   # 资产契约
npm run test:unit           # 纯逻辑单测
```

## 1. 拿到访问权限

| 需要的权限 | 来源 |
| --- | --- |
| GitHub 私有仓库读权限 | 仓库所有者邀请（当前账号 `github279355466`） |
| ERP 测试环境账号 | 测试负责人分配，租户 `digichannel` |
| 代理 `http://127.0.0.1:10808` | 测试负责人 / IT |
| 写操作授权 | 测试负责人按批次书面授权，逐次有效 |

ERP 地址：`https://athena-test.digiwincloud.com.cn/`，环境类型必须是 `test`，生产环境会被门禁拒绝。

账号、口令、Cookie、Token 只允许通过环境变量或人工登录传入，不得写进任何仓库文件。

## 2. 安装

```powershell
git clone https://github.com/github279355466/ERP-AI-Testing.git
cd ERP-AI-Testing
npm install        # 仓库含 package-lock.json，也可用 npm ci
npm run build
```

要求 Node.js 22 及以上（`package.json` 的 `engines`）。启动脚本 `scripts/start-chrome.ps1` 要求 PowerShell 7。

## 3. 静态自检（不连 ERP、不启浏览器）

新机器第一次接触仓库，先跑这一组，确认代码和资产是完整的：

```powershell
npm run platform:health
npm run platform:validate
npm run test:unit
npm run test:contract
npm run test:platform
npm run test:integration
```

`npm run platform:check` 等于 typecheck + 单测 + 契约测试 + 平台测试，提交前跑这一条即可。

2026-11-18 实测基线：

| 命令 | 结果 |
| --- | --- |
| `platform:health` | required 检查全部通过；`cdp` 为可选检查，未启动浏览器时 `ok=false` 属正常 |
| `platform:validate` | 20/20 通过，0 error，2 warning（`_template` 集成包依赖占位模块） |
| `test:unit` | 139 passed |
| `test:contract` | 92 passed |
| `test:platform` | 94 passed |
| `test:integration` | 27 passed |

`platform:validate` 只做静态校验，不访问 ERP、不写业务数据。失败时退出码非 0，不会静默跳过。

## 4. 启动专用 Chrome 并登录

平台通过 CDP 接管一个独立的 Chrome，profile 固定为 `probe/chrome-profile`（含登录 Cookie，已加入 `.gitignore`，不得提交）。

```powershell
npm run browser:start
```

门户菜单接口存在 CORS 限制时，用同一脚本的等价命令：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-chrome.ps1 -DisableWebSecurity
```

启动后在浏览器窗口里人工登录（鼎捷云账号，租户 `digichannel`），并打开目标作业页，让它成为一个独立业务窗口。

要点：

- CDP 端点默认 `http://127.0.0.1:9333`，来自 `config/athena.config.json` 的 `browser.cdpEndpoint`，可用 `ATHENA_CDP_ENDPOINT` 覆盖。
- Chrome 重启后 `sessionStorage` 登录态会丢失，需要重新登录；或设置 `ERP_LOGIN_STRATEGY=form` 由脚本表单登录。
- 端口被占用时脚本会提示已有实例，`-Force` 可再开一个窗口，但同一端口只能有一个监听者。

## 5. 跑第一次只读自动化测试

只读验证需要环境门禁开关，且只在当前 PowerShell 会话生效：

```powershell
$env:ALLOW_ERP_UI_TEST='true'

npm run athena -- doctor --connect
npm run athena -- status
npm run athena -- verify --page-id invnt-param
npm run athena -- verify --case cases/invnt-param-readonly.json
```

- 未设置 `ALLOW_ERP_UI_TEST=true` 时，`doctor` 的 `gate` 检查返回 `[AUTHORIZATION_MISSING] 未显式设置 ALLOW_ERP_UI_TEST=true，拒绝连接 ERP`，这是设计行为，不是故障。
- `status` 只读当前页面状态，URL 已脱敏。
- `verify --page-id` 按知识库里的页面映射做只读冒烟；`verify --case` 执行 `cases/` 下的只读用例定义。

平台级只读冒烟：

```powershell
npm run p6:system-smoke     # 四模块只读冒烟，需要 Chrome 已启动并登录
npm run ui:spec             # 界面规范校验，见 docs/PHASE4-界面规范校验.md
```

## 6. 跑模块用例（平台运行器）

先看模块里有哪些用例，再决定跑哪一条：

```powershell
node dist/cli/platform-run.js cases --module purchase
node dist/cli/platform-run.js run --module purchase --case SMOKE-PURCHASE-ORDER-LIST
```

不需要浏览器的两条链路，适合先验证调度、断言、报告是否正常：

```powershell
npm run platform:run:simulate -- --module purchase --limit 20
npm run platform:plan:dry-run -- --module purchase
```

- `simulate` 使用占位执行器，跑通套件调度、断言、报告链路，不启动浏览器、不访问 ERP。
- `plan:dry-run` 做场景编译与执行计划推演，同样不连 ERP；用例数量取决于本地 PRD 知识库产物，新克隆的仓库没有该产物时结果会不同。

## 7. 开启写操作（默认关闭，需逐次授权）

写操作必须同时满足三个条件：

1. 当次获得明确授权；
2. 使用写配置 `config/athena.write.config.json`（`readOnly=false`、`allowWrite=true`）；
3. 命令带 `--allow-write`。

```powershell
node dist/cli/platform-run.js run --module purchase --case SMOKE-PURCHASE-ORDER-CREATE --allow-write --config config/athena.write.config.json
```

采购订单全操作闭环（写 + 删除，仅限本代理创建的数据）：

```powershell
npm run p7:purchase-lifecycle
```

写操作配套规则：

- 数据统一用 `QA26` 前缀，新增主数据登记到 `config/test-data/qa26-master-data.json`。
- 数据默认保留、不自动清理；需要清理时按依赖倒序执行：价格 → 批号 → 采购信息 → 存货信息 → 品号 → 客户 → 供应商 → 群组 → 仓库 → 单位。
- 即使打开写配置，`allowPosting` 仍为 `false`，`结账 / 过账 / 作废` 始终在禁止文本内。
- 不得对生产环境、跨租户或未授权数据执行写操作。

## 8. 命令速查

静态检查（无副作用）：

```powershell
npm run build
npm run typecheck
npm run platform:health
npm run platform:validate
npm run platform:check
npm run test:unit | npm run test:contract | npm run test:platform | npm run test:integration
```

模块与集成包校验：

```powershell
npm run platform:module -- business-modules/purchase
npm run platform:integration -- integration-tests/purchase-to-ap
npm run platform:file -- platform/contracts/examples/testcase.valid.json --schema test-case
```

注意脚本参数形式：`platform:module` 的 npm 脚本已经内置 `--path`，因此只传路径，不要再写 `-- --path ...`。

知识库与计划（本地 PRD 目录可用时）：

```powershell
npm run prd:scan
npm run prd:validate
npm run prd:report
npm run platform:prd:scan -- --module purchase
npm run platform:plan:compile -- --module purchase
npm run platform:plan:validate -- --module purchase
npm run platform:plan:dry-run -- --module purchase
```

运行时自检：

```powershell
npm run platform:runtime:doctor
npm run platform:runtime:pages
npm run platform:runtime:recipes
npm run athena -- doctor
npm run athena -- status
```

## 9. 环境变量

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `ALLOW_ERP_UI_TEST` | 连接 ERP 的总开关，必须为 `true` | 未设置，拒绝连接 |
| `ERP_USERNAME` / `ERP_PASSWORD` | 表单登录凭据，只在 `ERP_LOGIN_STRATEGY=form` 时使用 | 空 |
| `ERP_LOGIN_STRATEGY` | `manual` / `form` / `storage-state` | `manual` |
| `ATHENA_CONFIG` | 覆盖运行配置文件路径 | `config/athena.config.json` |
| `ATHENA_CDP_ENDPOINT` | 覆盖 CDP 端点 | `http://127.0.0.1:9333` |
| `ATHENA_PROXY` | 覆盖浏览器代理 | `http://127.0.0.1:10808` |
| `ATHENA_BROWSER_MODE` | `cdp` 或 `launch` | `cdp` |
| `ATHENA_STORAGE_STATE` | 登录态文件路径 | 空 |
| `ATHENA_USER_DATA_DIR` | Chrome profile 目录 | `probe/chrome-profile` |
| `PRD_INPUT_DIR` | 覆盖 PRD 根目录 | 取 `config/prd-modeling.config.json` |

 
凭据类变量只在本机 shell 或 `.env`（已被忽略）中设置，禁止提交、禁止打印。

## 10. 产物与证据

| 内容 | 位置 | 是否入库 |
| --- | --- | --- |
| 单次运行产物 | `artifacts/<run-id>/`（`results.json`、`report.md`、`report.html`、`shots/`、`dom/`、`logs/`） | 否 |
| 渲染后的执行报告 | `reports/runs/` | 否 |
| 执行记录 | `executions/` | 仅 `README.md` |
| 会话交付物 | `artifacts/session-outputs/` | 否 |
| 探索证据 | `probe/evidence/` | 否（`probe/chrome-profile` 必须排除） |

失败用例必须留下截图、DOM/请求与错误信息；证据统一脱敏，不落 token、Cookie、账号口令。

## 11. 常见故障

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `[AUTHORIZATION_MISSING]` | 未设 `ALLOW_ERP_UI_TEST=true` | 在当前会话执行 `$env:ALLOW_ERP_UI_TEST='true'` |
| `cdp fetch failed` | Chrome 未启动或端口不对 | 跑 `npm run browser:start`，核对 9333 端口 |
| 页面出现登录表单、判定 `session_expired` | 登录态过期 | 窗口内重新登录；或改用 `form` 策略并设置凭据变量 |
| 知识库版本不匹配、拒绝执行 | 期望版本 `KM-380242c08313e3c2` 与实际产物不一致 | 先 `npm run prd:scan` 重建；确认变更无误后更新 `knowledge.expectedModelVersion` |
| PC 上有多个 Node 版本、命令报错 | Node < 22 | 切换到 22 及以上版本重新 `npm install` |
| `start-chrome.ps1` 报版本错误 | 用了 PowerShell 5.1 | 改用 `pwsh`（PowerShell 7） |
| 列表空白 | 详情页签未关闭或列表未回到初始态 | 关闭详情页签后重试，执行器会强制重载列表 |
| 保存按钮禁用 | 前端校验未过 | 打开左下角“错误列表”读取校验项，不要盲目重试 |
| 仓库或储位必填 | 目标仓库启用了储位管理 | 明细仓库改选未启用储位管理的仓库（如 `00CP`） |
| 明细列看不到 | 列被隐藏 | 点明细工具栏齿轮勾选字段，再横向滚动 |
| 单号已存在 | 手工编码单别重复 | 换单号；自动编码单别不要手工填单号 |

## 12. 新增模块或用例

新建模块包：

```powershell
Copy-Item -Recurse business-modules/_template business-modules/<module-id>
npm run platform:module -- business-modules/<module-id>
```

资产落点与评审流程见 `docs/runbooks/module-onboarding.md`，要点：

- 初始 `module.status` 保持 `draft`，资产目录允许暂缺（给 warning）。
- 页面映射未逐字段复核前保持 `status: candidate` / `verified: false`。
- 页面整体人工评审通过后再改 `confirmed`；模块评审通过后再改 `reviewed` / `approved`。
- 平台核心不得写模块字段、选择器或业务流程；复用能力先抽到 `adapters/` 或 `platform/`。

新增用例：在 `business-modules/<module-id>/testcases/` 加 YAML，先 `navigate` 再 `invoke_flow`，只读列表可复用内置流程 `platform:list-smoke`。用例必须含前置条件、步骤、预期、断言与证据要求。

## 13. 硬约束

- 默认只读；保存、删除、审核、反审核、结账、过账、作废必须当次授权。
- 不虚构页面结构、字段与业务规则；未验证标 `UNKNOWN`，推测标 `candidate`。
- 不使用页面绝对坐标；自定义控件用元素包围盒计算点击位置。
- 「点击成功」「页面提示成功」不等于业务成功，断言必须分层（UI / 业务 / 持久化）。
- 不把采购等业务字段写进平台核心。
- 不提交账号、口令、Token、Cookie、`probe/chrome-profile`、`.env`、`artifacts/`。
- 录单类用例至少 3 笔明细，逐笔校验带回默认值与派生字段。

## 14. 当前能力边界

| 范围 | 状态 | 说明 |
| --- | --- | --- |
| Platform Core | 可投入使用 | 健康检查、契约校验、四套测试、发布与回滚均通过 |
| purchase 模块包 | 可试点（draft） | 订单创建、生命周期、取价已跑通；退货取价与部分链路有缺陷 |
| foundation 模块包 | 可试点（draft） | 9 个关键对象字段规则已落地 |
| base / ar / ap | 不建议作为正式套件 | 仅列表只读冒烟，draft |
| 集成包 `purchase-to-ap` | 未就绪 | `steps` / `assertions` 为空，不可执行 |
| 无人值守全量回归 | 不建议 | 模块均为 draft，缺陷未清，尚无 CI nightly |

未覆盖范围：导入导出、字段长度与格式边界、并发与重复提交。

## 15. 相关文档

| 目的 | 路径 |
| --- | --- |
| 架构设计 | `docs/architecture/OVERVIEW.md` |
| 三层边界 | `docs/architecture/BOUNDARIES.md` |
| 业务执行规范 | `docs/自动化测试平台-使用指导说明书.md` |
| Phase 2 运行手册 | `docs/PHASE2-运行手册.md` |
| 配置项说明 | `docs/PHASE2-配置说明.md` |
| 契约校验手册 | `docs/runbooks/validate-contracts.md` |
| 新增模块包 | `docs/runbooks/module-onboarding.md` |
| 缺陷总清单 | `docs/defects/MASTER-DEFECT-LIST.md` |
| 未完成事项 | `docs/TODO.md` |
| 项目铁律 | `AGENTS.md` |
