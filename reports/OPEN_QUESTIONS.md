# 待确认问题清单

生成时间：2026-11-07T08:50:37.521Z
问题总数：330

## 分布

| 维度 | 值 | 数量 |
| --- | --- | --- |
| 严重度 | MEDIUM | 28 |
| 严重度 | LOW | 282 |
| 严重度 | HIGH | 20 |
| 类别 | AMBIGUOUS_RULE | 3 |
| 类别 | MISSING_DEFINITION | 12 |
| 类别 | VERSION_CONFLICT | 20 |
| 类别 | RULE_CONFLICT | 276 |
| 类别 | BROKEN_FLOW | 19 |

## 版本冲突

| ID | 问题 | 严重度 | 影响 | 建议确认对象 | 证据 |
| --- | --- | --- | --- | --- | --- |
| OQ-55AA293D7A48 | 会计期间信息 存在多个文档版本：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7，候选最新版本为 v1.7，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 会计期间信息/_diff/会计期间信息-v1.4-to-v1.6.md (vUNKNOWN)；会计期间信息/_diff/会计期间信息-v1.6-to-v1.7.md (vUNKNOWN) |
| OQ-3222283628BB | 会计期间表 存在多个文档版本：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9，候选最新版本为 v1.9，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 会计期间表/_diff/会计期间表-v1.6-to-v1.8.md (vUNKNOWN)；会计期间表/_diff/会计期间表-v1.8-to-v1.9.md (vUNKNOWN) |
| OQ-10A0B2E17A54 | 供应商品号价格 存在多个文档版本：1.5, 1.6, 1.7，候选最新版本为 v1.7，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 供应商品号价格/_diff/供应商品号价格-v1.6-to-v1.7.md (vUNKNOWN)；供应商品号价格/_diff/供应商品号价格PRD.v1.6-条件写法体检.md (v1.6) |
| OQ-C8DFB25DB6C7 | 其他应付单 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10，候选最新版本为 v1.10，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 其他应付单/_diff/其他应付单-v1.9-to-v1.10.md (vUNKNOWN)；其他应付单/_diff/其他应付单PRD.v1.9-条件写法体检.md (v1.9) |
| OQ-82458D6034AB | 其他应收单 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5，候选最新版本为 v2.5，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 其他应收单/_diff/其他应收单-v2.4-to-v2.5.md (vUNKNOWN)；其他应收单/_diff/其他应收单PRD.v2.4-条件写法体检.md (v2.4) |
| OQ-0C4E866DBBC6 | 客户供应商关系 存在多个文档版本：1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7，候选最新版本为 v1.7，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 客户供应商关系/_diff/客户供应商关系-v1.6-to-v1.7.md (vUNKNOWN)；客户供应商关系/_history/客户供应商关系PRD.v1.1.md (v1.1) |
| OQ-807857177868 | 应付业务单别参数 存在多个文档版本：1.2, 1.3, 1.4, 1.5，候选最新版本为 v1.5，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应付业务单别参数/_diff/应付业务单别参数-v1.4-to-v1.5.md (vUNKNOWN)；应付业务单别参数/_diff/应付业务单别参数PRD.v1.4-条件写法体检.md (v1.4) |
| OQ-9FB20F008C0D | 应付单 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10，候选最新版本为 v1.10，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应付单/_diff/应付单-v1.9-to-v1.10.md (vUNKNOWN)；应付单/_diff/应付单PRD.v1.9-条件写法体检.md (v1.9) |
| OQ-9730F3F29FBF | 应付参数 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10，候选最新版本为 v1.10，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应付参数/_diff/应付参数-v1.9-to-v1.10.md (vUNKNOWN)；应付参数/_diff/应付参数PRD.v1.9-条件写法体检.md (v1.9) |
| OQ-A5DBFE1E57FC | 应付启用期间 存在多个文档版本：1.1, 1.2, 1.3, 1.4，候选最新版本为 v1.4，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应付启用期间/_diff/应付启用期间-v1.2-to-v1.3.md (vUNKNOWN)；应付启用期间/_diff/应付启用期间-v1.3-to-v1.4.md (vUNKNOWN) |
| OQ-C46CE55853F4 | 应收业务单别参数 存在多个文档版本：1.2, 1.3, 1.4, 1.5，候选最新版本为 v1.5，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应收业务单别参数/_diff/应收业务单别参数-v1.4-to-v1.5.md (vUNKNOWN)；应收业务单别参数/_diff/应收业务单别参数PRD.v1.4-条件写法体检.md (v1.4) |
| OQ-9D8191ABF15C | 应收单 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.7, 1.8, 1.9, 2.0, 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7，候选最新版本为 v2.7，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应收单/_diff/应收单-v2.6-to-v2.7.md (vUNKNOWN)；应收单/_diff/应收单PRD.v2.6-条件写法体检.md (v2.6) |
| OQ-CFC102953E9F | 应收参数 存在多个文档版本：1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10，候选最新版本为 v1.10，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应收参数/_diff/应收参数-v1.9-to-v1.10.md (vUNKNOWN)；应收参数/_diff/应收参数PRD.v1.9-条件写法体检.md (v1.9) |
| OQ-C100951CAA42 | 应收启用期间 存在多个文档版本：1.1, 1.2, 1.3, 1.4，候选最新版本为 v1.4，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 应收启用期间/_diff/应收启用期间-v1.2-to-v1.3.md (vUNKNOWN)；应收启用期间/_diff/应收启用期间-v1.3-to-v1.4.md (vUNKNOWN) |
| OQ-921402024DA6 | 结算业务单别参数 存在多个文档版本：1.2, 1.3，候选最新版本为 v1.3，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 结算业务单别参数/_diff/结算业务单别参数PRD.v1.3-条件写法体检.md (v1.3)；结算业务单别参数/_history/结算业务单别参数PRD.v1.2.md (v1.2) |
| OQ-738C46220468 | 设置核算参数 存在多个文档版本：2.4, 2.5, 2.6，候选最新版本为 v2.6，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 设置核算参数/_diff/云端漂移-DOC437087455402921984-设置核算参数PRD.v2.6.md (v2.6)；设置核算参数/_diff/设置核算参数-v2.5-to-v2.6.md (vUNKNOWN) |
| OQ-B6A97DF7250C | 询价单 存在多个文档版本：1.5, 1.7, 1.8，候选最新版本为 v1.8，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 询价单/_diff/询价单PRD.v1.7-条件写法体检.md (v1.7)；询价单/_diff/询价单PRD.v1.8-条件写法体检.md (v1.8) |
| OQ-427163C27EAC | 采购取价策略 存在多个文档版本：1.6, 1.7, 1.9，候选最新版本为 v1.9，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 采购取价策略/_diff/上云失败记录-覆盖DOC437131710750134273-2026-11-06.md (vUNKNOWN)；采购取价策略/_diff/上云核验-采购取价策略-v1.6-DOC437131710750134273.md (vUNKNOWN) |
| OQ-1D091864888C | 采购退货出库单 存在多个文档版本：1.4, 1.5, 1.6, 1.7, 1.8, 1.9, 1.10, 1.11, 1.12, 1.13, 1.14, 1.15, 1.16, 1.17, 1.18, 1.19, 1.20, 1.21, 1.22, 1.23, 1.24，候选最新版本为 v1.24，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 采购退货出库单/_diff/v1.19-条件写法体检（整改前-24条）.md (vUNKNOWN)；采购退货出库单/_diff/v1.20-云端整改清单.md (vUNKNOWN) |
| OQ-CB6546B4374A | 采购退货单 存在多个文档版本：1.8, 1.9, 1.10, 1.11，候选最新版本为 v1.11，需确认生效版本 | HIGH | 规则可能随版本变化，按旧版建模会产生过期断言 | PRD 负责人 | 采购退货单/_diff/云端漂移-DOC437334690459947009-采购退货单PRD.v1.11.md (v1.11)；采购退货单/_diff/采购退货单PRD.v1.11-条件写法体检.md (v1.11) |


## 规则冲突与重复定义

| ID | 问题 | 严重度 | 影响 | 建议确认对象 | 证据 |
| --- | --- | --- | --- | --- | --- |
| OQ-2FDB279C6DFE | biz_type_gen_info 的字段 biz_reg 在 3 份文档中存在 4 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:116；应付业务单别/应付业务单别PRD.v1.1.md:116 |
| OQ-2083B1BC2DEA | biz_type_gen_info 的字段 biz_reg 在 4 份文档中存在 4 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:116；应收业务单别/应收业务单别PRD.v1.1.md:116 |
| OQ-04C5E6425CF5 | biz_type_gen_info 的字段 biz_prop 在 3 份文档中存在 3 种不同的 VALIDATION 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:140；应收业务单别/应收业务单别PRD.v1.1.md:140 |
| OQ-B5E06F6C4C00 | biz_type_gen_info 的字段 biz_type_no 在 2 份文档中存在 2 种不同的 REQUIRED 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:164；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:56 |
| OQ-301D08407605 | biz_type_gen_info 的字段 biz_type_no 在 2 份文档中存在 4 种不同的 VALIDATION 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:164；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:56 |
| OQ-8A3A994A9C89 | biz_type_gen_info 的字段 biz_type_name 在 2 份文档中存在 2 种不同的 REQUIRED 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:188；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:80 |
| OQ-EB152DA8764D | biz_type_gen_info 的字段 biz_type_name 在 2 份文档中存在 4 种不同的 VALIDATION 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:188；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:80 |
| OQ-50862A306D5F | biz_type_gen_info 的字段 biz_type_fname 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:212；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:152 |
| OQ-780E4875515D | biz_type_gen_info 的字段 year_digit_type 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:260；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:176 |
| OQ-10C862127C6D | biz_type_gen_info 的字段 year_digit_type 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:260；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:176 |
| OQ-3FAB2100BE0A | biz_type_gen_info 的字段 year_digit_type 在 2 份文档中存在 2 种不同的 VALIDATION 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:260；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:176 |
| OQ-62347E3B870F | biz_type_gen_info 的字段 serl_digit 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:284；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:104 |
| OQ-56C1F14CD3F4 | biz_type_gen_info 的字段 serl_digit 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:284；参数与单别域/采购业务单别/DOC408422519445487617_采购业务单别_V1.5.md:104 |
| OQ-31197F04B6E3 | biz_type_gen_info 的字段 serl_digit 在 2 份文档中存在 7 种不同的 VALIDATION 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别/应付业务单别PRD.v1.1.md:284；应付业务单别/应付业务单别PRD.v1.1.md:284 |
| OQ-B9BB936EAB35 | ops_unit_calc_param 的字段 ops_unit_name 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:131；设置核算参数/设置核算参数PRD.v2.6.md:155 |
| OQ-B35336EE196D | ops_unit_calc_param 的字段 ops_unit_name 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:131；应付启用期间/应付启用期间PRD.v1.4.md:167 |
| OQ-9B8B4FF4DEAC | ops_unit_calc_param 的字段 ops_unit_name 在 2 份文档中存在 2 种不同的 API_CONTRACT 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:131；应付启用期间/应付启用期间PRD.v1.4.md:167 |
| OQ-9EDB142005DF | ops_unit_calc_param 的字段 ena_year_pay 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:191；设置核算参数/设置核算参数PRD.v2.6.md:550 |
| OQ-9933663E4B8B | ops_unit_calc_param 的字段 ena_perid_no_pay 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:215；设置核算参数/设置核算参数PRD.v2.6.md:574 |
| OQ-37434853567E | ops_unit_calc_param 的字段 ena_perid_seq_pay 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:239；设置核算参数/设置核算参数PRD.v2.6.md:598 |
| OQ-87DE3CE07D9C | ops_unit_calc_param 的字段 ena_perid_seq_pay 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:239；设置核算参数/设置核算参数PRD.v2.6.md:598 |
| OQ-73EF139FD6F3 | ops_unit_calc_param 的字段 ena_year_recev 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:191；设置核算参数/设置核算参数PRD.v2.6.md:744 |
| OQ-D60CA4AB927D | ops_unit_calc_param 的字段 ena_perid_no_recev 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:215；设置核算参数/设置核算参数PRD.v2.6.md:768 |
| OQ-A751F6B8CFA6 | ops_unit_calc_param 的字段 ena_perid_seq_recev 在 2 份文档中存在 2 种不同的 READONLY 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:239；设置核算参数/设置核算参数PRD.v2.6.md:792 |
| OQ-00F0BB705CEA | ops_unit_calc_param 的字段 ena_perid_seq_recev 在 2 份文档中存在 2 种不同的 DEFAULT_VALUE 描述，需确认以哪份为准 | MEDIUM | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:239；设置核算参数/设置核算参数PRD.v2.6.md:792 |
| OQ-79841A446E72 | acctg_perid_info 的字段 begin_date 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 会计期间信息/会计期间信息PRD.v1.7.md:203；会计期间信息/会计期间信息PRD.v1.7.md:203 |
| OQ-115B653D8F67 | acctg_perid_info 的字段 end_date 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 会计期间信息/会计期间信息PRD.v1.7.md:324；会计期间信息/会计期间信息PRD.v1.7.md:324 |
| OQ-83355B40DEB7 | supp_item_price 的字段 ops_unit_no 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:146；供应商品号价格/供应商品号价格PRD.v1.7.md:146 |
| OQ-B417FB8946F5 | supp_item_price 的字段 ops_unit_name 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:170；供应商品号价格/供应商品号价格PRD.v1.7.md:170 |
| OQ-B2864705ED44 | supp_item_price 的字段 intax_flag 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:386；供应商品号价格/供应商品号价格PRD.v1.7.md:386 |
| OQ-587BD4336BE0 | supp_item_price 的字段 price 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:409；供应商品号价格/供应商品号价格PRD.v1.7.md:409 |
| OQ-A4917E434C93 | supp_item_price 的字段 price 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:409；供应商品号价格/供应商品号价格PRD.v1.7.md:409 |
| OQ-EC9062985B01 | supp_item_price 的字段 wtbsd_prc 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:433；供应商品号价格/供应商品号价格PRD.v1.7.md:433 |
| OQ-17E737EF060B | supp_item_price 的字段 eff_date 在同一文档内有 2 种 UNIQUENESS 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:457；供应商品号价格/供应商品号价格PRD.v1.7.md:457 |
| OQ-ABADE24530C5 | supp_item_price 的字段 tax_no 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:529；供应商品号价格/供应商品号价格PRD.v1.7.md:529 |
| OQ-B95427FBF88F | supp_item_price 的字段 step_begin_qty 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 供应商品号价格/供应商品号价格PRD.v1.7.md:627；供应商品号价格/供应商品号价格PRD.v1.7.md:627 |
| OQ-E09D127887E6 | other_recev_doc 的字段 biz_prop 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:247；其他应收单/其他应收单PRD.v2.5.md:247 |
| OQ-A9833BAFE6F4 | other_recev_doc 的字段 doc_no 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:295；其他应收单/其他应收单PRD.v2.5.md:295 |
| OQ-53B151167E3A | other_recev_doc 的字段 verf_mode 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:343；其他应收单/其他应收单PRD.v2.5.md:343 |
| OQ-FB140143B51C | other_recev_doc 的字段 bk_date 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:727；其他应收单/其他应收单PRD.v2.5.md:727 |
| OQ-B25B5D173470 | other_recev_doc 的字段 bk_date 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:727；其他应收单/其他应收单PRD.v2.5.md:727 |
| OQ-764B7C4624D7 | other_recev_doc 的字段 addl_stlmt_exp_amt_tc 在同一文档内有 2 种 HIDDEN 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:1041；其他应收单/其他应收单PRD.v2.5.md:1041 |
| OQ-92A4A51F88F3 | other_recev_doc 的字段 addl_stlmt_exp_amt_fc 在同一文档内有 2 种 HIDDEN 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 其他应收单/其他应收单PRD.v2.5.md:1065；其他应收单/其他应收单PRD.v2.5.md:1065 |
| OQ-F582C46504CF | cust_supp_rela 的字段 ops_unit_no 在同一文档内有 3 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 客户供应商关系/客户供应商关系PRD.v1.7.md:110；客户供应商关系/客户供应商关系PRD.v1.7.md:110 |
| OQ-CC86C0EB9806 | cust_supp_rela 的字段 ops_unit_name 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 客户供应商关系/客户供应商关系PRD.v1.7.md:134；客户供应商关系/客户供应商关系PRD.v1.7.md:134 |
| OQ-3356A7AE9720 | cust_supp_rela 的字段 cust_no 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 客户供应商关系/客户供应商关系PRD.v1.7.md:158；客户供应商关系/客户供应商关系PRD.v1.7.md:158 |
| OQ-B18EAAB91622 | cust_supp_rela 的字段 supp_no 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 客户供应商关系/客户供应商关系PRD.v1.7.md:206；客户供应商关系/客户供应商关系PRD.v1.7.md:206 |
| OQ-5170E7DEE784 | biz_type_ap_param 的字段 verf_mode 在同一文档内有 2 种 DISABLED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别参数/应付业务单别参数PRD.v1.5.md:258；应付业务单别参数/应付业务单别参数PRD.v1.5.md:258 |
| OQ-678A995B5381 | biz_type_ap_param 的字段 cash_stlmt_flag 在同一文档内有 2 种 DISABLED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付业务单别参数/应付业务单别参数PRD.v1.5.md:306；应付业务单别参数/应付业务单别参数PRD.v1.5.md:306 |
| OQ-10A4291333A3 | pay_doc 的字段 biz_type_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:227；应付单/应付单PRD.v1.10.md:227 |
| OQ-8C0EBEA2A013 | pay_doc 的字段 doc_no 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:251；应付单/应付单PRD.v1.10.md:251 |
| OQ-6CE3E6FFFA2E | pay_doc 的字段 resp_pers_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:563；应付单/应付单PRD.v1.10.md:563 |
| OQ-FCB2460B24F0 | pay_doc 的字段 resp_dept_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:611；应付单/应付单PRD.v1.10.md:611 |
| OQ-12FD8189C5E8 | pay_doc 的字段 ccy_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:659；应付单/应付单PRD.v1.10.md:659 |
| OQ-B0EC4317A840 | pay_doc 的字段 pmt_terms_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:731；应付单/应付单PRD.v1.10.md:731 |
| OQ-FE8B01AA094C | pay_doc 的字段 tax_inv_categ_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:827；应付单/应付单PRD.v1.10.md:827 |
| OQ-68F10E44D95E | pay_doc 的字段 bk_date 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:1091；应付单/应付单PRD.v1.10.md:1091 |
| OQ-2AB24465CAB7 | pay_doc 的字段 bk_date 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:1091；应付单/应付单PRD.v1.10.md:1091 |
| OQ-C57D31606565 | pay_doc 的字段 proj_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:1359；应付单/应付单PRD.v1.10.md:1359 |
| OQ-80B3F2A0CEB9 | pay_doc 的字段 pur_ops_unit_name 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:1407；应付单/应付单PRD.v1.10.md:1407 |
| OQ-55EAD49E0038 | ops_unit_calc_param 的字段 ops_unit_no 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:107；应付参数/应付参数PRD.v1.10.md:107 |
| OQ-88E55544F8D9 | ops_unit_calc_param 的字段 price_invnt_adj_biz_type 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:227；应付参数/应付参数PRD.v1.10.md:227 |
| OQ-80CC9006F0F1 | ops_unit_calc_param 的字段 exp_alloc_invnt_adj_biz_type 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付参数/应付参数PRD.v1.10.md:275；应付参数/应付参数PRD.v1.10.md:275 |
| OQ-E3BECFE7D9A4 | ops_unit_calc_param 的字段 ena_year_pay 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:191；应付启用期间/应付启用期间PRD.v1.4.md:191 |
| OQ-2A487C06EAFB | ops_unit_calc_param 的字段 ena_perid_no_pay 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应付启用期间/应付启用期间PRD.v1.4.md:215；应付启用期间/应付启用期间PRD.v1.4.md:215 |
| OQ-8BA96CA49D0B | biz_type_ar_param 的字段 verf_mode 在同一文档内有 2 种 DISABLED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收业务单别参数/应收业务单别参数PRD.v1.5.md:258；应收业务单别参数/应收业务单别参数PRD.v1.5.md:258 |
| OQ-8F7BAE662DA1 | biz_type_ar_param 的字段 cash_stlmt_flag 在同一文档内有 2 种 DISABLED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收业务单别参数/应收业务单别参数PRD.v1.5.md:306；应收业务单别参数/应收业务单别参数PRD.v1.5.md:306 |
| OQ-018BBB5B20E9 | recev_doc 的字段 doc_no 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:283；应收单/应收单PRD.v2.7.md:283 |
| OQ-FF96DBE48063 | recev_doc 的字段 verf_mode 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:331；应收单/应收单PRD.v2.7.md:331 |
| OQ-1ED895C1A47B | recev_doc 的字段 stlmt_cust_name 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:379；应收单/应收单PRD.v2.7.md:379 |
| OQ-2DEDF6953DA0 | recev_doc 的字段 sales_cust_name 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:427；应收单/应收单PRD.v2.7.md:427 |
| OQ-951E19061204 | recev_doc 的字段 recev_biz_prop 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:475；应收单/应收单PRD.v2.7.md:475 |
| OQ-3B269CA7A4C0 | recev_doc 的字段 recev_biz_type 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:499；应收单/应收单PRD.v2.7.md:499 |
| OQ-D38322620DFD | recev_doc 的字段 recev_dtl_biz_type 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:523；应收单/应收单PRD.v2.7.md:523 |
| OQ-42603B896A81 | recev_doc 的字段 tax_rate 在同一文档内有 2 种 HIDDEN 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:906；应收单/应收单PRD.v2.7.md:906 |
| OQ-F42E6712A8AF | recev_doc 的字段 bk_date 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:1096；应收单/应收单PRD.v2.7.md:1096 |
| OQ-234204CA7C64 | recev_doc 的字段 bk_date 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:1096；应收单/应收单PRD.v2.7.md:1096 |
| OQ-7446AE130A3C | recev_doc 的字段 tax_inv_dirct 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:1263；应收单/应收单PRD.v2.7.md:1263 |
| OQ-B3750E556EE2 | recev_doc 的字段 tax_calc_mode 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:1504；应收单/应收单PRD.v2.7.md:1504 |
| OQ-6559BB94FC63 | recev_doc 的字段 uni_tax_rate_flag 在同一文档内有 2 种 HIDDEN 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:1717；应收单/应收单PRD.v2.7.md:1717 |
| OQ-00522F3E7759 | ops_unit_calc_param 的字段 ena_year_recev 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:191；应收启用期间/应收启用期间PRD.v1.4.md:191 |
| OQ-017700956671 | ops_unit_calc_param 的字段 ena_perid_no_recev 在同一文档内有 2 种 REQUIRED 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 应收启用期间/应收启用期间PRD.v1.4.md:215；应收启用期间/应收启用期间PRD.v1.4.md:215 |
| OQ-0F404E149FBF | code_rule 的字段 code_rule_no 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 批号编号规则/批号编号规则PRD.v1.5.md:92；批号编号规则/批号编号规则PRD.v1.5.md:92 |
| OQ-9DE1979C478D | code_rule 的字段 date_code_basis 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 批号编号规则/批号编号规则PRD.v1.5.md:284；批号编号规则/批号编号规则PRD.v1.5.md:284 |
| OQ-EBB4A9AC0737 | code_rule 的字段 year_digit_type 在同一文档内有 4 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 批号编号规则/批号编号规则PRD.v1.5.md:308；批号编号规则/批号编号规则PRD.v1.5.md:308 |
| OQ-22FB5EEC6D5A | code_rule 的字段 serl_digit 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 批号编号规则/批号编号规则PRD.v1.5.md:332；批号编号规则/批号编号规则PRD.v1.5.md:332 |
| OQ-88189E7B8C13 | code_rule 的字段 code_type 在同一文档内有 2 种 HIDDEN 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 批号编号规则/批号编号规则PRD.v1.5.md:356；批号编号规则/批号编号规则PRD.v1.5.md:356 |
| OQ-97AE29095D4B | ops_unit_calc_param 的字段 fc 在同一文档内有 2 种 API_CONTRACT 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:179；设置核算参数/设置核算参数PRD.v2.6.md:179 |
| OQ-270761290A99 | ops_unit_calc_param 的字段 acctg_perid_table_no 在同一文档内有 3 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:203；设置核算参数/设置核算参数PRD.v2.6.md:203 |
| OQ-3C6DA3CE088E | ops_unit_calc_param 的字段 ccy_er_table_no 在同一文档内有 2 种 VALIDATION 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:227；设置核算参数/设置核算参数PRD.v2.6.md:227 |
| OQ-BF44B08C507C | ops_unit_calc_param 的字段 ena_year_invnt 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:356；设置核算参数/设置核算参数PRD.v2.6.md:356 |
| OQ-6BCDC33065AC | ops_unit_calc_param 的字段 ena_perid_no_invnt 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:380；设置核算参数/设置核算参数PRD.v2.6.md:380 |
| OQ-E3641CC756D4 | ops_unit_calc_param 的字段 ena_use_perid_seq_no_invnt 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:404；设置核算参数/设置核算参数PRD.v2.6.md:404 |
| OQ-F91A74A2296B | ops_unit_calc_param 的字段 curr_perid_seq_invnt 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:476；设置核算参数/设置核算参数PRD.v2.6.md:476 |
| OQ-A5761CA228BD | ops_unit_calc_param 的字段 date_range_end_invnt 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:524；设置核算参数/设置核算参数PRD.v2.6.md:524 |
| OQ-10719E50355D | ops_unit_calc_param 的字段 curr_year_pay 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:622；设置核算参数/设置核算参数PRD.v2.6.md:622 |
| OQ-06321F0B01EE | ops_unit_calc_param 的字段 curr_perid_no_pay 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:646；设置核算参数/设置核算参数PRD.v2.6.md:646 |
| OQ-313FA46678E9 | ops_unit_calc_param 的字段 curr_perid_seq_pay 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:670；设置核算参数/设置核算参数PRD.v2.6.md:670 |
| OQ-8473F0BDDC43 | ops_unit_calc_param 的字段 date_range_end_pay 在同一文档内有 2 种 DEFAULT_VALUE 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:718；设置核算参数/设置核算参数PRD.v2.6.md:718 |
| OQ-D4B915504ADB | ops_unit_calc_param 的字段 curr_year_recev 在同一文档内有 2 种 READONLY 表述，需确认是否等价 | LOW | 同一字段同一类型规则存在冲突定义，断言口径不确定 | PRD 负责人 | 设置核算参数/设置核算参数PRD.v2.6.md:816；设置核算参数/设置核算参数PRD.v2.6.md:816 |

> 仅显示前 100 条，共 276 条；完整清单见 artifacts/knowledge/open-questions.json。

## 缺失与歧义

| ID | 问题 | 严重度 | 影响 | 建议确认对象 | 证据 |
| --- | --- | --- | --- | --- | --- |
| OQ-D3A84AD8E610 | 规则描述含待确认表述：运营单元编号 只读 | MEDIUM | 无法直接生成可执行断言 | PRD 作者 / 业务 | 客户供应商关系/_history/客户供应商关系PRD.v1.1.md:107 |
| OQ-FA1624E33081 | 规则描述含待确认表述：删除 前置校验 | MEDIUM | 无法直接生成可执行断言 | PRD 作者 / 业务 | 客户供应商关系/_history/客户供应商关系PRD.v1.1.md:343 |
| OQ-E3360DF2000B | 规则描述含待确认表述：失效 前置校验 | MEDIUM | 无法直接生成可执行断言 | PRD 作者 / 业务 | 客户供应商关系/_history/客户供应商关系PRD.v1.1.md:363 |
| OQ-113856842FF4 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.14.payload.json |
| OQ-667DF471738A | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.14.payload.json |
| OQ-E600BC2D1860 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.14.prd_spec.json |
| OQ-6B1C85859E19 | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.14.prd_spec.json |
| OQ-E818F1434BC5 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.15.payload.json |
| OQ-7C6961903E31 | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.15.payload.json |
| OQ-2F8B2CDC6FF3 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.15.prd_spec.json |
| OQ-9BF94FC46420 | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.15.prd_spec.json |
| OQ-A2D7FE28BAA3 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.18.payload.json |
| OQ-EC5465CB569A | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.18.payload.json |
| OQ-DDD27E4A5461 | 字段码 rmk 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.18.prd_spec.json |
| OQ-1D57D4A3A83D | 字段码 pcs 在同一文档出现 2 次，需确认是否属于不同页签或子对象 | LOW | 字段定位可能歧义 | PRD 作者 | 采购退货出库单/_upload/采购退货出库单-新版-v1.18.prd_spec.json |


## 流程断链

| ID | 问题 | 严重度 | 影响 | 建议确认对象 | 证据 |
| --- | --- | --- | --- | --- | --- |
| OQ-3B3FE3F21B28 | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 四单PRD-第2轮修订审查报告.md:33；四单PRD-第2轮修订审查报告.md:35 |
| OQ-67242EAA9F1A | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.4.md:2830；应付单/_history/应付单PRD.v1.4.md:2903 |
| OQ-28103EC7A6D2 | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.5.md:2831；应付单/_history/应付单PRD.v1.5.md:2904 |
| OQ-48A184AD8210 | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.6.md:2832；应付单/_history/应付单PRD.v1.6.md:2905 |
| OQ-E2931702DB7C | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.7.md:2833；应付单/_history/应付单PRD.v1.7.md:2906 |
| OQ-7FA5E9AAE885 | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.8.md:2834；应付单/_history/应付单PRD.v1.8.md:2907 |
| OQ-4357B42B2DD7 | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/_history/应付单PRD.v1.9.md:2835；应付单/_history/应付单PRD.v1.9.md:2908 |
| OQ-D154CA20964B | 文档引用了未建模的上下游对象：pur_stkin_doc_001, pur_stkin_doc_d, p_ops_unit_no, p_supp_no, p_doc_date_from | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应付单/应付单PRD.v1.10.md:2836；应付单/应付单PRD.v1.10.md:2909 |
| OQ-4F42B1DE7F60 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v1.8.md:2863；应收单/_history/应收单PRD.v1.8.md:2863 |
| OQ-315DEE777094 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v1.9.md:2864；应收单/_history/应收单PRD.v1.9.md:2864 |
| OQ-338DD92C2528 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.0.md:2865；应收单/_history/应收单PRD.v2.0.md:2865 |
| OQ-C124EAC92112 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.1.md:2866；应收单/_history/应收单PRD.v2.1.md:2866 |
| OQ-7EE88840E245 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.2.md:2867；应收单/_history/应收单PRD.v2.2.md:2867 |
| OQ-F47DC5084AF6 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.3.md:2868；应收单/_history/应收单PRD.v2.3.md:2868 |
| OQ-3A4D37EE12C4 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.4.md:2869；应收单/_history/应收单PRD.v2.4.md:2869 |
| OQ-B2CA92379515 | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.5.md:2870；应收单/_history/应收单PRD.v2.5.md:2870 |
| OQ-EEB4007EDA4F | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/_history/应收单PRD.v2.6.md:2871；应收单/_history/应收单PRD.v2.6.md:2871 |
| OQ-60BBD6C9819D | 文档引用了未建模的上下游对象：src_data_check, lnkg_calc | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 应收单/应收单PRD.v2.7.md:2872；应收单/应收单PRD.v2.7.md:2872 |
| OQ-E8DC67C514A5 | 文档引用了未建模的上下游对象：eff_end_date, alr_rtn_prc_qty, alr_rtn_invnt_qty | LOW | 上下游链路不完整，流程类场景可能缺前置条件 | PRD 负责人 | 采购退货出库单/_diff/v1.20-开发改动清单.md:180；采购退货出库单/_diff/v1.20-开发改动清单.md:186 |


## 解析与格式问题

无
