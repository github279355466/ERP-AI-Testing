# 字段规则引擎 P0–P2 实施报告

- 日期：2026-11-09
- 范围：规则引擎补强、基础管理规则包接入、真实 UI 验证
- 结论：P0/P1/P2 全部完成；基础管理 9 个页面 108 条规则、117 条断言全部通过

## 1. P0 修复项

| 项 | 修改 | 验证 |
| --- | --- | --- |
| `when.state=changed` | 比较 `before/after` 依赖字段值，未变化记 `skipped` | 单测 `changed 条件只在依赖字段实际变化时求值` |
| `when` 作用域 | 从仅 `LINKAGE` 扩展到全部规则类型 | 单测 `when 条件对非联动规则同样生效` |
| 保存拦截执行 | `purchase-order-field-rules` 支持 `saveAttempt=true`，接入 `captureSaveOutcome` | `FDN-PO-SAVE-BLOCK-03` |
| 保存判定 | 错误徽标/错误抽屉/弹窗优先于成功 toast | 单测与真实运行 |
| 草稿清理 | 保存后读取单号，按单号删除本 run 草稿 | `draft=PO0501-2026110900001`，清理后 2026-11-09 单据为 0 |
| 真实行为 | 采购订单“无明细保存”**不拦截**，生成草稿；规则改为 `FR-PO-SAVE-DRAFT-ALLOWED` | `artifacts/FDN-PO-SAVE-BLOCK-03/report.md` |

## 2. P1 新增规则类型

| 类型 | 断言 | 单测 |
| --- | --- | --- |
| `UNIQUE` | 重复编码是否被拦截 + 提示含“重复” | 通过 |
| `MAX_LENGTH` | `maxlength` 精确匹配 | 通过 |
| `FORMAT` | 字段值正则 | 通过 |
| `RANGE` | 数值最小/最大边界，非数值失败 | 通过 |

Schema 同步扩展：`type` 枚举与 `unique`、`max_length`、`min`、`max`。

## 3. P2 基础管理规则包

规则来源：`reports/foundation/FIELD-RULE-MATRIX.csv`，由 `scripts/generate-foundation-pack.mjs` 生成。

| page_key | 页面 | 规则数 | 用例 | 断言 | 结果 | run id |
| --- | --- | ---: | --- | ---: | --- | --- |
| `trans-obj-attr` | 交易对象属性 | 14 | SMOKE-FOUNDATION-TRANSOBJATTR-FIELD-RULES | 15 | 通过 | `FDN-RULES-TRANSOBJATTR-FINAL` |
| `warehouse` | 仓库信息 | 11 | SMOKE-FOUNDATION-WAREHOUSE-FIELD-RULES | 12 | 通过 | `FDN-RULES-WAREHOUSE-FINAL` |
| `currency` | 货币信息 | 19 | SMOKE-FOUNDATION-CURRENCY-FIELD-RULES | 20 | 通过 | `FDN-RULES-CURRENCY-FINAL` |
| `meas-unit` | 计量单位 | 8 | SMOKE-FOUNDATION-MEASUNIT-FIELD-RULES | 9 | 通过 | `FDN-RULES-MEASUNIT-FINAL` |
| `customer` | 客户通用信息 | 21 | SMOKE-FOUNDATION-CUSTOMER-FIELD-RULES | 22 | 通过 | `FDN-RULES-CUSTOMER-FINAL` |
| `supplier` | 供应商通用信息 | 13 | SMOKE-FOUNDATION-SUPPLIER-FIELD-RULES | 14 | 通过 | `FDN-RULES-SUPPLIER-FINAL` |
| `financial-institution` | 金融机构 | 13 | SMOKE-FOUNDATION-FINANCIALINSTITUTION-FIELD-RULES | 14 | 通过 | `FDN-RULES-FINANCIALINSTITUTION-FINAL` |
| `transport-mode` | 运输方式 | 5 | SMOKE-FOUNDATION-TRANSPORTMODE-FIELD-RULES | 6 | 通过 | `FDN-RULES-TRANSPORTMODE-FINAL` |
| `project` | 项目信息 | 4 | SMOKE-FOUNDATION-PROJECT-FIELD-RULES | 5 | 通过 | `FDN-RULES-PROJECT-FINAL` |
| 合计 | — | **108** | 9 | **117** | 全部通过 | — |

执行方式：真实 Web UI 打开新增表单，采集字段状态，填入列表已有编码做唯一性探测，取消丢弃表单，不保存业务数据。

## 4. 质量门禁

| 门禁 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过 |
| `npm run build` | 通过 |
| `npm run test:unit` | 139/139 |
| `npm run test:platform` | 62/62 |
| `npm run test:contract` | 92/92 |
| `platform module --path business-modules/foundation` | 通过，0 警告 |

## 5. 证据

- 规则引擎文档：`docs/contracts/field-rule-set.md`
- 规则包：`business-modules/foundation/field-rules/`
- 用例：`business-modules/foundation/testcases/`
- 运行报告：`artifacts/FDN-RULES-*-FINAL/report.md`
- 采购保存行为：`artifacts/FDN-PO-SAVE-BLOCK-03/report.md`

## 6. 已知限制

- 跨区域联动（如“取值方式=列举 → 明细子表必填”）无法用当前字段规则表达。
- `FORMAT`、`RANGE` 已实现但基础管理规则包暂未使用。
- 采购订单提交/审核阶段的必填拦截尚未验证。
