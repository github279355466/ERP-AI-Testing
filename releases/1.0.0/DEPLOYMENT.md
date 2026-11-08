# 部署手册（1.0.0）

## 前置条件

- Node.js >= 22（实测 24.19.0）
- npm >= 10（实测 11.x）
- 测试环境独立目录；不得部署到生产环境
- Chrome 已以 CDP 端口 9333 启动并完成测试账号登录

## 部署步骤

1. 解压发布包：

```bash
mkdir athena-platform-1.0.0
tar -xzf athena-platform-1.0.0.tgz -C athena-platform-1.0.0
cd athena-platform-1.0.0
```

2. 安装依赖（仅运行依赖与 Playwright）：

```bash
npm ci --omit=optional --ignore-scripts
```

3. 配置注入：

- 复制 `config/athena.config.json` 为运行配置，按环境修改 `environment.baseUrl`、`tenantId`、`browser.cdpEndpoint`。
- 写操作单独使用 `config/athena.write.config.json`，确认 `safety.allowWrite=true`。
- 凭据通过环境变量注入，不写入配置文件。

4. 启动与健康检查：

```bash
ALLOW_ERP_UI_TEST=true node dist/cli/platform-health.js
node dist/cli/platform.js validate
```

5. 停止：平台为短生命周期 CLI 运行实例，无长驻进程；停止即结束当前命令。

6. 重启验证：再次执行健康检查，确认 CDP、配置、模块包与产物目录正常。

## 部署验收

- 健康检查 `success=true`，required 检查全部通过。
- 契约校验 19/19。
- 真实 UI 只读冒烟通过（如 `SMOKE-INVENTORY-PARAM-LIST`）。
