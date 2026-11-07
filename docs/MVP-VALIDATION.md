# MVP 验证报告

日期：2026-11-06　环境：`athena-test`（租户 `digichannel`）
模式：Chrome CDP 接管（`127.0.0.1:9333`）+ 代理 `127.0.0.1:10808`

## 1. 验收结果

| # | 验收项 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 连接现有 Chrome | 通过 | `doctor` → `Chrome/151.0.7922.34`，CDP 连接正常 |
| 2 | 读取当前 ERP 页面 | 通过 | 识别门户与业务页两个 page，标题、URL、结构可读 |
| 3 | 采集 DOM 与截图 | 通过 | `artifacts/20261106-034129-rska/dom/explore.html`、`shots/explore.png` |
| 4 | 识别页面基本控件 | 通过 | 列表 9 行 / 7 列；详情 3 个字段识别为 LOOKUP / SWITCH / DROPDOWN |
| 5 | 执行只读断言 | 通过 | `TC-INV-READONLY` 4 条断言全部通过 |
| 6 | 生成测试报告 | 通过 | `artifacts/20261106-040520-4grw/report.md`、`report.html` |

## 2. 实际执行

### 2.1 环境自检

```bash
npm run athena -- doctor
```

输出要点：

```
config   ok   mode=cdp, baseUrl=https://athena-test.digiwincloud.com.cn/
cdp      ok   Chrome/151.0.7922.34
knowledge ok  2 pages, 6 rules
browser  ok  portal:... | business:.../list
```

### 2.2 列表页探索

```bash
npm run athena -- explore --id invnt-param --workItemCode DTBBArnXZHrt --entity ops_unit_invnt_param
```

- 页面：`存货参数`，9 行数据，7 列。
- 生成：`snapshot.json`、`candidate-page.json`、截图、DOM、请求日志。
- URL 中的 `token` 已脱敏为 `<redacted>`。

### 2.3 详情表单探索

```bash
npm run athena -- explore --id invnt-param --detail
```

- 打开「查看」后识别 3 个可见字段：
  - `ops_unit_invnt_param.ops_unit_no` → LOOKUP（运营单元）
  - `ops_unit_invnt_param.is_ena_proj_mgmt` → SWITCH（启用项目管理）
  - `ops_unit_invnt_param.aprv_date_basis` → DROPDOWN（审核日依据）
- 结束自动关闭详情页签，未保存任何内容。

### 2.4 只读用例

```bash
npm run athena -- verify --case cases/invnt-param-readonly.json
```

步骤与断言：

| 步骤 | 结果 |
| --- | --- |
| 点击「查看」打开详情 | ok |
| 等待表单渲染 | ok |
| 运营单元控件类型 = LOOKUP | PASS |
| 审核日依据控件类型 = DROPDOWN | PASS |
| 启用项目管理控件类型 = SWITCH | PASS |
| 运营单元取值包含「玄鸟公司」 | PASS（实际 `玄鸟公司（000W1）`） |
| 截图 / 关闭页签 | ok |

用例状态：`passed`，4 条断言，耗时约 7s。

## 3. 自动化测试结果

```bash
npm run test:unit    # 33 passed
npm run test:smoke   # 1 passed（CDP 真实浏览器）
```

单元测试覆盖：配置解析、页面匹配、控件分类、安全策略、断言引擎、知识库校验、报告渲染、脱敏、候选元数据生成。

冒烟测试覆盖：CDP 接管、业务页选择、列表数据行与列 ID 校验。

## 4. 关键实现验证点

1. **CDP 不误关浏览器**：`disconnect()` 为空实现，进程退出即断开。
2. **字段锚点稳定**：`label[for="<entity>.<field>"]` 在详情态与列表态都能唯一定位。
3. **只读策略生效**：`click` 命中「保存/删除/审核」等词直接拒绝（单测覆盖）。
4. **状态复位幂等**：重复点击已激活「列表」页签会造成空查询，框架已改为仅在非激活时切换。
5. **证据脱敏**：截图 + DOM + 请求日志落盘前统一替换敏感字段。

## 5. 未完成能力

| 能力 | 状态 | 说明 |
| --- | --- | --- |
| Markdown 测试计划解析 | 未实现 | `athena-erp-test-plans` 的 72 份计划尚未接入 |
| 批量调度与断点续跑 | 未实现 | 当前一次只跑一个用例 |
| 写入型用例（新增/修改/删除/审核） | 未实现 | 需专项授权与数据清理方案 |
| 基础资料选择器确认回写 | 未实现 | 只读阶段仅打开、读取、取消 |
| 编辑态字段联动验证 | 未实现 | 需在授权后进入编辑态 |
| 无头回归登录态管理 | 部分 | 已支持 storageState，未做自动续期 |
| 其余 71 个作业页面知识 | 未开始 | 仅有菜单名，标 UNKNOWN |

## 6. 数据安全声明

- 全程只读：未新增、修改、删除、审核任何 ERP 业务数据。
- 页面状态复位（关闭页签、切回列表）不产生业务写入。
- 未保存账号口令；所有产物中的 token 已脱敏。
- 「存货参数」列表仍为 9 条，未发生变化。
