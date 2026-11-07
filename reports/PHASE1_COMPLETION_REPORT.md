# Phase 1 完成报告（PRD 扫描与业务知识建模）

> 完成时间：2026-11-07（含 PRD 原文档补充后的重跑）
> 运行命令：`npm run prd:scan`
> 运行模式：全量扫描（`FULL`），另有 `scan:incremental` 增量模式

## 一、实测指标

| 指标 | 数值 |
| --- | --- |
| 扫描文件 | 540（支持格式 540，不支持 0） |
| PRD 文档 | 299（Markdown 273 / 平台 JSON 26） |
| ├ 主 PRD 目录 | 272 份，30 个作业目录 |
| └ 用例库内 PRD 原文档 | 27 份（`测试用例/<域>/<作业>/DOCxxx_<作业>_V<版本>.md`） |
| 测试用例库 | 34 个作业包，用例 1477 条 |
| 建模文档合计 | 333 |
| 判定为最新版 | 47 份（财务 5 / 采购 11 / 应付 6 / 应收 6 / 基础资料 19） |
| 实体 | 82 |
| 页面 | 830 |
| 字段 / 控件 | 8454 / 8454 |
| 规则 | 30641（全量），最新版 4657 |
| 动作 | 1896 |
| 流程 / 依赖 | 143 / 722 |
| 场景草案 | 4067（全部 DRAFT） |
| 待确认问题 | 330 |
| 解析错误 | 0 |
| Schema / 引用校验 | PASS（0 error / 0 warning） |
| 规则覆盖率 | 18.3%（854 / 4657，仅最新版） |
| 用例作业匹配率 | 79.4%（27 / 34 个作业有可建模 PRD） |

规则来源分布（最新版）：`PRD_EXPLICIT` 4166、`PRD_DERIVED` 491。

待确认问题分布：

| 类别 | 数量 | 严重度 |
| --- | --- | --- |
| 版本冲突 | 20 | HIGH |
| 规则冲突（跨文档） | 25 | MEDIUM |
| 规则表述差异（同文档） | 251 | LOW |
| 流程断链（引用了未建模对象） | 19 | LOW |
| 字段重复定义 | 12 | LOW |
| 规则含待确认表述 | 3 | MEDIUM |

## 二、验收条件核对

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 可扫描完整 PRD 目录及子目录 | 通过 | 540 个文件，含 `_history`/`_diff`/`_review`/`_upload` 与用例库原文档 |
| 支持 MD / TXT / JSON | 通过 | `config.prd.includeExtensions`；实测 Markdown 273、JSON 26 |
| 生成文档登记表、哈希与稳定 ID | 通过 | `artifacts/source-index/DOCUMENT_REGISTER.json` |
| 可识别新增、修改、未变化 | 通过 | 增量运行全部 `UNCHANGED`；单测覆盖 NEW/MODIFIED/SOURCE_MISSING |
| 输出结构化知识模型 | 通过 | `artifacts/knowledge/*.json` 共 13 个文件 |
| 所有规则含来源类型与证据 | 通过 | 校验 0 缺证据；`source_type` 显式/推导二分 |
| 可识别版本冲突与待确认问题 | 通过 | 330 条，见 `OPEN_QUESTIONS.md` |
| 可建立实体、规则、流程、依赖 | 通过 | entities 82 / workflows 143 / dependencies 722 |
| 输出场景草案与覆盖率矩阵 | 通过 | 4067 场景、`COVERAGE_MATRIX.md` |
| 场景未经评审不可执行 | 通过 | 全部 `status=DRAFT` 且 `review_required=true` |
| 自动化测试通过 | 通过 | `tests/unit` 63 项全绿 |
| 提供 Windows 运行说明 | 通过 | 见本报告第五节 |
| 未连接 ERP / 未调用 ERP API / 未执行 UI | 通过 | 本阶段代码无 Playwright 浏览器调用；策略项 `allowErpConnectionInPhase1=false` |

## 三、交付物

知识库（`artifacts/knowledge/`）：

- `documents.json`、`entities.json`、`pages.json`、`fields.json`、`controls.json`
- `rules.json`、`actions.json`、`workflows.json`、`dependencies.json`
- `scenarios.json`、`existing-cases.json`、`open-questions.json`、`summary.json`

登记与缓存（`artifacts/source-index/`）：

- `DOCUMENT_REGISTER.json`、`scan-report.md`、`.scan-state.json`、`.parse-cache/`

报告（`reports/`）：

- `PRD_INDEX.md`、`PRD_ANALYSIS_REPORT.md`、`COVERAGE_MATRIX.md`
- `OPEN_QUESTIONS.md`、`VERSION_CONFLICTS.md`、`PARSE_ERRORS.md`
- 本报告与 `IMPLEMENTATION_ASSESSMENT.md`、`KNOWN_LIMITATIONS.md`、`NEXT_PHASE_RECOMMENDATION.md`

## 四、真实完成 / 未完成

已完成：

- 扫描、哈希、稳定 ID、增量状态与解析缓存。
- 十类知识对象抽取，规则保留来源类别、证据位置与推导依据。
- 用例库内 PRD 原文档自动识别为 PRD，并与主目录同名作业按同一「作业目录」归并版本。
- 版本冲突、规则冲突、流程断链、字段重复定义的自动识别。
- 场景草案生成（按类型轮转配比，全部 DRAFT）。
- 六份规范报告 + 四份交付报告。
- 63 项单元测试。

未完成 / 受数据限制：

- 库存存货域的 7 个作业仍无 PRD：品号存货信息、品号批号信息、通用单位换算、存货业务单别、存货单别参数、存货成本分类、维护存货会计分类。
- DOCX / XLSX / PDF 解析仅保留适配接口，未实现。
- 控件类型与真实 DOM 未核对，全部为候选值。
- 覆盖率 18.3% 是「现有用例对最新版规则」的匹配结果，不等于业务覆盖率。
- 流程（workflows）共 143 条，未随新增 PRD 增长：补充的原文档中「业务流程图」章节为空表（`*-*`）。
- `rules.json` 约 36 MB，尚未提供精简输出。

## 五、Windows 运行说明

前置：Node.js ≥ 20（实测 v24.19.0）、npm 11。

```powershell
cd D:\AIProject\ERP-AI-Testing
npm install

npm run prd:help              # 查看命令
npm run prd:scan              # 全量扫描 + 建模 + 报告
npm run prd:scan:incremental  # 增量扫描（未变化文档走缓存）
npm run prd:validate          # 仅校验知识模型
npm run prd:report            # 仅重生成报告
npm run prd:build             # 扫描 + 校验 + 报告
```

可选参数（直接调用编译产物时）：

```powershell
node dist\cli\prd.js scan --prd <PRD目录> --scenario <用例目录> --json
```

退出码：`0` 成功；`1` 校验失败或运行异常。

配置：`config/prd-modeling.config.json`，默认指向本机 PRD 与测试用例目录，可按需覆盖。

## 六、修正与增强记录

收口阶段修正 8 处问题：

1. 命令行覆盖率分母误用全量规则（含历史版本），改为最新版规则。
2. 字段「说明/校验项」中的纯标记复述被二次抽成规则，产生同字段同类型重复规则。
3. 操作说明推导出的规则未标记 `PRD_DERIVED`，来源类别全部落在 `PRD_EXPLICIT`。
4. 增量命中解析缓存时，文档登记沿用旧扫描状态（应 `UNCHANGED` 却显示 `NEW`）。
5. 冲突检测把「同文档多处表述」与「跨文档定义冲突」混为一谈，现按严重度分离。
6. 用例库内 `DOCxxx_<作业>_V<版本>.md` 未被识别为 PRD，导致 27 个作业无建模数据。
7. 版本与最新版分组按路径首段进行，补充 PRD 全部落入「域」目录而互相覆盖；改为按「作业目录」分组。
8. 历史目录 `_history/_diff/_dup_*` 被误当作作业目录；改为忽略所有下划线前缀目录。
