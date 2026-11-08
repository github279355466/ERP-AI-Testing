# 运维手册（1.0.0）

## 日常检查

| 检查项 | 命令 | 期望 |
| --- | --- | --- |
| 健康检查 | `node dist/cli/platform-health.js` | `success=true` |
| 契约校验 | `node dist/cli/platform.js validate` | 19/19 |
| 模块诊断 | `node dist/cli/platform-runtime.js doctor --module <id>` | 除 UI 门禁外全部 ok |
| 列表冒烟 | `node dist/cli/platform-run.js run --module <id> --case <case>` | passed |

## 日志与证据

- 运行产物：`artifacts/<run-id>/`（report.json/md/html、run-manifest.json、shots、failures）。
- 证据脱敏：Token/密码/Cookie 由 `redactSecrets` 处理；发现泄漏立即停止并清理。

## 故障处理

| 现象 | 排查 | 处理 |
| --- | --- | --- |
| CDP 连接失败 | `curl http://127.0.0.1:9333/json/version` | 重启 Chrome/CDP，确认端口 |
| 定位失败 | 查看 `failures/*/meta.json` 与 dom.html | 更新页面映射或用包围盒点击自定义组件 |
| 契约校验失败 | 查看 `platform:validate` 输出 | 修复资产或提升兼容版本 |
| 报告生成失败 | 查看 run-manifest 与 logs | 保留现场，禁止删除失败记录 |

## 发布后观察

- 连续观察 3 个运行批次：成功率、定位失败率、造数成功率、报告生成率、耗时。
- 出现 S0/S1 时停止新增写操作并评估回滚。
