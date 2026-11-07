# 覆盖率矩阵

生成时间：2026-11-07T15:06:32.572Z

## 一、总览

| 指标 | 数值 |
| --- | --- |
| 规则总数（最新版文档） | 4050 |
| 规则总数（含历史版本） | 26498 |
| 场景草案数 | 3703 |
| 已有用例可匹配的规则数 | 830 |
| 规则覆盖率（按已有用例） | 20.5% |
| 已有用例总数 | 1477 |
| 可匹配到规则的用例 | 584 |
| 用例匹配率 | 39.5% |
| 未能匹配到规则的用例 | 893 |

说明：规则覆盖率按「对象字段 + 规则类型」与测试用例库做语义匹配，不是规则 ID 直接对应；匹配结果用于发现缺口，不作为用例正确性证据。

## 二、按规则类型

| rule_type | 规则数 | 场景数 | 已有用例覆盖 | 覆盖率 |
| --- | --- | --- | --- | --- |
| API_CONTRACT | 377 | 293 | 0 | 0.0% |
| CALCULATION | 11 | 10 | 0 | 0.0% |
| DEFAULT_VALUE | 887 | 880 | 44 | 5.0% |
| DISABLED | 23 | 23 | 7 | 30.4% |
| HIDDEN | 275 | 274 | 124 | 45.1% |
| LINKAGE | 62 | 46 | 0 | 0.0% |
| LOOKUP | 249 | 249 | 136 | 54.6% |
| PERMISSION | 260 | 250 | 0 | 0.0% |
| PRECISION | 7 | 7 | 0 | 0.0% |
| READONLY | 746 | 741 | 324 | 43.4% |
| REQUIRED | 436 | 402 | 154 | 35.3% |
| STATE_TRANSITION | 46 | 45 | 0 | 0.0% |
| UNIQUENESS | 71 | 56 | 0 | 0.0% |
| VALIDATION | 534 | 381 | 41 | 7.7% |
| WORKFLOW | 66 | 46 | 0 | 0.0% |

## 三、按模块

| 模块 | 规则数 | 场景数 | 已有用例覆盖 | 覆盖率 |
| --- | --- | --- | --- | --- |
| 基础资料 | 889 | 787 | 279 | 31.4% |
| 应付 | 618 | 573 | 48 | 7.8% |
| 应收 | 599 | 560 | 34 | 5.7% |
| 财务 | 296 | 271 | 13 | 4.4% |
| 采购 | 1648 | 1512 | 456 | 27.7% |

## 四、用例分类分布

| category | 用例数 |
| --- | --- |
| operation_gate | 308 |
| readonly | 286 |
| window_lookup | 190 |
| required | 181 |
| api_contract | 158 |
| hidden | 87 |
| state_transition | 82 |
| default_value | 61 |
| value_list | 42 |
| precheck | 33 |
| rounding | 26 |
| disabled | 17 |
| clear_linkage | 3 |
| input_constraint | 3 |

## 五、未匹配用例（前 50）

- TC-SUPP-0005
- TC-SUPP-0009
- TC-SUPP-0010
- TC-SUPP-0011
- TC-SUPP-0021
- TC-SUPP-0022
- TC-SUPP-0023
- TC-SUPP-0024
- TC-SUPP-0025
- TC-SUPP-0026
- TC-SUPP-0027
- TC-SUPP-0028
- TC-SUPP-0029
- TC-SUPP-0030
- TC-SUPP-0031
- TC-SUPP-0032
- TC-SUPP-0033
- TC-SUPP-0034
- TC-SUPP-0035
- TC-SUPP-0036
- TC-SUPP-0037
- TC-SIPP-0002
- TC-SIPP-0003
- TC-SIPP-0004
- TC-SIPP-0005
- TC-SIPP-0006
- TC-SIPP-0007
- TC-SIPP-0010
- TC-SIPP-0019
- TC-SIPP-0020
- TC-SIPP-0023
- TC-SIPP-0024
- TC-SIPP-0031
- TC-SIPP-0032
- TC-SIPP-0033
- TC-SIPP-0034
- TC-SIPP-0035
- TC-SIPP-0036
- TC-SIPP-0037
- TC-SIPP-0038
- TC-SIPP-0039
- TC-SIPP-0040
- TC-SIPP-0041
- TC-SIPP-0042
- TC-SIPP-0043
- TC-BZPP-0020
- TC-BZPP-0021
- TC-BZPP-0022
- TC-BZPP-0023
- TC-BZPP-0024

## 六、测试用例库与 PRD 目录对应关系

共 34 个用例作业，其中 7 个未匹配到同名 PRD 目录（按目录名粗匹配，可能存在命名差异）：

| 用例作业 | 用例数 | 说明 |
| --- | --- | --- |
| 品号存货信息 | 27 | PRD 作业目录无同名作业 |
| 品号批号信息 | 16 | PRD 作业目录无同名作业 |
| 存货业务单别 | 28 | PRD 作业目录无同名作业 |
| 存货单别参数 | 30 | PRD 作业目录无同名作业 |
| 存货成本分类 | 14 | PRD 作业目录无同名作业 |
| 维护存货会计分类 | 10 | PRD 作业目录无同名作业 |
| 通用单位换算 | 16 | PRD 作业目录无同名作业 |
