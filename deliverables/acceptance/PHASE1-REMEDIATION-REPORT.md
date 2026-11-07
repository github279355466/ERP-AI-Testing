# Phase 1 验收整改报告

**日期**：2026-11-07
**对象**：`artifacts/acceptance/PHASE1-ACCEPTANCE-REPORT.md` 登记的 17 项严重缺陷（P0 11 项）
**范围**：仅 Phase 1 PRD 扫描与业务知识建模；未连接 ERP、未启动浏览器、未执行 Playwright 业务用例
**性质**：开发方整改说明。**本报告不构成验收通过结论**，最终裁决须由独立复验方依据本报告与实跑证据重新作出。

---

## 一、整改结论

| 项目 | 结果 |
| --- | --- |
| 严重缺陷关闭 | 16 / 17 关闭；1 项（TXT 真实样本）待样本确认，登记 R1 |
| P0 阻塞项 | 整改动作全部落地，无未处置项；TXT 验证受样本限制 |
| 单元测试 | 63 → **76 passed**（新增 13 项，覆盖删除保留、外部根目录证据、场景准入、ID 稳定性） |
| 校验结果 | `prd:validate` **PASS（0 error / 33 warning）**，告警全部为「源文档无版本元数据」 |
| 独立复算 | 14 / 14 检查项通过（`probe/phase1-remediation-verify.out.json`） |
| 只读验证 | `prd:validate` + `prd:report` 运行前后 **27 个交付文件 SHA-256 全一致** |
| 交付基线 | 文档 333（PRD 299 / 用例库 34）、实体 82、页面 830、字段 8454、规则 27908、证据 31865、场景 3796、待确认 441 |

**整改中新发现的缺陷（已修复）**：`prd:validate` 的逐字比对只按 PRD 根目录解析，测试用例库目录下的 3,000+ 条证据被静默跳过、未真正校验。现已改为「按 `document_id` 取文档绝对路径优先、根目录相对路径兜底」，并补单测锁定。

---

## 二、17 项严重缺陷逐项整改

| # | 验收报告缺陷 | 根因 | 整改动作 | 验证证据 | 状态 |
| --- | --- | --- | --- | --- | --- |
| 1 | F1 删除即丢历史知识，`SOURCE_MISSING` 全仓 0 赋值 | 增量扫描把缺失文档直接从产物中移除 | `pipeline.ts` 增量比对时保留历史对象，文档置 `last_scan_status=SOURCE_MISSING` / `status=MISSING_SOURCE`，排除出最新版与场景生成，并登记 `SOURCE_MISSING` 待确认 | `tests/unit/prd-phase1-fix.spec.ts:96`（隔离目录删除后规则数不变、DOCUMENT_REGISTER 状态正确）；`validate.ts` 增加 `DOCUMENT_LATEST_SOURCE_MISSING` | 已关闭 |
| 2 | Phase 1 知识与运行时 API 完全断开 | 只交付了 `artifacts/knowledge/*.json`，没有消费端 | 新增 `src/knowledge/prd-knowledge.ts`：`PrdKnowledgeBase.load()` + 文档/实体/字段/规则/证据/关系查询；与 legacy `KnowledgeBase` 并存互不覆盖 | 实测加载：PRD 文档 299、最新版 47、实体 82、字段 8454、规则 27908、证据 31865；`README.md` 与 `docs/ARCHITECTURE.md` 已补用法 | 已关闭 |
| 3 | `Evidence` 对象与 `evidence/` 整体缺失 | 12 类契约只实现 11 类 | 新增 `src/prd/evidence.ts`，证据独立落盘 `artifacts/knowledge/evidence.json`；每个知识对象通过 `evidence_ids` / `referenced_by` 双向关联 | 31865 个对象全部 `object_type=Evidence`，均有 `source_refs`；正式 Schema `Evidence.schema.json` | 已关闭 |
| 4 | 证据非原文逐字、无版本、行号偏移 | `excerpt` 由描述文本截取，非原文切片 | 改为「原文行切片」：`excerpt` 取 `line_start` 所在行原文；`SourceRef` 内嵌 `doc_version` + `sha256` + `line_start`；`prd:validate` 逐行回读比对，不一致即 ERROR | 独立抽样 400 条：**400/400 逐字命中、400/400 落在声明行**；全量 `verbatim=true` 31865/31865；版本覆盖 31832/31865（99.9%） | 已关闭 |
| 5 | `PRD_EXPLICIT` 误标 32.1%~50%，占位/示例/回参文本被当成明确规则 | 文本按关键词直接判为 EXPLICIT，无来源分层 | 重定义口径：占位符、示例、回参残片、纯接口调用过滤或降级；新增 `PLATFORM_SERVICE` 来源；`derivation` 逐条回填 | 全量分布 `PRD_EXPLICIT` 20226 / `PRD_DERIVED` 5619 / `PLATFORM_SERVICE` 2060 / `PENDING` 3；最新版 3048 / 800 / 403；5619 条推导规则 100% 带 `derivation` | 已关闭（服务口径见残余 R3） |
| 6 | 采购 7 节点 0 实体级关系，722 条依赖 `target_id` 全 null | 只做字段级 `REFERENCES`，未解析单据间取单关系 | 新增 `src/prd/relations.ts`：从取单/回写原文识别单据关系，`DERIVED_FROM` 建边并解析 `target_id`；`USES_MASTER_DATA` 关联基础资料；无法解析的目标按文档登记 `MISSING_DEFINITION` | 依赖 855 条：`target_id` 解析 374 条；`DERIVED_FROM` 19、`USES_MASTER_DATA` 347、`REFERENCES` 489；采购链路实体级边 16 条（退货出库→退货单/订单/到货单、退货单→入库单/到货单/订单等） | 已关闭（残余 481 条见 R2） |
| 7 | 「入库取到货」有原文 0 建模；数量/状态/回写未结构化 | 依赖抽取只认固定表格，取单章节未解析 | 取单/回写章节纳入关系抽取；规则补 `conditions`、依赖补 `mapping`（字段赋值、状态门槛、服务调用） | `conditions` 非空 7991 条；`mapping` 非空 711 条；采购入库单→采购到货单等边可在 `dependencies.json` 直接检索 | 已关闭 |
| 8 | 410 条引用推导规则的场景未标 `NEEDS_CONFIRMATION`，校验器假阴性 | 场景准入只看规则数量，未逐条检查规则来源 | `scenarios.ts` 改为字段级联合判定；`validate.ts` 增加 `SCENARIO_DERIVED_NOT_CONFIRMED` 硬门禁 | 引用推导规则的场景 693 条，**漏标 0**；校验器负向单测（人为构造违例可检出） | 已关闭 |
| 9 | 6 份根级 md、77 份 PRD 静默丢失，4 类缺口待确认计数 0 | 未建模内容没有登记出口 | 根级散落文档、`_diff` 体检文档、用例库辅助文件统一登记 `EXCLUDED_SOURCE`；来源冲突/重复来源/缺失定义分别登记 | 待确认 441 条：`RULE_CONFLICT` 212、`MISSING_DEFINITION` 86、`EXCLUDED_SOURCE` 77、`VERSION_CONFLICT` 20、`BROKEN_FLOW` 19、`SOURCE_CONFLICT` 13、`DUPLICATE_SOURCE` 11、`AMBIGUOUS_RULE` 3；解析错误 0 | 已关闭 |
| 10 | 仅 2 份 Schema，10 类缺失，未接入运行时 | Schema 只存在于开发包，校验器为自实现子集 | 新增 `scripts/generate-prd-schemas.mjs` 生成 13 类 + `common.schema.json`；`src/prd/schema.ts` 用 ajv（Draft 2020-12）执行，接入 `prd:validate` | `schemas/` 14 个文件；`validate.ts` 调用 `validateBundleSchemas`；`npm run prd:validate` 全量 Schema 校验 0 error | 已关闭 |
| 11 | `prd:validate` / `prd:report` 实际执行 FULL 重建，320/325 文件 SHA 改变 | 命令入口复用了扫描流水线 | 拆分为只读加载：`loadKnowledgeBundle` → 校验/渲染，不再扫描与写知识库；`report` 支持 `--out` 重定向 | 运行两命令前后 27 个交付文件（13 知识 JSON + 2 索引 + 12 报告）SHA-256 **全一致**（`probe/phase1-readonly-check.out.json`） | 已关闭 |
| 12 | Parser Adapter 未实现、TXT 无解析器、`reservedExtensions` 死配置 | 解析分派硬编码在 `extract.ts` | 抽出 `src/prd/parsers.ts` 适配层，按扩展名分派 MD/JSON/TXT；`reservedExtensions` 命中即登记「不支持格式」而非静默忽略 | 适配层存在且被 `extract.ts` 调用；TXT 走 Markdown 解析路径；当前输入集 0 份 TXT | 已关闭（验证受样本限制，R1） |
| 13 | 2600 个 `UI_READY` 前置条件 100% 通用模板，363 个引用推导规则 | 可行性默认值过宽，未与证据强度联动 | 引入 `NEEDS_UI_EXPLORATION` 中间态；仅当规则全部为 `PRD_EXPLICIT/CONFIRMED` 且有可观察断言时才可能进入 UI 就绪 | `UI_READY` **0**；`NEEDS_UI_EXPLORATION` 2786 / `NEEDS_CONFIRMATION` 693 / `NOT_UI_OBSERVABLE` 317 | 已关闭 |
| 14 | `UI_READY` 与 `DRAFT` 语义冲突，正文仍为模板占位 | 同上 | 同上；场景正文改为按规则类型生成数据要求、步骤与断言目标，不再固定模板 | 3796 个场景全部 `DRAFT` + `review_required=true`，无执行入口 | 已关闭 |
| 15 | 证据 7 要素中 5 项全库为 0，`EVIDENCE_MISSING` 0 次 | 证据未建模为独立对象 | 证据对象补齐 `document_id/file_path/doc_version/sha256/section/line_start/excerpt/referenced_by`；校验器对缺项分别报错或告警 | 哈希/行号/原文 31865/31865；版本 31832/31865；`EVIDENCE_*` 校验码生效 | 已关闭（R4） |
| 16 | `source_type` 六分类缺 3 类，3856 条平台服务表述误标 EXPLICIT | 类型定义只有 3 类 | 类型补全为 `PRD_EXPLICIT/PRD_DERIVED/PLATFORM_SERVICE/UI_OBSERVED/USER_CONFIRMED/PENDING`；平台服务表述独立归类 | `PLATFORM_SERVICE` 2060 条（最新版 403）；`UI_OBSERVED/USER_CONFIRMED` 在 Phase 1 合法为 0 | 已关闭（R3） |
| 17 | 流程表列错配，8 列丢 5 列，68/143 条 step 为纯数字 | 按位置取列，未按表头映射 | 按原表列头映射 `seq/step/description/actor/precondition/output/next_step/exception` | 143 个流程、1315 个步骤，结构化 1315/1315，纯数字 0 | 已关闭 |

---

## 三、指标对比（验收时 → 整改后）

| 指标 | 验收时 | 整改后 | 说明 |
| --- | --- | --- | --- |
| 规则总数 | 30641 | 27908 | 过滤占位/示例/回参残片后减少 |
| 最新版规则来源 | 4166 EXPLICIT / 491 DERIVED | 3048 EXPLICIT / 800 DERIVED / 403 PLATFORM_SERVICE | 分类重界定 |
| 场景 | 4067 | 3796 | 与最新版规则同步 |
| `UI_READY` 场景 | 2600 | **0** | 全部改为 `NEEDS_UI_EXPLORATION` |
| 引用推导规则未标确认 | 410 | **0** | 字段级门禁 |
| 证据对象 | 0（仅内嵌） | 31865 | 独立 `evidence.json` |
| 证据逐字 | 0/40 抽样 | 400/400 抽样；全量 `verbatim=true` | 原文行切片 |
| 证据内嵌版本 | 0 | 31832/31865 | 33 条源文档无版本元数据 |
| 依赖 `target_id` | 0/722 | 374/855 | 481 条为非实体引用，已登记 |
| 实体级关系 | 0 | 133（其中采购链路 16） | `DERIVED_FROM` 19 |
| `conditions` 非空 | 0 | 7991 | 触发条件结构化 |
| 待确认登记 | 4 类为 0 | 8 类共 441 条 | 含 `EXCLUDED_SOURCE` 77 |
| 正式 Schema | 2 份、未接入 | 14 个文件、ajv 接入 | 13 类 + common |
| `validate/report` 只读 | 否（320/325 变化） | 是（27/27 不变） | 独立 SHA 复算 |
| 单元测试 | 63 | 76 | 新增 13 项 |

---

## 四、受控残余（不隐藏、不冒充已解决）

| 编号 | 残余 | 影响 | 处置 |
| --- | --- | --- | --- |
| R1 | TXT 解析分支没有真实样本可验证 | 当前输入集 0 份 `.txt`，能力无法用真实数据证明 | 保持 `P2`；获得 TXT 样本后补一次实跑，未验证前不宣称支持 |
| R2 | 481 条依赖 `target_id` 未解析 | 多为字段码、后端表名、API 入参名，非业务实体 | 已按文档登记 `MISSING_DEFINITION` 待确认；不伪造实体关系 |
| R3 | 2390 条字段行为规则引用平台服务，仍归 `PRD_EXPLICIT` | 归类口径存在争议（服务行为是否等同 PRD 明确规则） | 登记 `OQ-SVC-EXPLICIT-CALIBER`，待 PRD 负责人裁决；影响面已在报告披露 |
| R4 | 33 条证据无版本 | 源文档本身无版本元数据 | `EVIDENCE_VERSION_UNKNOWN` WARN；不阻断，但复验时应抽查其原文可读性 |
| R5 | 根级 6 份 md、71 份 `_diff` 文档不建模 | 属评审/体检类材料，非正式 PRD | 登记 `EXCLUDED_SOURCE`；如需建模须先明确其规则效力 |
| R6 | 7 个库存存货域作业仍缺 PRD | 覆盖率 20.1% 受数据缺口限制 | 属外部数据补齐事项，已在 `reports/NEXT_PHASE_RECOMMENDATION.md` 列明 |

---

## 五、改动文件

**新增**

- `src/prd/evidence.ts`、`src/prd/relations.ts`、`src/prd/schema.ts`、`src/prd/store.ts`
- `src/knowledge/prd-knowledge.ts`
- `scripts/generate-prd-schemas.mjs`、`schemas/*.schema.json`（14）
- `tests/unit/prd-phase1-fix.spec.ts`、`tests/unit/prd-ids.spec.ts`
- `probe/phase1-remediation-verify.mjs`、`probe/phase1-readonly-check.mjs`

**修改**

- `src/prd/{types,config,scanner,extract,link,pipeline,scenarios,validate,reports,cases}.ts`
- `src/cli/prd.ts`、`README.md`、`docs/ARCHITECTURE.md`
- `reports/*.md`（由只读渲染重新生成）

---

## 六、复验入口

```bash
npm run build          # 0 error
npm run typecheck      # 0 error
npm run test:unit      # 76 passed
npm run prd:validate   # PASS（0 error / 33 warning）
node probe/phase1-remediation-verify.mjs   # 14/14
node probe/phase1-readonly-check.mjs       # readonly=true，27 files
```

**建议独立复验重点**：① 隔离目录删除后知识保留；② 随机抽样 200 条证据逐字与行号；③ 采购链路 16 条实体边的原文依据；④ `prd:validate`/`prd:report` 只读；⑤ 残余 R1~R6 的口径是否可接受。
