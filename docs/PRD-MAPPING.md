# PRD 关联索引

来源目录：`C:/Users/Administrator/AppData/Roaming/ade-client/ade-workspace/tenant_digichannel/solution_smbcloud/_prd_workspace/prd`
生成文件：`knowledge/athena-prd-map.json`
生成命令：`npm run athena -- prd:index`

## 1. 版本规则

- 只扫描每个作业目录顶层的 `*.md`，忽略 `_diff/`、`_history/`、`_upload/`。
- 版本按数字段比较，`v1.10` 高于 `v1.9`；`-cloud` 后缀参与识别但不影响版本号。
- 同版本多文件时取修改时间最新的一份。

## 2. 关联结果（19 个作业）

| 作业 | 最新版本 | 实体 | 字段数 | 版本数 | 测试计划 |
| --- | --- | --- | --- | --- | --- |
| 采购退货出库单 | v1.22 | pur_rtn_stkou_doc | 53 | 22 | TP-052 |
| 供应商品号价格 | v1.7 | supp_item_price | 24 | 7 | TP-039 |
| 会计期间表 | v1.6 | acctg_perid_table | 10 | 6 | TP-064 |
| 会计期间信息 | v1.4 | acctg_perid_info | 13 | 4 | TP-065 |
| 结算业务单别 | v1.1 | biz_type_gen_info | 12 | 1 | TP-068 |
| 结算业务单别参数 | v1.3 | biz_type_st_param | 9 | 3 | TP-067 |
| 客户供应商关系 | v1.7 | cust_supp_rela | 7 | 7 | TP-072 |
| 其他应付单 | v1.10 | other_pay_doc | 60 | 10 | — |
| 其他应收单 | v2.5 | other_recev_doc | 58 | 5 | — |
| 应付参数 | v1.10 | ops_unit_calc_param | 9 | 10 | TP-063 |
| 应付单 | v1.10 | pay_doc | 107 | 11 | — |
| 应付启用期间 | v1.3 | ops_unit_calc_param | 5 | 2 | TP-060 |
| 应付业务单别 | v1.1 | biz_type_gen_info | 12 | 1 | TP-061 |
| 应付业务单别参数 | v1.5 | biz_type_ap_param | 14 | 5 | TP-062 |
| 应收参数 | v1.10 | ops_unit_calc_param | 5 | 10 | TP-071 |
| 应收单 | v2.7 | recev_doc | 109 | 7 | — |
| 应收启用期间 | v1.3 | ops_unit_calc_param | 5 | 2 | TP-066 |
| 应收业务单别 | v1.1 | biz_type_gen_info | 12 | 1 | TP-069 |
| 应收业务单别参数 | v1.5 | biz_type_ar_param | 14 | 5 | TP-070 |

## 3. 未匹配测试计划

`其他应付单`、`其他应收单`、`应付单`、`应收单` 暂无对应 TP 计划。执行前需要补计划，或明确只做 PRD 阅读与规则抽取。

## 4. 已回填的页面关联

| 作业 | PRD 版本 | 页面 ID | 测试计划 |
| --- | --- | --- | --- |
| 会计期间表 | v1.6 | `acctg-perid-table` | TP-064 |
| 会计期间信息 | v1.4 | `acctg-perid-info` | TP-065 |

## 5. 使用方式

```bash
npm run athena -- prd:index
npm run athena -- prd:show --work-item 应付单
npm run athena -- prd:show --plan TP-052
npm run athena -- prd:show --page-id invnt-param
npm run athena -- prd:section --work-item 应付单 --section 2.4
```

`prd:show` 输出包含最新文件、版本、实体、章节、子章节、字段清单与关联计划。`prd:section` 按标题片段读取业务逻辑原文，不把规则正文复制进索引。PRD 只作为预期来源，业务规则仍需页面证据或业务负责人确认后才能升为 `confirmed`。
