# DECISIONS

本文件记录会影响「规则/关系是否可信」判定口径的决策。每条包含背景、决策、影响范围与复算方式。

## D-001 规则证据有效性判定口径（2026-11-07）

**背景**：第二轮验收发现 3693 条规则（13.2%）的证据是空单元格或 JSON 首行 `{`，规则本身无法回溯到 PRD 原文。

**决策**：

1. 证据摘录去掉表格修饰、分隔线与空白后，若只剩表头名（校验项/字段项/开窗说明/标题名）、空串、纯符号或 `{` `}`，判定为**无业务语义**，该规则**不生成**。
2. JSON 文档的规则证据使用 `json_path` 指向实际属性节点（`field_attr_cfg_cont.cnst.read.cond` 等），`line_start` 置空，不再用第 1 行充当证据。
3. 状态型规则（REQUIRED / READONLY / HIDDEN / DISABLED）**只能**由「是否必填 / 是否只读 / 是否隐藏 / 是否禁用」状态行产生；校验项文本里出现「只读 / 必填」等字样时一律归为 `VALIDATION`，不得反过来生成状态型规则。
4. 当校验项文本与状态行冲突时，**以状态行为准**，冲突逐字段登记 `RULE_CONTRADICTS_SOURCE` 待确认问题。
5. 有条件的规则，证据必须落在条件行（`必填条件` / `只读条件` / `隐藏条件` / `禁用条件`），摘录须包含条件原文；仅指向状态行视为 `EVIDENCE_NOT_COVERING_CONDITION`。

**影响范围**：`src/prd/extract.ts`（buildFieldRules / buildActionRules）、`src/prd/validate.ts`（RULE_EMPTY_EVIDENCE / EVIDENCE_JSON_PATH_UNRESOLVED / RULE_CONTRADICTS_SOURCE / EVIDENCE_NOT_COVERING_CONDITION）。

**复算**：`node artifacts/acceptance/_tmp/scripts/evidence-grain.js`（emptyTotal）、`contrary.js`（contrary）、`condition-audit.js`（condOrphan）。

## D-002 关系否定语义与方向判定口径（2026-11-07）

**背景**：第二轮验收发现 3 条语义相反的 `PRD_EXPLICIT / CONFIRMED` 取单关系，以及 1 条方向颠倒的关系，根因是「同行出现取单/来源关键词即建边」。

**决策**：

1. 命中按句子切分（`。；;`、`<br/>`）判定，句内出现否定或等价表述（不提供 / 不作为 / 不适用 / 不生成 / 不含 / 无需 / 不支持 / 非来源 / 只作筛选 / 仅作筛选 / 不改变来源 / 参考来源 / 仅当 / 只当 / 若把 / 如果将 / 假如 / 改为）时，该句不得作为 `PRD_EXPLICIT` 证据。
2. 格式声明句（五段式 / 重写样式 / 样式对齐 / 重写）不得作为关系证据；命中行内出现针对目标单据的格式声明时，整条命中降级。
3. 「采购订单号」这类字段名不视为对单据的引用。
4. 原文写「生成 / 产生 / 下推 目标单据」时，关系方向反转（下游 ← 当前单据），并登记 `RELATION_DIRECTION_FIXED`。
5. 被排除的命中登记 `NEGATED_RELATION`，保留原文行号，不删除证据。
6. `mapping` 只接受从原文「操作后处理 / 确定赋值」段解析出的 `本单字段 = 来源单据.字段` 数组；解析不出置 `null` 并登记 `MAPPING_UNRESOLVED`，禁止保留占位串。

**影响范围**：`src/prd/relations.ts`、`src/prd/pipeline.ts`、`src/prd/validate.ts`（RELATION_CONTRADICTS_SOURCE / RELATION_MAPPING_PLACEHOLDER）。

**复算**：`node artifacts/acceptance/_tmp/scripts/relations.js`（derivedCount / derivedRows），`node dist/cli/prd.js validate`。

## D-003 只读用例无法触发的字段唯一性规则降级（2026-11-11）

**背景**：`SMOKE-FOUNDATION-PROJECT-FIELD-RULES` 在真实 UI 只读执行时，向新增表单填入列表已有项目编号，
保存按钮未禁用且无重复提示（`attempted=true blocked=false message=`），规则集因此判失败。
用例前置条件明确「仅打开新增表单，不保存业务数据」，无法通过保存触发服务端唯一性校验。

**决策**：

1. 客户端未出现禁用/提示的唯一性规则，在只读用例下不得判为「规则不成立」，但也不得保留 `verified`。
2. `FR-FDN-PROJECT-004` 降级为 `candidate`，`notes` 记录只读观测事实与升级条件。
3. 唯一性规则的 `verified` 只接受两类证据：客户端即时拦截（禁用/提示/错误列表），或授权写用例保存后被服务端拒绝。

**影响范围**：`business-modules/foundation/field-rules/project.yaml`；字段规则评估口径不变。

**复算**：`node dist/cli/platform-run.js run --module foundation --case SMOKE-FOUNDATION-PROJECT-FIELD-RULES`。

## D-005 唯一性规则在无提示文本时以拦截为证据（2026-11-12）

**背景**：货币信息、交易对象属性、运输方式三条唯一性规则实测填入已有编码后，页面只显示「错误 1」计数，
错误详情无可见文本；原实现把该计数串当作提示文本比对，导致规则误判失败。

**决策**：

1. 探测层把「错误 N」计数串与提示文本区分：计数存在即视为 `blocked=true`，但不作为提示文案。
2. 规则声明了 `message_contains` 而实际无提示文本时，只校验拦截结果，不因文本缺失判失败；有文本时仍按声明比对。
3. 规则证据须说明「仅拦截、无文案」的观测事实。

**影响范围**：`src/platform/rules/browser-probe.ts`、`src/platform/rules/engine.ts`、`business-modules/foundation/field-rules/currency.yaml`。

**复算**：`node dist/cli/platform-run.js run --module foundation --suite SUITE-FOUNDATION-REGRESSION --allow-write --config config/athena.write.config.json`。

## D-004 界面规范只校验字段排列与显示格式（2026-11-11）

**背景**：`docs/UI规范` 的 6 张规范图同时包含字段排列、名称（编号）显示格式与颜色/字体/字号/间距等视觉信息。若把颜色与尺寸一并纳入断言，会把平台统一组件的表现误判为业务页面缺陷。

**决策**：

1. 界面规范校验只覆盖：列与字段的排列顺序、分组结构、编号/名称成对展示、开窗字段「名称（编号）」格式、按钮排列、Banner 单号与合计项结构。
2. 状态色纳入校验（列表状态列、详情状态图章）；主题色、字体、字号、间距、列宽仍属平台统一组件能力，不纳入断言（2026-11-12 规范更新）。
3. 按钮缺失但可能由状态或列宽「…」收纳造成的，记 `unknown`（待确认），不判失败；出现规范外按钮或顺序颠倒判失败。
4. 新页面首次接入使用 `--capture` 采集当前列/字段顺序为 `candidate` 基线，模板期望（标签组、批量与行内按钮、Banner、底部按钮）不随采集变化。
5. 页面自身渲染异常（ErrorBoundary / SyntaxError / 服务器错误）单独记 `PAGE-RENDER`，不得据此推断页面结构。

**影响范围**：`src/platform/ui-spec/`、`src/cli/platform-ui-spec.ts`、`business-modules/*/ui-specs/`、`platform/contracts/schemas/ui-spec.schema.json`。

### D-004 补充：开窗组件手动输入与模糊查询（2026-11-12）

**背景**：用户新增规范——所有开窗组件必须支持手动输入，并支持模糊查询。查看态输入框只读，实测不同字段间存在依赖（未选运营单元时供应商下拉为空），逐字段独立测试会产生空值误判。

**决策**：

1. 统一在「新增」表单按字段顺序抽样（默认 3 个），先填该字段编号片段并**选中首条**建立下游依赖，再统计下拉结果数。
2. 当前只判定**编号片段**模糊查询；名称片段检索平台尚未实现，暂不判定，待实现后追加。
3. 空下拉（无候选数据）或输入框只读/禁用，记「待确认」而非不符合，避免依赖导致的误判；只有"有候选但编号片段检索为 0"才判不符合。
4. 判定口径写入 `docs/UI规范/ERP-UI规范.md` D2-11 与 `docs/PHASE4-界面规范校验.md`。
5. 新增表单改用 `editStatus=create` 直开详情 URL（保留点击「新增」兜底），避免批量连跑时页签被应用关闭导致探测失败。
6. 详情页没有「名称（编号）」开窗值时无法派生编号关键词，记「待确认」，不猜测关键词。

**复算**：`node dist/cli/platform-ui-spec.js run --module purchase,foundation,base,ar,ap`。
