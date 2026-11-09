# 字段规则集（field-rule）

对应 Schema：`platform/contracts/schemas/field-rule.schema.json`

规则文件位置：`business-modules/<module_id>/field-rules/*.yaml`

## 1. 规则类型

| 类型 | 断言内容 | expected 关键字段 |
| --- | --- | --- |
| `REQUIRED` | 必填标记 | `required` |
| `READONLY` | 只读 | `readonly` |
| `DISABLED` | 禁用 | `disabled` |
| `DEFAULT_VALUE` | 打开表单后的默认值 | `value_mode`（`equals`/`not_empty`/`empty`/`today`/`regex`）、`value` |
| `LINKAGE` | 触发字段变化后的目标字段值 | 同 `DEFAULT_VALUE`，通常配合 `when` |
| `SAVE_BLOCK` | 保存是否被拦截及提示文案 | `blocked`、`message_contains` |
| `UNIQUE` | 重复编码是否被拦截及提示文案 | `unique`、`message_contains` |
| `MAX_LENGTH` | 输入框 `maxlength` | `max_length` |
| `FORMAT` | 字段值正则 | `value`（正则表达式） |
| `RANGE` | 数值区间 | `min`、`max` |

## 2. 触发时机与条件

- `trigger: FORM_OPEN`：使用打开表单后的 `before` 快照。
- `trigger: ON_CHANGE`：使用字段变更后的 `after` 快照。
- `trigger: SAVE`：读取保存结果 `SaveOutcome`。
- `when.state`：`empty` / `not_empty` / `changed`。
  - `changed` 比较 `before` 与 `after` 中依赖字段的值，未变化时规则记为 `skipped`。
  - `when` 现在对所有规则类型生效，不再只作用于 `LINKAGE`。

## 3. 结果状态

| 状态 | 含义 | 是否阻塞规则集 |
| --- | --- | --- |
| `passed` | 与期望一致 | 否 |
| `failed` | `verified` 规则不一致 | 是 |
| `warning` | `candidate` 规则不一致 | 否 |
| `skipped` | 字段未渲染、条件不满足或探测未执行 | 否 |

## 4. 页面探针

`src/platform/rules/browser-probe.ts`：

- `captureFieldStates(page, fields)`：采集值、必填、只读、禁用、可见、`maxlength`、错误文案；复选框返回 `true`/`false`，下拉读取显示文本。
- `captureSaveOutcome(page, buttonText)`：点击保存后优先读取错误徽标/错误抽屉/弹窗，再判断 `blocked`。
- `probeUniqueField(page, field, existingValue)`：填入已有编码并失焦，读取保存按钮状态与错误抽屉中的提示。

## 5. 执行入口

| 模块 | 流程 | 说明 |
| --- | --- | --- |
| `purchase` | `purchase-order-field-rules` | 打开新增表单，采集字段状态；`saveAttempt=true` 时执行保存并清理草稿 |
| `foundation` | `foundation-field-rules` | 按 `pageKey` 加载规则，打开新增表单、清空筛选、执行唯一性探测，不保存 |

命令示例：

```bash
node dist/cli/platform-run.js run --module foundation --case SMOKE-FOUNDATION-WAREHOUSE-FIELD-RULES --config config/athena.write.config.json
node dist/cli/platform-run.js run --module purchase --case SMOKE-PURCHASE-ORDER-SAVE-BLOCK --allow-write --config config/athena.write.config.json
```

## 6. 基础管理规则包

`business-modules/foundation/` 由 `scripts/generate-foundation-pack.mjs` 从
`reports/foundation/FIELD-RULE-MATRIX.csv` 生成，当前覆盖 9 个关键页面：

| page_key | 页面 |
| --- | --- |
| `trans-obj-attr` | 交易对象属性 |
| `warehouse` | 仓库信息 |
| `currency` | 货币信息 |
| `meas-unit` | 计量单位 |
| `customer` | 客户通用信息 |
| `supplier` | 供应商通用信息 |
| `financial-institution` | 金融机构 |
| `transport-mode` | 运输方式 |
| `project` | 项目信息 |

规则覆盖必填、默认值、禁用、最大长度与编码唯一性；共 108 条规则。

## 7. 已知限制

- `LINKAGE` 只能断言目标字段的值/状态，无法表达“取值方式=列举时明细子表必填”这类跨区域规则。
- `FORMAT`、`RANGE` 已实现并有单测，但基础管理规则包暂未使用（矩阵中缺少格式/区间事实）。
- 采购订单保存行为已实测为“允许无明细草稿”，提交/审核阶段是否拦截尚未验证。
