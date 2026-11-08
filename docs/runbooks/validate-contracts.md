# 运行手册：契约校验

## 1. 构建

```powershell
npm install
npm run build
```

## 2. 全量校验

```powershell
npm run platform:validate
```

校验范围：

- `platform/contracts/examples/` 示例
- `platform/contracts/action-registry.json`
- `business-modules/_template`、`business-modules/purchase`
- `integration-tests/_template`、`integration-tests/purchase-to-ap`

## 3. 单模块/单集成包

```powershell
npm run platform:module -- business-modules/purchase
npm run platform:integration -- integration-tests/purchase-to-ap
```

## 4. 单文件

```powershell
npm run platform:file -- platform/contracts/examples/testcase.valid.json --schema test-case
```

也可直接调用构建产物：

```powershell
node dist/cli/platform.js module --path business-modules/purchase
node dist/cli/platform.js integration --path integration-tests/purchase-to-ap
node dist/cli/platform.js file --path platform/contracts/examples/testcase.valid.json --schema test-case
```

## 5. 契约测试

```powershell
npm run test:contract
```

## 6. 边界

- 只做静态校验，不连接 ERP、不启动浏览器、不写业务数据。
- 失败退出码非 0，不静默跳过。
- 草稿模块允许资产目录缺失并给出 warning；`approved` 模块必须资产齐全。
