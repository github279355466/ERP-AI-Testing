# 回滚手册（1.0.0）

## 触发条件

- 健康检查连续失败，无法连接浏览器或加载契约。
- 执行结果明显偏离基线（断言批量异常）。
- 出现越权/非测试环境写入、清理失效、审计不可用。
- 出现 S0/S1 缺陷。

## 回滚步骤

1. 停止新任务，保留当前 `artifacts/<run-id>/` 与部署目录现场。
2. 将 `releases/ACTIVE.json` 指回上一稳定版本（本次演练为 `1.0.0-rc1`）。
3. 在上一版本部署目录执行健康检查与契约校验：

```bash
node dist/cli/platform-health.js
node dist/cli/platform.js validate
```

4. 验证模块包与契约版本兼容（`MODULE-MANIFEST.json` / `CONTRACT-MANIFEST.json`）。
5. 不删除任何业务数据；仅清理本 run 创建且明确记录的数据。
6. 记录回滚时间、执行人、版本、验证结果与故障证据。

## 回滚后

- 恢复只读运行，确认列表冒烟通过后再评估写操作。
- 缺陷修复后重新走 RC 与发布审批。
