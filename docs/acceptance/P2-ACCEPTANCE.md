# P2 验收报告：PRD 与知识引擎平台化

> 状态：**P2 已完成，等待与 P3 一并通过人工确认**。
> 验收日期：2026-11-08。
> 基线：`ff5d8ac`（P1 提交）。
> 范围：把 PRD 扫描建模从单一采购流程抽为「模块来源索引 + 通用扫描 + 术语表」；只读 PRD 文件，不连接 ERP，不启动浏览器。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| 不连接 ERP | 通过 | `platform-prd` 只读本地 PRD/Markdown |
| 不启动浏览器 | 通过 | 无 Playwright 依赖 |
| 不执行写操作 | 通过 | 仅写 `artifacts/modules/<id>/` 知识产物 |
| 采购逻辑不进平台核心 | 通过 | 平台侧只认 `source-index/index.yaml` 契约；采购目录清单属于模块包 |
| 无凭据入库 | 通过 | 环境变量以 `${VAR}` 引用，缺失即报错 |
| 未虚构字段 | 通过 | 全部产物含 `source_refs`，未验证项进入 `open-questions` |

## 2. 交付物

| 类别 | 交付物 |
| --- | --- |
| 契约 | `platform/contracts/schemas/source-index.schema.json`、示例 `source-index.valid.yaml` |
| 模块来源索引 | `business-modules/purchase/source-index/index.yaml`（采购 4 个 PRD 目录 + 用例库） |
| 来源解析 | `src/platform/prd/module-source.ts`（schema 校验、`${VAR}` 展开、默认 PRD 根推导、输出路径规划） |
| 术语表 | `src/platform/prd/glossary.ts`（ENTITY / FIELD / CODE 三类术语，保留来源） |
| 扫描编排 | `src/platform/prd/scan.ts`（按 `include_paths` 限定范围，输出 glossary + module-summary） |
| CLI | `src/cli/platform-prd.ts`（`modules` / `validate` / `scan --incremental`） |
| 扫描器改造 | `src/prd/config.ts`、`src/prd/scanner.ts` 新增 `includePaths` 过滤 |
| 测试 | `tests/platform/prd-scanner.spec.ts`（5 项） |

## 3. 真实扫描结果（purchase）

命令：`npm run platform:prd:scan -- --module purchase`

| 指标 | 数值 |
| --- | --- |
| 文档 | 122 |
| 实体 | 20 |
| 字段 | 2,616 |
| 规则 | 9,316 |
| 流程 | 28 |
| 依赖关系 | 209 |
| 场景 | 1,664 |
| 待确认问题 | 381 |
| 术语 | 686 |
| 校验 | valid，0 error / 30 warning |
| 现有用例覆盖 | 1,990 条规则，覆盖 530，覆盖率 26.63% |

产物目录：`artifacts/modules/purchase/{source-index,knowledge,reports}/`。

## 4. P2 验收项逐条核对

| 验收指标 | 结果 | 证据 |
| --- | --- | --- |
| 递归扫描指定模块资料目录 | 通过 | 122 份文档、24 个一级业务目录中按 `include_paths` 仅纳入采购与共用用例库 |
| 抽取规则可定位原文件与章节/行号 | 通过 | 规则/字段/场景均带 `source_refs`（`document_id` + `file_path` + `section` / `line_start`） |
| 识别新增、修改、删除文件 | 通过 | 增量扫描测试覆盖新增/修改；删除标记沿用 `ScanStatus.SOURCE_MISSING` |
| 冲突与不确定项进入待确认清单 | 通过 | `open-questions.json` 381 条，`VERSION_CONFLICTS.md` 可读报告 |
| 结构化产物可校验 | 通过 | 扫描内置校验 0 error；`glossary.json` 通过 `KnowledgeBase.load` 路径写入 |

## 5. 已知限制

| 限制 | 影响 | 处理计划 |
| --- | --- | --- |
| 30 条校验 warning | 多为缺章节号/表格定位，不影响可用性 | P4 页面映射时按需补全，不阻塞 |
| 规则覆盖率 26.63% | 现有用例库并非全量覆盖 | 在 P6 覆盖报告中透明列出未覆盖规则 |
| 场景全部 `draft` | 未经人工评审，不能进入正式套件 | P3 审批闸门强制拦截 |

## 6. 复现命令

```bash
npm run platform:prd:modules
npm run platform:prd:validate -- --module purchase
npm run platform:prd:scan -- --module purchase
npm run platform:prd:scan -- --module purchase --incremental
```
