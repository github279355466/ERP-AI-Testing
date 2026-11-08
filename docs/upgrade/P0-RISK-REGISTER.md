# P0 风险清单

> 范围：升级到 v2.0 三层平台的风险。
> 等级：S0 阻断 / S1 严重 / S2 一般 / S3 优化。
> 负责人列中的“待定”表示需要人工指定；决策点指向 `P0-DECISIONS.md`。

## 1. 风险总表

| ID | 等级 | 风险 | 证据 | 影响 | 缓解措施 | 负责人/决策点 | 阶段 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R-P0-01 | S0 | Phase 2 成果未提交，工作区可能丢失 | `HEAD 530bfc5`；16 modified + 206 untracked | 迁移基线不可回溯，回滚困难 | 先冻结基线提交/标签；只提交源码/测试/配置/文档 | Q-P0-01 | P1-01 |
| R-P0-02 | S0 | 审核/删除可绕过授权 | `rowAction` 按 `row-action` 放行；页面对象 `audit()` 直接调 `MasterDataActions`；写配置 `allowHighRiskActions=true` | 误审核/误删除/越权写 | 写操作冻结；P1 ActionRegistry + per-case 授权 + 审计；P4 复验 | D-P0-006 / Q-P0-05 | P1/P4 |
| R-P0-03 | S0 | 生产环境/错误环境误连 | 已有 host 白名单/生产阻断，但环境配置单点、无 per-run 审批 | 误操作共享/生产数据 | 保留 `ALLOW_ERP_UI_TEST`；增加 environment profile/运行审批；启动横幅 | P1-07 | P1 |
| R-P0-04 | S1 | 平台核心含采购业务逻辑 | CLI、diagnostics、page-mapper、PRD relations/scenarios/config、navigation | 第二模块接入必须改平台代码 | P1 边界；P2/P4/P6 分批外置；平台纯度审计 | D-P0-003 | P1-P6 |
| R-P0-05 | S1 | 无模块包/集成包/核心契约 | 无 `business-modules/`、`integration-tests/`、Module/TestCase/DataRecipe/Report Schema | 无法支撑多模块/跨模块 | P1 建骨架与契约；P1-09/10 | P1-04/P1-09 | P1 |
| R-P0-06 | S1 | Phase 1 知识库语义质量未闭环 | 620 OQ（616 OPEN/33 HIGH）；481 依赖未解析；33 证据无版本；无第三轮独立复验 | 断言依据不可靠，覆盖虚高 | 候选快照 + 来源标记；P2 独立语义抽检；不作为唯一断言源 | Q-P0-02 / D-P0-004 | P2 |
| R-P0-07 | S1 | Phase 2 采购链路未闭环 | B1/B2；DIR-01~07；退货/出库阻塞 | 不能宣称采购模块验收通过 | P6 重跑；环境修复；明确已知阻塞 | Q-P0-03 | P6 |
| R-P0-08 | S1 | 测试数据污染/无清理 | P2.4 单据保留；无清理记录；共享租户/组织 | 数据堆积、上下游查询受污染、不可重复 | 建立 runId 前缀、数据配方、清理计划/审计；确认现有数据处置 | Q-P0-06 | P4/P6 |
| R-P0-09 | S1 | 无正式 TestCase/DAG/DataRecipe | Phase 3 无实现；只有 DSL/场景草案 | 无法从场景稳定生成可执行计划 | P3 建 TestCase/DAG/Dry-run；P4 建 DataRecipe | P1-04/P3 | P3/P4 |
| R-P0-10 | S2 | 三套控件交互实现并存 | `src/controls`、`src/adapters`、页面对象/写执行器 raw locator | 行为漂移、维护成本高 | 以 adapters 为主；controls 兼容；P4 收敛 | P4 | P4 |
| R-P0-11 | S2 | 定位器不强制唯一/降级未记录 | `LocatorResolver` 取 first；box 偏移硬编码；`allowFixedCoordinates` 未用 | 误点、脆弱、难诊断 | P4 加唯一性/降级原因/坐标策略 | P1-04/P4 | P4 |
| R-P0-12 | S2 | 断言/报告不足以追溯 | flow 内 ad-hoc assertions；报告无模块/集成分层/版本组合 | 失败无法定位到规则/PRD；报告不可用于集成 | P5 断言来源绑定/失败分类/报告分层 | P5 | P5 |
| R-P0-13 | S2 | 知识/证据产物不可复现 | `artifacts/` Git 忽略；无冻结清单；知识版本来自本地哈希 | 运行结果不可复现/审计 | P1/P2 冻结快照 + SHA-256 + 版本组合 | D-P0-010 | P1/P2 |
| R-P0-14 | S2 | 文档多事实源/指标漂移 | README/ARCHITECTURE/MVP/PHASE2/memory 数字不一致 | 误用旧结论 | P1 文档 IA；旧文档标 legacy；单一事实源 | D-P0-009 | P1 |
| R-P0-15 | S2 | 导航/环境耦合与 CORS 规避 | 单一 `phase2.navigation.json`；`--disable-web-security`；direct token 回退 | 环境切换困难、安全边界模糊 | P1 拆环境/模块配置；限制专用 profile；记录风险 | P1-07/P4 | P1/P4 |
| R-P0-16 | S2 | 证据含 PII/截图敏感信息 | manifest operator 为真实姓名；截图可能含业务数据 | 合规/泄露风险 | P1 证据策略；operator 用岗位/工号；截图保留期/访问控制 | P1-07/P1-08 | P1 |
| R-P0-17 | S2 | 大数据文件加载成本 | `rules.json` 约 42 MB、`evidence.json` 约 49 MB | 启动/查询慢，CI 成本高 | P2 分片/索引；P1 评估按模块加载 | P2 | P2 |
| R-P0-18 | S2 | 无 CI/Node 版本约束 | 无 CI 配置；`package.json` 无 engines | 环境差异导致结果不可复现 | P1 加 engines + CI（unit/contract） | P1-11 | P1 |
| R-P0-19 | S3 | 文件格式覆盖不足 | 仅 md/txt/json；docx/xlsx/pdf 预留；TXT 无样本 | 部分 PRD 不能建模 | P2 Parser Adapter；TXT 真实样本 | P2 | P2 |
| R-P0-20 | S3 | 大文件/长函数维护成本 | `cli/main.ts` 1,373 行、`extract.ts` 1,680 行 | 变更风险高 | 按组件拆分；测试保护；不做一次性重写 | P2/P4 | P2-P4 |

## 2. S0/S1 风险的即时处置

在人工确认前，建议立即执行以下“无代码变更”措施：

1. 不再执行任何 ERP 写操作。
2. 不删除、不移动现有源码/配置/知识库。
3. 记录当前 Git 状态与知识库批次。
4. 由人工确认 Q-P0-01（基线冻结）与 Q-P0-05（写操作冻结）。

## 3. 风险与阶段门禁

| 阶段 | 不得进入下一阶段的条件 |
| --- | --- |
| P1 | 契约/validator/版本检查未通过；或仍无基线冻结 |
| P2 | 知识库未冻结/未做独立语义抽检；或采购常量仍留在平台核心 |
| P3 | 未审批用例可进入套件；或 DAG 循环/缺失依赖不可检测 |
| P4 | 写操作授权/审计未完成；或页面定位失败无诊断 |
| P5 | 失败分类/证据/版本组合不完整；或非幂等写操作可盲目重试 |
| P6 | 平台核心仍含采购逻辑；或采购链路未真实 UI 验证；或第二模块无法最小接入 |
