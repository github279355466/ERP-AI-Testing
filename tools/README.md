# Tools

平台开发与治理工具目标目录。

P1 的工具入口仍在 `src/cli/platform.ts`：

```powershell
npm run platform:validate
npm run platform:check
```

后续可把契约生成、模块脚手架、知识冻结等脚本迁入本目录；不得放业务模块实现。
