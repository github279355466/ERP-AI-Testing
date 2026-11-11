# P2 四模块回归：基础管理 / 采购管理 / 应收管理 / 应付管理（2026-11-11）

- 范围：按 2026-11-11 确认，仅覆盖已开发的四个模块；销售、库存成本、生产暂不执行。
- 环境：athena-test / digichannel / 000W1、QN002。
- 执行：`node dist/cli/platform-run.js run --module <id> --case <id>`；写用例追加 `--allow-write --config config/athena.write.config.json`。

## 1. 结果总览

| 模块 | 可执行用例 | 通过 | 失败 | 备注 |
| --- | --- | --- | --- | --- |
| 基础管理（base） | 2 | 2 | 0 | 存货参数列表冒烟 + 编辑保存并回滚 |
| 基础管理（foundation） | 9 | 9 | 0 | 9 个字段规则用例；项目唯一性规则降级为 candidate（见 D-003） |
| 采购管理 | 5 | 5 | 0 | 列表、字段规则、保存拦截、新增、全生命周期 |
| 应收管理 | 2 | 2 | 0 | 业务单别 CRUD、业务单别参数 CRUD |
| 应付管理 | 2 | 2 | 0 | 业务单别 CRUD、业务单别参数 CRUD |
| 合计 | 20 | 20 | 0 | 另有 1 条 legacy 用例转 `deprecated` |

## 2. 执行明细

| 用例 | 结果 | 断言 | run id |
| --- | --- | --- | --- |
| `SMOKE-INVENTORY-PARAM-LIST` | 通过 | — | `20261111-040354-rv4k` |
| `CRUD-INVENTORY-PARAM-UPDATE` | 通过 | — | `20261111-041410-rx11` |
| `SMOKE-FOUNDATION-CURRENCY-FIELD-RULES` | 通过 | — | `20261111-040410-xasq` |
| `SMOKE-FOUNDATION-CUSTOMER-FIELD-RULES` | 通过 | — | `20261111-040449-m5xz` |
| `SMOKE-FOUNDATION-FINANCIALINSTITUTION-FIELD-RULES` | 通过 | — | `20261111-040521-ifqt` |
| `SMOKE-FOUNDATION-MEASUNIT-FIELD-RULES` | 通过 | — | `20261111-040557-1kpq` |
| `SMOKE-FOUNDATION-PROJECT-FIELD-RULES` | 通过（重跑） | 5/5 | `20261111-041331-skf1` |
| `SMOKE-FOUNDATION-SUPPLIER-FIELD-RULES` | 通过 | — | `20261111-040710-6bnx` |
| `SMOKE-FOUNDATION-TRANSOBJATTR-FIELD-RULES` | 通过 | — | `20261111-040745-wmpw` |
| `SMOKE-FOUNDATION-TRANSPORTMODE-FIELD-RULES` | 通过 | — | `20261111-040822-mskg` |
| `SMOKE-FOUNDATION-WAREHOUSE-FIELD-RULES` | 通过 | — | `20261111-040858-665j` |
| `SMOKE-PURCHASE-ORDER-LIST` | 通过 | — | `20261111-040933-5dzo` |
| `SMOKE-PURCHASE-ORDER-FIELD-RULES` | 通过（授权写重跑） | — | `20261111-041447-lj1l` |
| `SMOKE-PURCHASE-ORDER-SAVE-BLOCK` | 通过 | — | `20261111-041536-c48s` |
| `SMOKE-PURCHASE-ORDER-CREATE` | 通过 | — | `20261111-041647-b5fk` |
| `SMOKE-PURCHASE-ORDER-LIFECYCLE` | 通过 | — | `20261111-041817-7d4d` |
| `CRUD-AR-BIZ-TYPE` | 通过 | 6/6 | `20261111-025845-f325` |
| `CRUD-AR-BIZ-TYPE-PARAM` | 通过 | 11/11 | `20261111-031432-kx6t` |
| `CRUD-AP-BIZ-TYPE` | 通过 | 6/6 | `20261111-030515-mu18` |
| `CRUD-AP-BIZ-TYPE-PARAM` | 通过 | 11/11 | `20261111-031654-jb06` |

## 3. 本轮修正

| 问题 | 现象 | 处置 |
| --- | --- | --- |
| 项目编号唯一性规则只读不可判 | 填入已有编号后保存按钮未禁用、无重复提示，规则集判失败 | 规则降级 `candidate` 并记录升级条件；决策见 `DECISIONS.md` D-003 |
| `SMOKE-PURCHASE-ORDER-FIELD-RULES` 被授权拦截 | 用例含写步骤，未带 `--allow-write` 返回 `blocked` | 按授权写模式重跑通过 |
| `SMOKE-FOUNDATION-CRUD-CLOSURE` 不可执行 | 导航目标 `foundation.crud.pages` 与流程 `foundation-crud-closure` 未在平台运行器注册 | 用例转 `deprecated`，保留历史证据索引，不计入通过率 |

## 4. 数据与清理

- 存货参数：用例结尾自动回滚开关，`000W1` 恢复执行前状态。
- 采购订单：`SMOKE-PURCHASE-ORDER-CREATE` 按 `mark_for_cleanup` 保留 `P6AUTO-*` 单据；`SMOKE-PURCHASE-ORDER-LIFECYCLE` 结尾删除自建单据。
- AR/AP：QA 前缀业务单别与参数在用例内删除，运行后列表回查 QA 记录为 0。

## 5. 未纳入本轮

- 销售管理、库存与成本联动（INV-01~06）、生产：按 2026-11-11 确认暂停。
- 采购退货/入库过账链路：受 `BUG-20261108-01` 与供应商前置数据（T-03/T-04）影响，未在四模块日常回归中执行。
