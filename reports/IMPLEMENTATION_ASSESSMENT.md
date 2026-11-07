# 实施评估（Phase 1 PRD 建模）

> 记录时间：2026-11-07
> 依据：`docs/plan/Athena-ERP-Test-Development-Kit/CODEX_START_HERE.md`
> 范围：仅 Phase 1（PRD 扫描与业务知识建模），不连接 ERP、不启动浏览器。

## 一、现状勘察

| 项目 | 实测结果 |
| --- | --- |
| 仓库 | `D:\AIProject\ERP-AI-Testing`，模块化单体，TypeScript 严格模式 |
| Node / npm | v24.19.0 / 11.9.0（Windows） |
| Git | 仓库已初始化，`master` 分支尚无提交 |
| 既有框架 | `src/browser`、`locator`、`controls`、`discovery`、`assertion`、`evidence`、`reporting`、`runner`、`knowledge` 九个模块已存在 |
| 测试 | Playwright Test 1.62.1，`tests/unit` 中 11 个用例文件 |
| 依赖 | 仅 `@playwright/test`、`typescript`、`@types/node`，无额外解析库 |
| PRD 源 | 用户提供的外部只读目录，非仓库内 `prd/`；含主目录 272 份 + 用例库内原文档 27 份 |
| 测试用例库 | 与 PRD 同级的外部目录，34 个作业包（5 个域目录，171 个 JSON） |

## 二、与开发包建议目录的差异

开发包建议 `src/prd-scanner/`、`src/parsers/` 等独立目录。本仓库已有 `src/` 分层约定（见 `AGENTS.md` 第 3 节），因此采用**单一 `src/prd/` 子系统内聚**：

| 开发包建议 | 实际落点 |
| --- | --- |
| `prd-scanner/` | `src/prd/scanner.ts`、`src/prd/config.ts` |
| `parsers/` | `src/prd/parsers.ts` |
| `extractors/` | `src/prd/extract.ts`、`src/prd/cases.ts` |
| `knowledge-model/` | `src/prd/types.ts`、`src/prd/ids.ts` |
| `linker/` | `src/prd/link.ts` |
| `validators/` | `src/prd/validate.ts` |
| `scenario-generator/` | `src/prd/scenarios.ts` |
| `reporters/` | `src/prd/reports.ts` |
| `cli/` | `src/cli/prd.ts`（与既有 `src/cli/main.ts` 并列） |

理由：Phase 1 是一个独立子项目，按子系统内聚比按技术层横切更易演进；同时不触碰既有 `src/browser`、`src/runner` 等模块，避免破坏已完成的能力。

## 三、复用项

- `src/knowledge/` 的加载与结构校验思路沿用，但 Phase 1 知识库为独立产物，不写入 `knowledge/athena-*.json`。
- `AGENTS.md` 的只读策略与三级断言约定，直接作为 Phase 1 的边界约束。
- 既有 `tests/unit` 的 Playwright Test 运行方式，新增用例不引入第二套测试框架。
- `artifacts/` 目录约定沿用，新增 `artifacts/knowledge` 与 `artifacts/source-index`。

## 四、风险

| 风险 | 影响 | 处置 |
| --- | --- | --- |
| PRD 目录含 242 份历史/差异/评审副本 | 规则与字段被重复统计 | 按作业目录分组判定最新版，场景与覆盖率只用最新版；历史版保留在登记表 |
| 同一作业存在两份 PRD（主目录 + 用例库原文档） | 版本与规则口径冲突 | 统一按作业目录归并，版本号高者胜出，落选版本进入版本冲突清单 |
| PRD 与用例库命名不完全一致 | 覆盖率虚低 | 报告单列「未匹配到同名 PRD 目录」清单，不猜测合并 |
| 字段属性表与字段说明表重复表述 | 同字段同类型多条规则 | 过滤纯标记复述；剩余差异按同文档表述差异（LOW）登记 |
| 控件类型由「填值方式」文本推断 | 与真实 DOM 可能不符 | 全部标 `candidate`，Phase 2 用真实页面校准 |
| `rules.json` 约 33 MB | 下游读取成本高 | 记录为已知局限，后续可加精简输出 |
| 无 Git 提交 | 改动不可回溯 | 建议下一步先做初始化提交与忽略规则收口 |

## 五、实施计划与执行状态

| Task | 内容 | 状态 |
| --- | --- | --- |
| Task 1 | 项目骨架 | 已完成 |
| Task 2 | 文件扫描与登记（SHA-256、稳定 ID、增量状态） | 已完成 |
| Task 3 | Markdown 解析（标题/表格/列表/行号） | 已完成；DOCX/XLSX/PDF 只留适配接口 |
| Task 4 | 知识抽取（10 类对象） | 已完成 |
| Task 5 | 关联与质量检查（版本冲突、规则冲突、断链） | 已完成 |
| Task 6 | 测试场景草案（全部 DRAFT） | 已完成 |
| Task 7 | 六份基础报告 | 已完成 |
| Task 8 | 命令行（scan / incremental / validate / report / build） | 已完成 |
| Task 9 | 单元测试 | 已完成，62 项通过 |
| Task 10 | 采购样本验证 | 已完成：采购域 11 个作业均有最新版 PRD（含请购单、采购订单、采购到货单、采购入库单的原文档） |

## 六、决策记录

1. PRD 原文只读：扫描阶段只做 `readFile` + 哈希，不做任何写回。
2. 不调用外部模型：`config.policy.allowExternalModelCalls=false`，抽取全部为规则/模板。
3. 规则来源三分：`PRD_EXPLICIT`（字段属性表直接映射）、`PRD_DERIVED`（操作说明处理步骤推导，带 `derivation`）、`PENDING`（含待确认表述）。
4. 最新版按「作业目录」分组比较版本号，文件名优先，避免把基础资料与业务单据混为一组。
5. 场景配比按规则类型优先级轮转，避免默认值/只读类占满上限。
