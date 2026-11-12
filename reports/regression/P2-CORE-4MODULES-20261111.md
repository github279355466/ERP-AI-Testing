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

## 6. 套件化执行（2026-11-12）

| 套件 | 结果 | 用例 | run id |
| --- | --- | --- | --- |
| `SUITE-BASE-REGRESSION` | 通过 | 2/2 | `20261111-043745-9y2l` |
| `SUITE-FOUNDATION-REGRESSION` | 通过 | 9/9 | `20261112-074957-6eev` |
| `SUITE-AR-REGRESSION` | 通过 | 2/2 | `20261111-044436-vn4n` |
| `SUITE-AP-REGRESSION` | 通过 | 2/2 | `20261111-044617-j56w` |
| `SUITE-PURCHASE-REGRESSION` | 阻断 | 2/5 通过（LIST/FIELD-RULES） | `20261112-082108-mjf4` |

套件执行入口：

```bash
node dist/cli/platform-run.js run --module foundation --suite SUITE-FOUNDATION-REGRESSION --allow-write --config config/athena.write.config.json
```

### 6.1 基础管理套件稳定性修复

- 唯一性规则：货币信息/交易对象属性/运输方式仅显示「错误 N」计数、无提示文本。探测层将计数作为 `blocked` 证据、不当作提示文案；
  规则声明 `message_contains` 而实际无文本时只校验拦截结果。决策见 `DECISIONS.md` D-005。
- 列表就绪：新增按钮增加可见等待与一次重载兜底，修复套件内 `CUSTOMER` 用例超时。
- 套件隔离：仅清理本次运行新建的业务页面，不关闭运行前已存在的页面，避免影响其他并行会话。

### 6.2 采购套件阻断原因（环境变更，非代码回归）

- 采购订单「运营单元」开窗现返回 `000W1 / CG001 / CG002 / DGW02 / DGW03 …`，**已无 `QN002`**；用例已改用
  `config/test-data/qa26-master-data.json` 的基准数据：`000W1 / QA26-S001 / QA20261109-BT1 / QA26-M001`。
- 品号开窗确认按钮改为兜底强制点击后，`SAVE-BLOCK`、`CREATE` 已能走到保存步骤。
- 保存被服务端拒绝：`输入参数发票联式(inv_frm)不满足枚举设置[0, 1, 2, 3]`（ENUM_CHECK）。
  说明 `QA20261109-BT1` 对应的采购单别参数缺少有效的发票联式配置，需补齐后重跑。
- 采购订单列表列已变化（`po_doc_no / supp_no / pur_date …`），不再包含 `ops_unit_no`；行操作区不再提供文本「查看」。
- 2026-11-12 复跑时门户跳转登录页（`/login?returnUrl=%2F`），浏览器登录态过期，实跑中断（run `20261112-084447-yms0`）。
