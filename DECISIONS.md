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
