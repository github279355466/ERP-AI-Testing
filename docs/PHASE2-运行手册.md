# Phase 2 运行手册

## 1. 前置条件

- 非生产环境：athena-test.digiwincloud.com.cn（environment.type=test）。
- Node.js 与项目依赖已安装：npm install。
- Chrome 开启 CDP：默认 http://127.0.0.1:9333。
- 已登录 ERP 测试账号，或设置 ERP_LOGIN_STRATEGY=form 由脚本表单登录。
- 首次运行前执行 npm run build。

## 2. 环境变量

```powershell
$env:ALLOW_ERP_UI_TEST='true'
$env:ERP_LOGIN_STRATEGY='form'
$env:ERP_USERNAME='<账号>'
$env:ERP_PASSWORD='<口令>'
```

凭据只通过环境变量传入，禁止写入配置文件、代码、日志或报告。

## 3. 启动浏览器

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/start-chrome.ps1 -DisableWebSecurity
```

门户菜单接口存在 CORS 限制，需要 -DisableWebSecurity；Chrome 重启后 sessionStorage 登录态丢失，使用 form 策略重新登录。

## 4. 只读自检

```powershell
npm run athena -- doctor --connect --config config/athena.write.config.json
npm run athena -- session:check --config config/athena.write.config.json
npm run athena -- nav --page purchase-order --fresh --config config/athena.write.config.json
npm run athena -- nav --page purchase-arrival --config config/athena.write.config.json
npm run athena -- nav --page purchase-inbound --config config/athena.write.config.json
npm run athena -- nav --page purchase-return --config config/athena.write.config.json
npm run athena -- nav --page purchase-return-outbound --config config/athena.write.config.json
```

## 5. 采购订单

```powershell
node dist/cli/main.js create-po --config config/athena.write.config.json `
  --ops-unit QN002 --supplier GN-JD-001 --biz-type PO0501 `
  --item 01-2-00011 --qty 2 --price 10 --project 001
```

提交与审核：

```powershell
node dist/cli/main.js submit-audit --config config/athena.write.config.json --doc PO0501-2026110800002 --page purchase-order
```

## 6. 采购到货单

```powershell
node dist/cli/main.js create-arrival --config config/athena.write.config.json `
  --ops-unit QN002 --supplier GN-JD-001 --biz-type PO0602 `
  --source PO0501-2026110800002 --item 01-2-00011 --qty 2
```

```powershell
node dist/cli/main.js submit-audit-arrival --config config/athena.write.config.json --doc PO0602-2611080001
```

## 7. 采购入库单

```powershell
node dist/cli/main.js create-inbound --config config/athena.write.config.json `
  --ops-unit QN002 --supplier GN-JD-001 --biz-type IM0301 `
  --source PO0602-2611080001 --item 01-2-00011 --qty 2 --warehouse 00CP
```

```powershell
node dist/cli/main.js submit-audit-inbound --config config/athena.write.config.json --doc IM0301-2026110800002
```

## 8. 采购退货单

```powershell
node dist/cli/main.js create-return --config config/athena.write.config.json `
  --ops-unit QN002 --supplier GN-JD-001 --biz-type PO1102 `
  --doc-no P2RTN-20261108-04 --purchaser wuyy@digiwin.com --project 001 `
  --source PO0501-2026110800001 --item 01-2-00011 --qty 2 --warehouse 00CP
```

```powershell
node dist/cli/main.js submit-audit-return --config config/athena.write.config.json --doc P2RTN-20261108-04
```

说明：当前环境审核退货单会触发采购退货出库单创建，B1 未解除前会返回供应商校验错误；单据会停留在审核中。

## 9. 证据与产物

- 每次运行生成 artifacts/<runId>/。
- 关键文件：manifest.json、shots/、dom/、traces/、logs/、<case>-diagnostics.json。
- 创建的单据登记在 manifest.createdDocuments。
- 失败时自动截图、DOM、console、request 与 Trace；状态写 blocked/failed。

## 10. 常见问题

| 现象 | 处理 |
| --- | --- |
| CDP 拒绝连接 | 用 scripts/start-chrome.ps1 以 9333 端口启动 Chrome |
| 列表空白 | resetToList / ensureListState 会强制重载；确认详情页签已关闭 |
| 开窗无数据 | 检查筛选字段名与运营单元、供应商、单别组合 |
| 保存按钮禁用 | 打开左下角“错误列表”，读取前端校验项 |
| 仓库/储位必填 | 明细仓库选 00CP 等未启用储位管理的仓库 |
| 列不可见 | 点击明细工具栏齿轮，搜索字段并勾选；再横向滚动到目标列 |
| 单号已存在 | 手工单别需更换单号；自动编码单别不要填写单号 |

## 11. 采购退货与出库补充说明

- 到货单的“发票类型”位于“财务信息”页签；create-arrival 会自动切换页签并选择“增值税专用发票”。
- 采购退货单审核会触发采购退货出库单自动生成。
- 当前环境 IM0402 为手工编码，自动生成接口未传单号，审核会失败；出库单手工“取单-开窗”对未审核/审核中退货单返回 0 条。
- 详细 bug 与复现步骤见 artifacts/phase2/acceptance/P2.4-DIRECTION-BUGS.md。

## 12. 退货出库排查手册（2026-11-08 复测）

### 12.1 单号必填错误的定位链

退货单审核由服务端自动生成并过账出库单，单号规则来自两跳配置：

1. 采购单别参数：按（运营单元 + 退货单别）查，例如 QN002 + PO1102。
2. 该参数明细行的“归属单别”即自动生成的出库单别，例如 采购退货出库(IM0402)。
3. 存货业务单别中查 IM0402 的“编码方式”；自动生成场景必须为自动编码（如“年月日+流水码”）。

### 12.2 当前错误与判定

- 单号必填错误已消除，IM0402 现为“年月日+流水码”、状态生效。
- 新报错：「调用API：bm.pur_rtn_stkou_doc.post出错，错误信息：库存数量不足！」。
- 排查顺序建议：
  1. 用“品号存货信息”确认品号在目标运营单元的主要仓库；
  2. 用“仓库信息”确认仓库属于同一运营单元、储位管理是否启用；
  3. 用入库单明细确认实际入库仓库、数量、批号、储位；
  4. 对比退货单明细的仓库/批号/储位是否与库存维度一致。

### 12.3 储位管理仓的注意事项

- 仓库“储位管理=启用”（如 QN002/C001 原料仓）时，入库单明细的“储位”必填，否则保存按钮禁用。
- 储位选择器是下拉网格，不是标准开窗对话框，现有自动化 `setGridLookup` 会等待开窗超时；需先补适配器或改走储位不启用的仓库（如 00CP）。

## 13. 相关文档

| 用途 | 路径 |
| --- | --- |
| 缺陷单（入库未过账，阻断退货出库） | `docs/defects/BUG-20261108-01-采购入库单审核未过账.md` |
| 字段级规则校验要求（平台升级后执行） | `docs/PHASE3-字段规则校验要求.md` |
| 待办与阻塞项 | `docs/TODO.md`（T-04～T-07） |
| 方向性 Bug 与证据（本地，不入 Git） | `artifacts/phase2/acceptance/P2.4-DIRECTION-BUGS.md` |
