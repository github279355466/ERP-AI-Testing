# AGENTS.md

本仓库是 Athena ERP 的 Playwright 自动化测试平台。所有改动先读 `docs/architecture/TO-BE.md` 与 `docs/architecture/BOUNDARIES.md`；`docs/ARCHITECTURE.md` 为历史设计，仅作参考。

## 1. 不可违反

- 默认只读。不得实现或触发保存、删除、审核、反审核、结账、过账、作废等写操作，除非用户当次明确授权并给出专用测试数据与清理方案。
- 不得虚构 ERP 页面结构、字段或业务规则。未验证内容标 `UNKNOWN`，推测内容标 `candidate`。
- 不得把账号、口令、token、Cookie 写入代码、配置、日志、报告或 Git。
- 常规操作不得使用页面绝对坐标；自定义组件必须真实点击时，用元素包围盒计算。
- 不得把「点击成功」「页面提示成功」当作业务成功，必须分层断言。
- 不得把采购等具体业务字段、流程、页面选择器写入 Platform Core；模块差异只能放 `business-modules/<module-id>/`。
- P1 只建骨架与契约，不迁移、不重写、不删除 legacy 实现；迁移必须按 P2-P6 计划逐阶段授权。

## 2. 三层架构与资产落点

```text
Platform Core            platform/                 通用能力与契约
Business Module Packs    business-modules/<id>/    业务差异
Integration Test Packs   integration-tests/<id>/   跨模块组合
```

| 内容 | 位置 |
| --- | --- |
| 核心契约、Schema、校验器、引擎 | `platform/` |
| 模块清单、页面映射、场景、用例、数据配方、套件 | `business-modules/<module-id>/` |
| 跨模块步骤、数据映射、断言 | `integration-tests/<integration-id>/` |
| 环境、操作者标识、运行授权 | `runtime/`（不得含凭据） |
| 契约测试 | `tests/contract/` |
| 业务无关适配原语 | `adapters/` |
| 平台自检 | `tests/platform/` |
| 单次运行产物 | `executions/` |
| 渲染后的执行报告 | `reports/runs/` |
| 平台治理工具 | `tools/` |

- 模块包通过 `module.yaml` 声明版本与平台兼容范围，资产路径必须与清单一致。
- 集成包只引用模块用例，不复制模块内部步骤。
- 不确定归属时先放模块包，第二个模块复用时再上提平台核心。

## 3. 开发方式

增量推进，一次只做一个模块：

1. 读现有实现与相关文档。
2. 先写或更新设计说明（必要时更新 `docs/ARCHITECTURE.md`）。
3. 实现该模块。
4. 补单元测试并运行。
5. 涉及真实页面时，用 CDP 做一次只读验证。
6. 输出验收结果，通过后再进入下一个模块。

禁止一次性铺开大量代码后再统一验证。

### 3.1 页面探索（probe）规范

探索层与执行层分离：**执行层是 Playwright 代码，探索层是 agent-browser CLI**。

- 探索真实页面结构（有哪些字段、控件、选择器、页面入口）一律用 `agent-browser`，一条命令一步。
- **禁止为「看一眼页面上有什么」新增一次性探针脚本**（`probe/_tmp-*.cjs`、`probe/*-tmp.js` 之类）。已有脚本保持不动，不再新增。
- 只有需要**确定性断言、可 CI、可重现报告**时，才写 Playwright 代码，且落点是 `platform/`、`business-modules/<id>/`、`integration-tests/<id>/` 或 `tests/`，不是 `probe/`。

标准流程（`<port>` 取 `config/athena.config.json` 的 `browser.cdpEndpoint`，默认 9333）：

```bash
pwsh -File scripts/start-chrome.ps1                        # 专用 profile，已含 ERP 登录态
agent-browser --session athena --cdp 9333 open <url>        # 挂上去，不重新登录
agent-browser --session athena snapshot -i -d 4             # 全页可交互元素 + @eN ref
agent-browser --session athena snapshot -i -s "<selector>"  # 局部扫描，token 更省
agent-browser --session athena click @e3                    # 用 ref 操作
agent-browser --session athena get html "<selector>"        # 取控件属性作证据
agent-browser --session athena close                        # 只关 session，宿主 Chrome 不受影响
```

- 页面导航或 DOM 变更后 ref 失效，必须重新 `snapshot` 再点击。
- 等待用「代表结果的条件」，不要默认 `networkidle`——SSE / WebSocket / 轮询会让它永不 resolve。
- 点击被遮挡、禁用或视口外时 CLI 报错而不是假成功：先处理遮罩，重新 snapshot 再点，不要盲目重试。
- 失败诊断优先用 `--cdp` 挂同一浏览器：`errors`、`console`、`network requests --filter`、`screenshot --annotate`，再回看 Playwright trace。
- `--allowed-domains` 与 `--cdp` / `--profile` 互斥；探索阶段要复用登录态，因此不启用域名白名单。

**证据与标注**：探索产物落 `probe/evidence/<page>-<topic>-<YYYYMMDD>.txt|png`，不要把结论只留在对话里；写进 `knowledge/` 或 `business-modules/<id>/` 前必须按 §1 标注 `verified` / `candidate` / `UNKNOWN`。探索阶段默认只读，不得触发保存、审核、删除、过账、结账等写操作。

## 4. 代码约定

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
| `src/platform/contracts/` | 平台契约校验与语义版本检查 |
| `src/cli/platform.ts` | 契约校验 CLI，只读 |
| `platform/contracts/schemas/` | 平台核心 Schema，单一事实源 |
| `business-modules/<id>/` | 业务模块包，禁止写平台通用逻辑 |
| `integration-tests/<id>/` | 集成包，禁止复制模块步骤 |

- TypeScript 严格模式，公共函数显式声明返回类型。
- 新增控件能力前，先在 `knowledge/athena-component-map.json` 里写清定位与 `verified` 状态。
- 新增页面知识只写 `candidate`，人工确认后再改 `confirmed` 并补 `verifiedAt`。
- 新增或修改契约时，先改 Schema，再补正反例与 `tests/contract/` 测试。
- `src/`、`knowledge/`、`cases/` 在 P1 为 legacy，保持可运行；新能力不得继续堆入采购专用逻辑。

## 5. 常用命令

```bash
npm run build
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:contract
npm run platform:validate
npm run platform:check
npm run test:smoke
npm run platform:module -- business-modules/purchase
npm run platform:integration -- integration-tests/purchase-to-ap
npm run athena -- doctor
npm run athena -- explore --id <page-id> [--detail]
npm run athena -- verify --page-id <page-id>
npm run athena -- verify --case <case.json>
```

## 6. 测试规范

- 单测覆盖纯逻辑；真实浏览器验证放 `tests/smoke` 或 `cases/`。
- 契约测试覆盖 Schema 正反例、版本兼容、依赖校验与 CLI 退出码，全部静态执行。
- 用例必须含：前置条件、步骤、预期、断言、证据。
- 录单类用例（含取单带回、手工新增品号）必须一次录入 **至少 3 笔明细**，逐笔校验带回后的默认值、派生字段（单位、仓库、税率、金额、税额等）是否正确；不得只验证单笔。
- 失败必须留截图 + DOM + 错误信息；阻塞写 `blocked`，跳过写 `skipped`。
- 证据目录结构：`artifacts/<run-id>/{results.json,report.md,report.html,shots,dom,logs}`。

## 7. 知识库

- `knowledge/athena-page-map.json`：页面入口、`workItemCode`、实体、字段。
- `knowledge/athena-component-map.json`：控件到定位配方的映射。
- `knowledge/athena-business-rules.json`：仅收录已验证规则。
- 改变「规则/关系是否可信」判定口径时，必须在根目录 `DECISIONS.md` 追加一条决策记录（背景、决策、影响范围、复算命令）。
- 更新后运行 `npm run athena -- verify` 自查，并确认知识库能被 `KnowledgeBase.load` 正常加载。
- 新模块知识应放 `business-modules/<module-id>/knowledge/`，通过页面映射与 `source_ref` 追溯来源。

## 8. 完成标准

- `npm run build` 无错误。
- `npm run test:unit` 全绿。
- `npm run test:contract` 全绿，`npm run platform:validate` 0 error。
- 新增能力有对应测试或真实页面证据。
- 文档与知识库同步更新，未验证项明确标注。

## 9. 数据落盘约定

所有产出留在本仓库内，不写入 agent 会话目录（会话目录只放会话元数据）：

| 内容 | 位置 |
| --- | --- |
| 浏览器 profile（登录态） | `probe/chrome-profile`，经 `browser.userDataDir` 配置，不提交 |
| 探索证据（snapshot / html / 截图） | `probe/evidence/` |
| 探索脚本、抓图、临时诊断 | `probe/`（`probe/` 只保留历史脚本，不再新增一次性探针） |
| 会话交付物（分析报告、字典、设计稿） | `artifacts/session-outputs/` |
| 测试运行证据 | `artifacts/<run-id>/` |

浏览器 profile 含数万小文件与 Cookie，放进会话工作区会让客户端打开会话时扫描卡顿，必须留在仓库内。

## 10. 文档索引

| 目的 | 路径 |
| --- | --- |
| 当前状态与两条工作线 | `README.md` |
| 框架技术设计与 Phase 2 底座 | `docs/ARCHITECTURE.md` |
| Phase 2 操作与排查 | `docs/PHASE2-运行手册.md`、`docs/PHASE2-配置说明.md` |
| 未完成事项与阻塞 | `docs/TODO.md`（T-04～T-07） |
| 缺陷总清单（唯一权威） | `docs/defects/MASTER-DEFECT-LIST.md` |
| 缺陷单（历史与单条） | `docs/defects/` |
| 字段级规则校验要求 | `docs/PHASE3-字段规则校验要求.md` |
| 跨会话记忆索引 | `.workbuddy/memory/MEMORY.md` |

## 11. 缺陷清单维护

- `docs/defects/MASTER-DEFECT-LIST.md` 是唯一权威缺陷清单；单次报告、回归报告、验收报告只作为证据来源，不得各自维护结论状态。
- 每轮测试结束后必须同步更新总清单：新增缺陷追加编号、已有缺陷更新状态与回归结果、撤回项写明依据；当轮报告开头回链总清单。
- 新缺陷编号从 `DEF-21` 起顺序分配；历史编号（`DEF-xx`、`OBS-xx`、`DIR-xx`、`GAP-xx`、`BUG-YYYYMMDD-xx`、`AUT-xx`）保持不变以便追溯。
- UI 规范与视觉类问题不进该清单，单独维护在 `reports/ui-spec/` 与 `docs/PHASE4-界面规范校验.md`。
- 状态口径统一为：`未修复`、`待确认`、`待复核`、`已修复待回归`、`已关闭`、`已撤回`、`阻塞`。

## Agent skills

### Issue tracker

本仓库的 issue 与 spec 以本地 markdown 存放在 `.scratch/<feature>/`。见 `docs/agents/issue-tracker.md`。

### Triage labels

沿用默认五角色标签：`needs-triage`、`needs-info`、`ready-for-agent`、`ready-for-human`、`wontfix`。见 `docs/agents/triage-labels.md`。

### Domain docs

单上下文：根目录 `GLOSSARY.md` + `docs/adr/`，另有追加式决策日志 `DECISIONS.md`。见 `docs/agents/domain.md`。
