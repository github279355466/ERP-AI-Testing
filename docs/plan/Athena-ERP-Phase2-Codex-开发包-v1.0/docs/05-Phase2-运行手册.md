# Phase 2 运行手册（模板）

> Codex 实施时必须根据实际项目脚本、环境和 ERP 登录方式补全，不能保留未经验证的命令作为“已验证”。

## 1. 环境准备

- 安装项目指定 Node.js LTS
- 安装依赖
- 安装 Playwright 浏览器
- 复制 `.env.example` 为 `.env`
- 填写非生产 ERP 地址和测试账号
- 确认测试账号权限
- 确认数据创建和清理策略

## 2. 安全启动

必须显式设置：
- `ALLOW_ERP_UI_TEST=true`
- `ERP_ENVIRONMENT_TYPE=test`（或经批准的 development/staging）
- `ERP_BASE_URL=...`
- `ERP_ENVIRONMENT_NAME=...`

生产环境必须拒绝运行。

## 3. 推荐命令（以 Codex 实际实现为准）

```powershell
npm install
npx playwright install chromium
npm run typecheck
npm test
npm run phase2:doctor
npm run phase2:discover
npm run phase2:e2e:purchase-order
```

## 4. 运行前检查

- 目标环境为非生产。
- 测试账号可用。
- 测试数据策略已批准。
- 浏览器版本已安装。
- Phase 1 知识模型版本正确。
- 高风险操作保持关闭。
- 本次运行使用独立 runId。

## 5. 失败排查

先查看：
1. `artifacts/runs/<runId>/manifest.json`
2. `logs/`
3. `screenshots/`
4. `traces/`
5. `reports/`

不得在失败后直接重复运行有副作用的步骤。先确认 ERP 是否已经创建单据。
