# Athena ERP 自动化测试框架技术设计

## 1. 目标与边界

目标：为 Athena ERP（门户 Angular SPA + 低代码业务页）提供可复用的 Playwright 测试框架，支持 CDP 接管探索与独立 Chromium 回归，输出可追溯的证据与报告。

本阶段边界：

- 默认只读。默认配置不实现保存、删除、审核、反审核等写操作执行路径。
- 写入仅在独立配置档 `config/athena.write.config.json`（`readOnly=false` + `allowWrite=true`）且用户明确授权时启用；审核、反审核、结账、过账、作废仍不在框架范围内。
- 不虚构页面结构。字段、控件、规则只能来自页面元数据或真实 DOM。
- 不批量执行测试计划。第一阶段只做框架与 MVP 验证。

## 2. 分层

```
CLI / Playwright Test
        │
Runner（只读执行器 + 写入执行器 + 安全策略）
        │
Assertion / Evidence / Reporting
        │
Controls（Form / Grid / Lookup / Dropdown / Modal / Tabs）
        │
Locator Engine（稳定选择器与字段锚点）
        │
Page Manager + Browser Adapter（CDP / Playwright）
        │
Knowledge Base（page-map / component-map / business-rules）
```

依赖方向自上而下，下层不感知上层。

## 3. 模块职责

| 模块 | 职责 | 不做什么 |
| --- | --- | --- |
| `config` | 读取 `config/athena.config.json`，支持环境变量覆盖；校验必填项 | 不存凭据 |
| `browser/cdp-adapter` | 通过 `connectOverCDP` 接管已登录窗口，枚举页面 | 不关闭用户浏览器 |
| `browser/playwright-adapter` | 以 storageState 启动独立 Chromium | 不自动登录 |
| `browser/page-manager` | 页面注册、按 host/标题匹配、等待就绪 | 不猜 URL |
| `locator` | 字段锚点、容器、控件选择器；生成稳定定位描述 | 不用随机 class hash |
| `controls` | 表单/表格/选择器/下拉/弹窗的读写原语（读为主） | 不点保存类按钮 |
| `discovery` | 采集页面快照并分类控件，产出候选元数据 | 不直接写 confirmed |
| `assertion` | 三级断言（ui / business / persistence），收集结果 | 不以提示代替数据校验 |
| `evidence` | 截图、DOM 快照、日志、请求记录，统一脱敏 | 不落 token/cookie |
| `reporting` | Markdown 与 HTML 报告 | 不夸大结论 |
| `runner` | 只读执行器与授权写入执行器，按步骤记录结果 | 不做批量写操作；写入需显式配置档 |
| `runner/actions` | 基础资料列表通用动作：筛选、列表页操作列编辑/查看、二次确认删除 | 不写业务断言，不持有用例状态 |
| `knowledge` | 加载与校验知识库，标记 UNKNOWN | 不覆盖 confirmed |
| `prd` | Phase 1 PRD 扫描、解析、建模、关系推导、场景草案与报告 | 不连 ERP、不读 DOM、不写业务数据 |
| `knowledge/prd-knowledge` | Phase 1 知识库只读查询适配层 | 不改写产物，不与 legacy 知识库互相覆盖 |

## 4. 关键设计

### 4.1 双浏览器模式

- `cdp`：连接 `http://127.0.0.1:9333`，复用人工登录态。探索与调试使用。
- `playwright`：`launchPersistentContext` + `storageState`，用于回归。登录态失效时立即失败。

CDP 连接拿到的 `Browser` 不调用 `close()`，避免关闭用户窗口；进程退出即断开。

### 4.2 定位策略优先级

1. `label[for="<entity>.<field>"]` 找到表单项容器（最稳定）。
2. 语义属性：`aria-label`、`role`、`name`、`placeholder`。
3. 结构：`data-*`、`col-id`、`row-index`。
4. 文本：按钮/页签标题。
5. 坐标：仅当自定义组件必须真实点击时，以元素包围盒计算，禁止页面绝对坐标。

### 4.3 三级断言

`ui` 断言界面呈现；`business` 断言业务规则；`persistence` 断言数据落库。只读用例最高只能到 `ui` + `business`（查询结果类）；写入用例可在保存/删除后用列表回读做 `persistence` 断言。

### 4.4 安全策略

- 只读执行器只接受白名单动作：`open`、`click`、`popup`、`close-tab`、`assert`、`snapshot`、`screenshot`、`read`。
- 写入动作 `fill`、`select`、`save`、`delete`、`confirm`、`filter`、`new`、`row-action`、`pick-date` 仅在 `allowWrite=true` 且 `readOnly=false` 时放行，否则返回 `WRITE_DISABLED`。
- 写入执行器只做单笔新增、编辑、删除与筛选；删除必须先走二次确认，测试数据必须带唯一前缀并在用例内清理。
- `click` 先解析目标元素文本（含 `aria-label`/`title`），空文本直接拒绝（`UNVERIFIED_TARGET`），再匹配 `forbiddenActionTexts`；不使用选择器绕过文本检查。
- `open` 只允许门户主机与低代码业务主机，其它地址拒绝（`HOST_NOT_ALLOWED`）。
- `popup` 仅用于打开、读取、关闭下拉或基础资料选择器，禁止选择选项与点击确认；执行器用 `finally` 保证浮层关闭。
- 动作文本命中 `forbiddenActionTexts` 直接拒绝并记录 `BLOCKED`。
- 默认配置下写操作没有执行入口；写入能力由独立配置档显式开启，避免误用。

### 4.5 写入执行器

`src/runner/write-executor.ts` 按步骤执行 `new/fill/pickDate/openLookup/lookupFilter/selectLookupRow/confirmLookup/save/rowAction/deleteRow/confirmDialog/filter/clearFilter/closeDetail` 等动作，并复用三级断言。列表页操作列的“编辑/查看”可能打开独立 `/detail` 页面，执行器会记录新页面、在详情页执行保存后关闭并回到列表；新增与删除保持在列表页或页内详情页签。

列表页的“筛选、操作列编辑/查看、二次确认删除”抽到 `src/runner/actions/master-data-actions.ts`（`MasterDataActions`），后续基础资料作业直接复用。写用例支持 `cleanup` 步骤数组：出现断言失败或执行异常时，先关闭浮层与详情，再执行 `clearFilter`、`deleteRowIfPresent` 等幂等清理动作；清理结果以 `cleanup:` 前缀记录，不覆盖原始失败原因。

### 4.6 知识库

四份 JSON：页面、控件、业务规则、PRD 索引。页面/控件/规则条目带 `status`（confirmed / candidate / deprecated）、`source`、`verifiedAt`；探索产出 `candidate`，人工确认后升级。

PRD 索引 `knowledge/athena-prd-map.json` 由 `prd:index` 从外部 PRD 目录生成：按语义化版本取每个作业最新版，抽取 `PRD类型`、`业务对象`、章节、子章节和 `##### 名称 (字段名)` 字段，并关联 `pageId` 与 `testPlanIds`。`prd:section` 按标题片段读取业务逻辑原文，索引不复制规则正文。PRD 是预期来源，不能替代页面运行证据；规则仍以 `confirmed` 需要 `verifiedAt` 为准。

### 4.7 Phase 1 PRD 知识建模子系统

Phase 1 是独立子项目，产物与 legacy 知识库隔离，目录为 `src/prd/`、`artifacts/knowledge/`、`artifacts/source-index/`、`reports/`、`schemas/`。

- **流水线**：`scanner`（递归扫描 + SHA-256 + 稳定 ID + 增量状态）→ `extract` / `cases`（MD、平台 `prd_spec` JSON、TXT 与用例库解析）→ `link`（版本归并、引用解析、覆盖率）→ `relations`（单据取单/回写关系）→ `evidence`（原文行切片证据）→ `scenarios`（场景草案）→ `validate` → `reports`。
- **13 类对象**：Document / Entity / Page / Field / Control / Rule / Action / Workflow / Dependency / Scenario / OpenQuestion / ExistingCase / Evidence，落 `artifacts/knowledge/*.json`。
- **证据契约**：`SourceRef` 必须内嵌 `document_id`、`file_path`、`doc_version`、`sha256`、`section`、`line_start` 与逐字 `excerpt`。`prd:validate` 通过 `document_id → DocumentRecord.file_path` 解析绝对路径（兼容 PRD 根与用例库两个来源），回读原文逐行比对；不一致即 ERROR。
- **来源分层**：`PRD_EXPLICIT` / `PRD_DERIVED` / `PLATFORM_SERVICE` / `UI_OBSERVED` / `USER_CONFIRMED` / `PENDING`。引用平台服务的字段行为单独登记口径待确认，不默认等同 PRD 明确规则。
- **场景准入**：引用 `PRD_DERIVED` 或非 CONFIRMED 规则的场景必须 `NEEDS_CONFIRMATION`；Phase 1 不产出 `UI_READY`；全部场景 `DRAFT` + `review_required=true`，无执行入口。
- **只读命令**：`prd:validate` / `prd:report` 仅加载既有产物，不重扫、不写知识库；`prd:report --out <dir>` 可重定向。
- **运行时消费**：`PrdKnowledgeBase.load({ knowledgeDir, sourceIndexDir })` 提供文档、最新版、实体、字段、规则、依赖、证据与覆盖率查询；Phase 2 必须经由此适配层读取，不得直接解析 JSON。
- **Schema**：`npm run prd:schemas` 生成 13 类 + `common.schema.json`，`prd:validate` 用 ajv（Draft 2020-12）执行。

## 5. 数据流

```
explore：
  连接 → 选页 → 采集 DOM/截图 → 分类控件 → 生成 candidate 条目 → 落 artifacts

verify：
  加载知识 → 连接 → 选页 → 执行只读用例 → 逐步证据 → 断言结果 → results.json → MD/HTML 报告

prd（Phase 1，纯静态）：
  扫描 → 解析 → 建模 → 关系/证据 → 场景草案 → 校验 → 报告
```

## 6. 失败处理

- 页面未就绪：等待业务信号（表格行、表单字段、页签激活），超时后截图并标 `BLOCKED`。
- 定位失败：导出 DOM 与可访问性摘要，标 `FAIL`，不退化到坐标。
- 登录态失效：立即停止，提示人工重新登录。
- 网络异常：有限重试（默认 3 次），区分网络/权限/业务错误。

## 7. 目录

```
src/
  browser/  controls/  locator/  discovery/
  assertion/  evidence/  reporting/  runner/
  knowledge/  config/  cli/  prd/
tests/
  unit/     纯逻辑单测
  smoke/    真实浏览器冒烟（手动触发）
knowledge/  页面与控件知识
artifacts/  运行产物（git 忽略；含 Phase 1 knowledge/ 与 source-index/）
reports/    Phase 1 渲染报告
schemas/    Phase 1 正式 JSON Schema
```

## 8. 非目标

- 不做测试计划解析与批量调度（下一阶段）。
- 写入默认关闭；仅在独立配置档与明确授权下启用单笔增删改与清理（见 4.4 / 4.5）。
- 不做跨租户、跨环境参数化。
