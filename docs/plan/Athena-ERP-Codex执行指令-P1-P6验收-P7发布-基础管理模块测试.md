# Codex总控执行指令：P1--P6验收、P7发布、基础管理模块测试

你是本项目自动化测试平台工程负责人。按Gate
A、B、C顺序执行，每个Gate完成后停止，等待用户批准。

## 总原则

-   P1--P6已有开发成果；不是从零开发，禁止未经盘点推倒重写。
-   先读项目根目录AGENTS.md、README、架构文档、PRD目录、代码、测试、配置、运行记录和报告。
-   代码存在不等于功能完成；单元测试不等于真实ERP UI验证。
-   业务测试、数据准备、查询、写入必须由Playwright真实Web
    UI执行。禁止SQL、数据库直连、OpenAPI、MCP绕过UI。
-   仅在已确认的Athena测试环境、授权组织和测试账号执行写操作。
-   不记录密码、Cookie、Token；不清理非本run创建的数据。
-   所有结论附证据路径、命令、run id、截图、trace或日志。

## Gate A：P1--P6验收

1.  盘点分支、commit、工作区改动、P1--P6代码路径、核心引擎、适配器、模块资产、契约、测试入口和执行记录。
2.  找到采购示范模块真实UI证据及第二模块通用性演练证据。
3.  根据真实项目技术栈识别并执行依赖检查、lint、typecheck、unit、contract、integration、platform
    tests和凭证扫描。不得臆造命令。
4.  确认测试URL、组织、账号权限。先做只读smoke，再做授权范围内代表性写操作闭环。保存截图、trace、日志、断言和清理结果。环境不可用则NOT
    VERIFIED，不能mock替代。
5.  按 `01-P1-P6验收标准与报告模板.md` 生成：
    -   `reports/acceptance/P1-P6-ACCEPTANCE-REPORT.md`
    -   `P1-P6-TRACEABILITY-MATRIX.csv`
    -   `P1-P6-DEFECTS.md`
    -   `P1-P6-EVIDENCE-INDEX.md`
6.  有S0/S1、核心链路未验证、凭证泄露、非测试环境风险或数据清理失控，判FAIL/NOT
    VERIFIED并停止。
7.  Gate A结束后停止，不执行P7，不接新模块，等待人工批准。

## Gate B：P7正式发布（仅在批准后）

1.  固定版本号、commit、锁文件和依赖；运行质量门禁、安全扫描，生成RC。
2.  生成版本、契约、模块清单；检查构建包不含秘密和临时文件。
3.  在隔离测试运行环境部署RC，演练启动、健康检查、停止、重启、配置注入、浏览器连接、日志/截图/trace/报告。
4.  执行真实UI smoke test和受控写操作smoke，核验清理策略。
5.  演练回滚到上一稳定版本，验证平台和历史执行记录；不自动删除业务数据。
6.  生成
    `reports/release/P7-RELEASE-REPORT.md`、`P7-SMOKE-TEST-REPORT.md`、`P7-ROLLBACK-DRILL-REPORT.md`
    及 `releases/<version>/` 发布物。
7.  未完成审批、回滚演练或发布后smoke，不得标记正式发布完成。
8.  Gate B结束后停止，等待批准进入基础管理模块测试。

## Gate C：基础管理模块完整测试（仅在批准后）

1.  从当前部署菜单、可访问页面、代码和PRD识别已经开发完成的基础管理模块。不要猜模块范围。
2.  盘点菜单、页面、对象、表头/明细、字段、查询条件、按钮、状态、引用关系和权限。
3.  为每条字段/业务规则保存来源证据；冲突列出；未知标pending。
4.  建立字段规则矩阵、CRUD用例、按钮清单、状态转换矩阵、取单关系矩阵、数据配方、清理策略、测试套件和依赖DAG。
5.  覆盖字段逻辑、增删改查、审核撤审、生效失效、取单/选单/带入，以及页面真实存在的其他按钮。
6.  按T0只读盘点、T1字段校验、T2
    CRUD、T3状态按钮、T4取单关系、T5异常回归分批执行。
7.  每批写操作前dry-run展示数据影响、组织账号、依赖、风险和清理策略；dry-run不计真实测试通过。
8.  只通过Playwright真实UI执行业务动作。测试数据唯一命名；仅清理本run创建的数据；被引用时遵守ERP规则，不绕过限制。
9.  生成：
    -   `reports/foundation/FOUNDATION-MODULE-INVENTORY.md`
    -   `FIELD-RULE-MATRIX.csv`
    -   `BUTTON-INVENTORY.csv`
    -   `STATE-TRANSITION-MATRIX.csv`
    -   `LOOKUP-AND-SOURCE-TARGET-MATRIX.csv`
    -   `TEST-DESIGN-REPORT.md`
    -   `EXECUTION-REPORT.md`
    -   `COVERAGE-REPORT.md`
    -   `DEFECT-AND-GAP-REPORT.md`
10. 验收：页面和实际按钮盘点率100%；关键字段来源可追溯100%；关键对象CRUD
    100%、适用CRUD总体≥95%；关键状态转换100%；存在的取单关系100%；写操作run
    id可追溯100%；S0/S1未关闭为0。
11. 产品缺陷导致用例失败时，应正确归类为产品缺陷；不得把产品缺陷误判成自动化平台失败。

## Gate报告回复格式

结论、完成项、未完成项、验收矩阵、真实UI证据、缺陷风险、下一阶段准入判断、需要用户确认事项。无证据不得声称全部通过。
