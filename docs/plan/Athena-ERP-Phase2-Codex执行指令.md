# Codex 执行指令：Athena ERP Phase 2

你现在负责实施 Athena ERP 自动化测试平台 Phase 2：ERP 页面自动化底座。

请严格遵守以下要求。不要直接开始大规模编码。

## 0. 首要约束

1. **唯一 ERP 业务交互路径是 Playwright UI。**
2. 禁止调用 ERP OpenAPI、MCP、数据库、SQL、内部 HTTP 接口或其他后端通道进行业务数据准备、业务操作和结果验证。
3. 不得通过 `page.request`、`APIRequestContext`、直接 fetch/XHR、网络请求重放等方式绕过 UI 操作 ERP。
4. 不得连接生产 ERP。启动前必须要求用户明确配置并确认非生产测试环境。
5. 不得自行猜测 ERP 登录方式、菜单路径、控件结构、页面 URL、字段定位器或业务规则。
6. 不得覆盖、删除或修改 Phase 1 原始 PRD 和已冻结知识模型。
7. 不得自动执行审核、撤审、删除、过账等高风险动作，除非当前阶段验收用例明确授权，且环境门禁、操作确认、审计记录均已实现。
8. 不得在验收报告中虚构通过结果。没有真实环境验证的项目标记为“未验证”。
9. 保持 TypeScript 模块化单体；除非仓库已有成熟技术选型，不引入微服务、消息队列、向量数据库。
10. 用户是产品经理。所有运行方式、配置项、验收步骤必须有中文说明，尽量一条命令可执行。

## 1. 开始前：仓库与 Phase 1 交付审查

先检查当前工作区，不要修改文件。输出 `artifacts/phase2/00-discovery/REPOSITORY-ASSESSMENT.md`，内容包括：

- 当前项目目录树与技术栈
- package.json、锁文件、tsconfig、测试框架
- Phase 1 知识模型目录、Schema、版本信息
- Phase 1 是否已通过验收；若未通过或未提供验收报告，明确列为阻塞项
- 现有 Playwright 代码、浏览器配置、登录实现（若有）
- 与本 Phase 2 包的差异
- 需要用户提供的 ERP 测试环境信息
- 风险和建议

**停止条件：** 如果没有 Phase 1 冻结版本，或缺少非生产 ERP 环境授权，不得连接 ERP；可以先完成不依赖 ERP 的框架和单元测试。

## 2. 建立实施计划

在编码前输出：
`artifacts/phase2/01-planning/PHASE2-IMPLEMENTATION-PLAN.md`

计划必须按以下顺序拆分，并列出文件变更、依赖、测试和验收条件：

- P2.0 项目审查与安全门禁
- P2.1 浏览器/会话/登录/导航/证据
- P2.2 控件适配器
- P2.3 页面对象与知识模型映射
- P2.4 采购订单端到端技术验证

不得跳阶段。每一阶段完成后先执行对应验收，生成报告，再进入下一阶段。

## 3. 目录与模块建议

优先遵循现有项目结构。若没有既有结构，建议：

```text
src/
  config/
  core/
    browser/
    session/
    environment/
    navigation/
    evidence/
    logging/
    safety/
  adapters/
    base/
    input/
    dropdown/
    date/
    lookup/
    grid/
    tab/
    modal/
    tree/
    button/
  pages/
    base/
    purchase/
  knowledge/
    contracts/
    loader/
    mapper/
  diagnostics/
  cli/
tests/
  unit/
  integration/
  e2e/
artifacts/
  phase2/
```

## 4. 实施详细要求

### P2.0：项目审查与安全门禁

- 配置 schema 校验、环境标识、非生产环境白名单。
- 启动时显示环境名称、ERP 地址、操作者、runId。
- 未显式设置 `ALLOW_ERP_UI_TEST=true` 时拒绝连接。
- 生产环境标识、生产域名/主机黑名单命中时强制拒绝。
- 所有高风险动作默认关闭。
- 建立运行日志、脱敏、证据目录和 run manifest。
- 提供 `.env.example`，不得提交真实 `.env`、密码、Cookie、Token。
- 默认使用隔离的浏览器上下文；会话持久化需显式启用且文件权限受控。

### P2.1：浏览器、会话、登录、导航、证据

- Playwright Chromium 优先；如 ERP 实际兼容性需要，再评估 Edge/Chrome。
- BrowserManager、ContextManager、PageManager 生命周期清晰。
- 登录流程采用可配置策略；不猜验证码/MFA 绕过方式。
- 支持手动完成 MFA 后继续、或用户提供经批准的测试账号流程。
- 支持登录态检测、会话失效检测、重新登录提示。
- 导航必须可配置；页面未加载完成不得继续操作。
- 失败时采集截图、Playwright trace、控制台错误、当前 URL、页面标题和脱敏日志。
- 截图/Trace 可能包含敏感业务数据，必须配置保留期限和访问控制；默认不上传外部服务。

### P2.2：通用控件适配器

按需实现并提供单元/集成测试：
- Input：输入、清空、读取、只读/禁用检查
- Dropdown：展开、选项定位、选择、当前值读取
- Date：日期输入/选择/读取，处理格式与区域设置
- Lookup：弹窗打开、搜索、结果筛选、选择、回填验证
- Grid：行列定位、单元格读取/编辑、添加/删除行、行数核对
- Tab：页签切换和激活态确认
- Modal：等待、确认、取消、关闭、弹窗内容读取
- Tree：展开、节点定位、选择
- Button：可见/可用检查、点击、操作后状态验证

通用适配器不得硬编码某一客户 ERP 的 DOM。定位策略必须支持 role、label、placeholder、text、test id、可配置 locator；优先级和降级原因要记录。不得以坐标点击作为常规方案。

### P2.3：页面对象与 Phase 1 知识模型映射

- 读取 Phase 1 已冻结的 pages/fields/controls/entities/rules/workflows 等模型。
- 增加知识模型版本校验与兼容性检查。
- 建立页面模型到实际页面 locator 的映射层。
- 不能仅凭 PRD 字段名生成定位器并假设正确。
- 实际页面侦察必须记录字段、控件、按钮、表格、弹窗和导航差异。
- 输出 `artifacts/phase2/03-page-mapping/ERP-PAGE-DISCOVERY.md` 与差异报告。
- 差异分为：一致、PRD 有而页面无、页面有而 PRD 无、控件类型不同、无法识别。
- 业务规则不一致时登记问题，不修改 Phase 1 冻结知识；走版本化变更流程。

### P2.4：采购订单端到端 UI 技术验证

仅在用户明确确认非生产测试环境、测试账号和数据策略后执行。

建议流程：
1. 打开 ERP 并登录。
2. 进入采购订单页面。
3. 新增一张带唯一测试标记的采购订单。
4. 通过 Lookup 选择供应商和品号。
5. 填写必要字段及明细行。
6. 保存。
7. 重新查询该单据。
8. 通过 UI 读取并断言关键字段。
9. 审核仅在用户单独授权、环境门禁允许且该用例明确要求时执行；第一版可以只验证保存和查询，避免不必要的业务副作用。
10. 记录 runId、单据编号、测试标记、截图、Trace、日志和结果。
11. 清理策略必须根据真实 ERP 业务约束制定；默认不自动删除、不自动撤审、不自动过账。

必须明确区分：
- 页面交互成功
- 单据保存成功
- 重新查询成功
- 业务字段断言成功

## 5. 测试要求

- 单元测试：配置、门禁、脱敏、知识模型加载、locator 策略、证据管理。
- 适配器测试：使用独立 mock 页面或本地 fixture 验证通用行为。
- ERP 集成测试：仅在授权的非生产环境运行。
- E2E：只执行明确批准的采购订单验证用例。
- 不得将 mock 测试冒充真实 ERP 验收。
- 失败用例需输出最小复现信息和证据引用。
- 所有可能产生副作用的动作要有操作前检查、运行记录和失败处理。

## 6. 有序验收与阶段门禁

必须按 `docs/05-Phase2-有序验收指标.md` 执行。
每个阶段生成：
`artifacts/phase2/acceptance/P2.x-ACCEPTANCE-REPORT.md`

只有“通过”才进入下一阶段；“有条件通过”必须列出不阻塞下一阶段的遗留项并由用户确认；“不通过”必须整改后复验。

## 7. 最终交付

生成：
- `artifacts/phase2/PHASE2-FINAL-REPORT.md`
- `artifacts/phase2/acceptance/` 全套验收报告
- `docs/PHASE2-运行手册.md`
- `docs/PHASE2-配置说明.md`
- `.env.example`
- 一键安装/检查/运行脚本（Windows PowerShell 优先，兼容 macOS/Linux 可作为补充）
- 自动化测试报告
- 真实 ERP 验证证据清单（如未连接真实环境，明确标记未验证）
- Phase 3 输入接口说明

最终报告必须明确：哪些能力已实现、哪些通过 mock 验证、哪些经过真实 ERP 验证、哪些尚未验证，以及是否允许进入 Phase 3。

现在先执行第 1 节，只做仓库审查和报告，不要直接开始编码。报告完成后等待用户确认实施计划。
