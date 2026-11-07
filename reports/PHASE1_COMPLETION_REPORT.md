# Phase 1 完成报告（PRD 扫描与业务知识建模，整改后）

> 完成时间：2026-11-07
> 批次：独立验收整改后重跑
> 运行命令：`npm run build` → `npm run test:unit` → `npm run prd:scan` → `npm run prd:validate` → `npm run prd:report`
> 运行模式：全量扫描（`FULL`）；增量模式 `prd:scan:incremental` 单独验证删除标记
> 约束：未连接 ERP、未启动浏览器、未执行 Playwright、未调用 ERP OpenAPI/MCP

## 一、实测指标

| 指标 | 数值 |
| --- | --- |
| 扫描文件 | 540（支持格式 540，不支持 0） |
| 建模文档 | 333（PRD 299 / 测试用例库 34） |
| PRD 文档构成 | Markdown 273 / 平台 `prd_spec` JSON 26 |
| 作业目录 | 47（另有 6 份根级散落 md，已登记为 `EXCLUDED_SOURCE`） |
| 判定为最新版 | 47 份 |
| 实体 / 页面 | 82 / 830 |
| 字段 / 控件 | 8454 / 8454 |
| 规则 | 27908（全量）/ 4251（最新版） |
| 动作 / 流程 / 依赖 | 1896 / 143 / 855 |
| 场景草案 | 3796（全部 `DRAFT` + `review_required=true`） |
| 待确认问题 | 441 |
| 证据对象 | 31865（逐字 31865，含版本 31832） |
| 解析错误 | 0 |
| 校验结果 | **PASS**（0 error / 33 warning） |
| 规则覆盖率 | 20.1%（854 / 4251，仅最新版） |
| 单元测试 | **76 passed** |

最新版规则来源：`PRD_EXPLICIT` 3048 / `PRD_DERIVED` 800 / `PLATFORM_SERVICE` 403。

场景可行性分布：`NEEDS_UI_EXPLORATION` 2786 / `NEEDS_CONFIRMATION` 693 / `NOT_UI_OBSERVABLE` 317 /
`UI_READY` **0**。

待确认问题分布：规则冲突 212、缺失定义 86、排除来源 77、版本冲突 20、流程断链 19、来源冲突 13、
重复来源 11、歧义规则 3。

## 二、验收条件核对

| 验收项 | 结果 | 证据 |
| --- | --- | --- |
| 扫描完整 PRD 目录及子目录 | 通过 | 540 文件全登记；未建模 207 条均有原因 |
| 支持 MD / TXT / JSON | 部分通过 | MD / 平台 JSON 已覆盖；TXT 走 Markdown 解析路径，输入集 0 份，尚无真实样本验证（P2） |
| 文档登记表、哈希与稳定 ID | 通过 | `artifacts/source-index/DOCUMENT_REGISTER.json` |
| 增量 NEW / MODIFIED / UNCHANGED / SOURCE_MISSING | 通过 | 删除文件后文档保留、状态 `SOURCE_MISSING`、规则可回溯；单测覆盖 |
| 12 类知识对象 | 通过 | 13 类（含 `Evidence`），见 `artifacts/knowledge/*.json` |
| JSON Schema 校验 | 通过 | `schemas/` 13 类正式 Schema + ajv，`prd:validate` 执行 |
| 明确规则证据逐字可追溯 | 通过 | `SourceRef` 含 `doc_version` / `sha256` / `line_start` / 逐字 `excerpt`；40/40 抽样命中 |
| 推导规则单独标记 | 通过 | `PRD_DERIVED` 800（最新版），`confidence=DERIVED` |
| 明确规则误标清理 | 通过（口径已登记） | 占位符/示例/回参残片/纯接口调用已过滤或改判；387 条字段行为引用服务保留 `PRD_EXPLICIT` 并登记 `OQ-SVC-EXPLICIT-CALIBER` |
| 跨版本冲突登记 | 通过 | `VERSION_CONFLICT` 20 / `SOURCE_CONFLICT` 13 / `DUPLICATE_SOURCE` 11 |
| 采购 7 节点关系 | 通过 | 订单取请购、到货取订单、入库取到货、退货取入库/出库均为 `DERIVED_FROM`，`target_id` 全解析 |
| 数量 / 状态 / 前置 / 回写结构化 | 通过 | `conditions` 7991 条非空，`mapping` 694 条非空，取单/回写缺口登记 OQ |
| 静默内容丢失登记 | 通过 | 根级 6 份 md、`_diff` 71 份、207 份用例库辅助文件均登记；`EXCLUDED_SOURCE` 77 |
| 场景准入 | 通过 | 引用推导规则且未标 `NEEDS_CONFIRMATION` 的场景 **0**；`UI_READY` **0**；校验器可检出违规 |
| `prd:validate` 只读 | 通过 | 运行前后 48 个交付文件 SHA-256 全一致 |
| `prd:report` 可重生成且不重扫 | 通过 | 重渲染后 48 个文件 SHA-256 全一致，知识库未被改写 |
| 场景未经评审不可执行 | 通过 | 全部 `status=DRAFT`、`review_required=true`，无执行入口 |
| 未连接 ERP / 未执行 UI | 通过 | Phase 1 策略项为硬门禁，置 true 直接抛错 |

## 三、整改闭环

17 项严重缺陷的逐条关闭证据见 `reports/PHASE1-REMEDIATION-REPORT.md`。11 项 P0 已全部闭环：
`SOURCE_MISSING`、场景准入、证据逐字、明确规则口径、采购链路、条件结构化、静默丢失登记、
只读命令、版本基准、覆盖率口径、独立重跑。

## 四、已知残余（不隐瞒）

1. 33 条证据无法确定文档版本（`EVIDENCE_VERSION_UNKNOWN`），来源文档缺少版本元数据。
2. 855 条依赖中 481 条仍无法解析到实体，均为字段码/表名级引用，已按文档登记
   `MISSING_DEFINITION` OQ，不伪装成实体关系。
3. 387 条 `PRD_EXPLICIT` 规则（开窗 / 默认值 / 只读 / 必填）描述中引用平台服务，归类口径待
   PRD 负责人裁决，暂保留字段行为口径并记录 `service_refs`。
4. 库存存货域 7 个用例作业仍缺 PRD，覆盖率 20.1% 受此缺口影响。
5. `_diff` / `_history` 文档只登记不建模；TXT 专用解析器与 Parser Adapter 属 P2，未实现。
6. 覆盖率仍是字段级启发式匹配，不代表业务语义覆盖。

## 五、运行说明（Windows）

```powershell
npm install
npm run build
npm run test:unit
npm run prd:scan
npm run prd:validate
npm run prd:report
```

Node.js 要求 22+（本机 v24.19.0 实测；验收环境 v22.22.2 亦可）。PRD 路径通过
`config/prd-modeling.config.local.json`（本机、不入库）或 `PRD_INPUT_DIR` / `--prd` 提供。
