# 地图导航项目总结 — Phase 1 独立质量验收（2026-11-07）

> 触发原因：本次为长会话多成员协作，按「Conversations get compacted, files don't」原则落盘，防止压缩后任务/进度丢失。

## 1. 项目地图

### 目录导航

```
D:/AIProject/ERP-AI-Testing/
├── AGENTS.md                     项目铁律（默认只读 / 不虚构 / 脱敏 / 分层断言）
├── docs/
│   ├── ARCHITECTURE.md           框架技术设计（分层、双浏览器、三级断言、安全策略）
│   └── plan/Athena-ERP-Test-Development-Kit/
│       ├── docs/01~05            总体架构 / 扫描建模规范 / Phase1 子项目 / 数据契约 / 路线图
│       └── schemas/              仅 rule.schema.json、scenario.schema.json（设计期，未接运行时）
├── config/
│   ├── athena.config.json        框架运行时配置（paths.knowledge="knowledge"）
│   └── prd-modeling.config.json  Phase 1 配置（外部 PRD 目录 / 扩展名 / policy）
├── src/
│   ├── prd/                      Phase 1 子系统：scanner/parsers/extract/ids/validate/
│   │                            reports/cases/config/scenarios/link/pipeline/types
│   ├── cli/prd.ts                Phase 1 CLI（scan / incremental / validate / report / build）
│   ├── cli/main.ts               框架 CLI（doctor / explore / verify / prd:index ...）
│   ├── knowledge/               knowledge-base.ts（只读 legacy 4 份）、prd-index.ts
│   └── browser|locator|controls|discovery|assertion|evidence|reporting|runner/
├── knowledge/                    框架 legacy 知识库 6 份 JSON
├── artifacts/
│   ├── knowledge/                Phase 1 建模产出 13 份 JSON（rules.json ~37MB）
│   ├── source-index/             DOCUMENT_REGISTER.json / scan-report.md / .scan-state.json / .parse-cache/
│   ├── session-outputs/          历史会话交付物
│   ├── acceptance/               ★ 本次验收 9 份报告 + _snapshots/
│   └── <run-id>/                 测试运行证据
├── reports/                      Phase 1 交付报告 10 份 md
├── deliverables/gstack/          ★ 团队收口报告
├── probe/                        探索/取证脚本（含 acceptance/ 隔离副本）
├── tests/unit|smoke/             14 个单测 spec / 浏览器冒烟
└── .workbuddy/memory/            ★ 本总结 + 日志 + 索引
```

### 模块职责速查

| 模块 | 职责 | 本次验收发现 |
| --- | --- | --- |
| `src/prd/scanner.ts` | 递归扫描、SHA-256、增量状态 | 隐藏/临时文件未排除；`SOURCE_MISSING` 未实现 |
| `src/prd/parsers.ts` | MD / 平台 JSON 解析 | 无 Parser Adapter；TXT 走 parseMarkdown |
| `src/prd/extract.ts` | 10 类对象抽取 | 证据片段非逐字；`PRD_EXPLICIT` 误标；纯中文单据关系漏抽 |
| `src/prd/link.ts` | 版本/规则冲突、关联 | `_diff` 污染版本集合；只比最新版规则 |
| `src/prd/validate.ts` | 手写字段/引用校验 | 只覆盖 5/12 类，0 error 是假阴性 |
| `src/prd/scenarios.ts` | 场景草案 | 推导规则场景准入失效、UI_READY 模板硬编码 |
| `src/prd/reports.ts` | 6 份报告渲染 | 覆盖率匹配口径错误；报告未记 schema_version |
| `src/knowledge/knowledge-base.ts` | 加载 `knowledge/athena-*.json` | **读不到 Phase 1 产出** |
| `src/cli/prd.ts` | Phase 1 命令 | validate/report 名不副实，实际 FULL 重建 |

### 关键文件索引（本次结论出处）

| 结论 | 文件 |
| --- | --- |
| 总裁决 / Go-No-Go / P0 整改 | `artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md` |
| 392 条待确认问题全清单（既有 330 + 新增 62） | `artifacts/acceptance/07-open-questions.md` |
| 各分项证据 | `artifacts/acceptance/01~06、08` |
| 团队收口 | `deliverables/gstack/quality-acceptance-phase1-prd-2026-11-07.md` |
| 快照/实跑日志 | `artifacts/acceptance/_snapshots/manifest-before.json`、`*.log` |
| 最终哈希复核 | `probe/acceptance/h1_final_hash_audit.json`、`h2_dist_and_breakdown.json` |

## 2. 任务执行状况

| Task | 状态 | 关键改动/产出 |
| --- | --- | --- |
| #1 A 扫描完整性 | done | `01-document-scan-report.md`；540 文件哈希、隔离 5 轮增量 |
| #2 F/G 场景与工程 | done | `06`、`08`；实跑 build/typecheck/63 单测/validate/report；快照还原 |
| #3 C 知识模型 | done | `03`；57,429 对象结构校验、KnowledgeBase 连通性实测 |
| #4 B 解析质量 | done | `02`；6 份原文人工对照、40 条规则逐字比对 |
| #5 D 规则追溯 | done | `04`；EXPLICIT 误标率、四要素核验 |
| #6 E 业务关系 | done | `05`；采购 7 节点、20 条依赖回溯 |
| #7 哈希一致性复核 | done | 325+53+540 文件全一致、0 未还原差异 |
| #8 补充口径与更新 B/D/E | done | 版本口径纠正、正式 Schema 判定 |
| 主理人汇编 | done | `07`、总报告、gstack 收口、数字同步、CRLF 规范化、memory 落盘 |

**全部 8 个 task 已 completed，无 deferred / in_progress。**

## 3. 当前进度与下一步

- **本次验收任务进度：100%**（9 份交付报告 + 1 份团队收口 + memory 三件套，全部落盘并校验）。
- **Phase 1 项目状态：验收不通过，待整改复验**（整改工作量未计入本次验收）。
- **下一步（按优先级）**：
  1. 工程负责人裁决 Go/No-Go：是否批准「带缺陷结项 + Phase 2 并行整改」。
  2. 平台/建模负责人执行 P0 11 项（见总报告 §7）：删除标记、场景准入、证据逐字化、规则分类、采购链路关系、静默丢失登记、命令只读化、版本/批次口径、覆盖率口径、重跑复验。
  3. 复验通过后重新出具验收结论；Phase 3 前完成 P1（读取适配层、10 类 Schema、Evidence 契约、依赖目标解析）。

## 4. 硬性约束与教训

### 约束（不可违反）

- 默认只读；不实现/触发保存、删除、审核、反审核、结账、过账、作废等写操作。
- 不虚构 ERP 页面结构、字段、业务规则；未验证标 `UNKNOWN`，推测标 `candidate`。
- 不把账号/口令/token/Cookie 写入代码、配置、日志、报告、Git。
- 不得把「点击成功/页面提示成功」当作业务成功，必须分层断言。
- 验收禁令：不连 ERP、不启浏览器、不跑 Playwright、不调 ERP OpenAPI/MCP、不执行 ERP 业务操作。
- 所有产出留仓库内；浏览器 profile 留 `probe/chrome-profile` 不进会话目录。
- 新文件统一 UTF-8 无 BOM + CRLF；写盘含反引号的中文文本先落脚本文件再执行，禁止 `python -c` 内联。
- 删除默认先进回收站，禁止直接抹盘。

### 教训（避免重复踩坑）

1. **自实现校验器的 0 error 不等于质量达标**：`validate.ts` 只查 document_id+file_path、只覆盖 5/12 类，未能检出 410 个推导规则场景违例。验收必须独立抽样比对。
2. **PRD 有原文 ≠ 已建模**：采购链路 4 份核心单据 PRD 存在且已抽规则，但 0 实体级关系；「入库取到货」原文明确却未建依赖也未登记问题。
3. **两套索引口径会打架**：框架 `prd:index` 生成的 PRD-MAPPING / athena-prd-map 停留在旧日期，容易被误判为 Phase 1 版本算错；需先查生成时点与 mtime。
4. **刻意的设计决策也会成为债务**：Phase 1 知识库独立于 legacy `knowledge/` 是有意设计，但未交付读取适配层，导致 Phase 3 无消费入口；区分「Phase 2 不阻塞」与「Phase 3 阻塞」很关键。
5. **命令名不可信**：`prd:validate`/`prd:report` 文档写「仅校验/仅重生成报告」，实际执行 FULL 全量重建，实测 320/325 文件 SHA 改变；任何重跑必须先快照 + diff + 还原。
6. **数字会漂移**：完成报告写 63 项单测、实施评估写 62；Node 自报 v24.19.0/npm 11，实测 v22.22.2/10.9.7。以实跑输出为准。
7. **报告展示截断要有告知**：`OPEN_QUESTIONS.md` 每分区仅 100 条但有显式提示 + 完整 JSON，属一般缺陷而非静默忽略，定性要准确。
8. **纠正假设要中转**：主理人的初步线索（版本冲突源于 `_diff` 污染）被成员实测推翻后，必须立刻把纠正转达所有相关成员，避免错误写进报告。
