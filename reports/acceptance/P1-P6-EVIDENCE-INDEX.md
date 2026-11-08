# P1–P6 证据索引

## 1. 复现命令

```bash
node scripts/gate-a-check.mjs
npm run typecheck
npm run build
npm run test:unit
npm run test:contract
npm run test:integration
npm run test:platform
npm run platform:validate
```

机器可读结果：`reports/acceptance/gate-a-evidence.json`（含 commit、命令退出码、测试尾部、凭证扫描、知识指标、最近 15 个运行）。

## 2. 质量门禁证据

| 命令 | 结果 | 证据位置 |
| --- | --- | --- |
| typecheck | exit 0 | gate-a-evidence.json `quality` |
| build | exit 0 | 同上 |
| unit | 139 passed | 同上 |
| contract | 92 passed | 同上 |
| integration | 27 passed | 同上 |
| platform | 56 passed | 同上 |
| platform:validate | 19/19 | 同上 |
| 凭证扫描 | 1 条（单测假密码） | gate-a-evidence.json `secret_scan` |

## 3. 真实 UI 运行

| run id | 结论 | 断言 | 报告 |
| --- | --- | --- | --- |
| `P6-PO-20261108-04` | passed | 14/14 | `artifacts/P6-PO-20261108-04/report.md` |
| `P7-PO-LIFECYCLE-01` | passed | 9/9 | `artifacts/P7-PO-LIFECYCLE-01/report.md` |
| `P8-PO-FIELD-RULES-05` | passed | 13/13 | `artifacts/P8-PO-FIELD-RULES-05/report.md` |
| `SYS-BASE-20261108T133604` | passed | 3/3 | `artifacts/SYS-BASE-20261108T133604/report.md` |
| `SYS-AR-20261108T133604` | passed | 3/3 | `artifacts/SYS-AR-20261108T133604/report.md` |
| `SYS-AP-20261108T133604` | passed | 3/3 | `artifacts/SYS-AP-20261108T133604/report.md` |
| `SYS-PURCHASE-20261108T133604` | passed | 3/3 | `artifacts/SYS-PURCHASE-20261108T133604/report.md` |

每个运行目录包含：`report.json`、`report.md`、`report.html`、`run-manifest.json`、`shots/`；失败运行额外包含 `failures/`（截图 + DOM + meta）。

## 4. 知识与编译产物

| 产物 | 路径 | 指标 |
| --- | --- | --- |
| 模块摘要 | `artifacts/modules/purchase/knowledge/module-summary.json` | 122 文档 / 2,616 字段 / 9,316 规则 / 1,664 场景 / 381 待确认 |
| 术语表 | `artifacts/modules/purchase/knowledge/glossary.json` | 686 术语 |
| 编译摘要 | `artifacts/modules/purchase/compiled/compile-summary.json` | 1,664 用例 / 0 跳过 / DAG 无环 |
| 执行计划 | `artifacts/modules/purchase/compiled/execution-plan.json` | 1,664 步骤 |
| Dry-run | `artifacts/modules/purchase/compiled/dry-run.json` | 审批闸门 executable=false（0/1,664 approved） |

## 5. 契约与模块资产

| 资产 | 路径 |
| --- | --- |
| 契约 Schema | `platform/contracts/schemas/`（16 个文件） |
| 动作注册表 | `platform/contracts/action-registry.json`（18 个动作） |
| 采购模块包 | `business-modules/purchase/`（页面映射 4、用例 4、配方 1、字段规则 12） |
| 基础/应收/应付 | `business-modules/{base,ar,ap}/` |
| 集成包 | `integration-tests/purchase-to-ap/` |

## 6. 文档证据

- `docs/acceptance/P1-ACCEPTANCE.md` ~ `P7-ACCEPTANCE.md`
- `docs/acceptance/FINAL-ACCEPTANCE.md`
- `docs/architecture/`（AS-IS、TO-BE、BOUNDARIES）
- `docs/contracts/`（10 份）
- `docs/runbooks/`（契约校验、模块接入）

## 7. 缺口证据

- 覆盖率：`module-summary.json` `coverage.rate=0.2663`
- 用例状态：`artifacts/modules/purchase/compiled/testcases.json` 全部 `status=draft`
- 页面映射：`business-modules/*/page-mappings/*.yaml` 中 `verified: true` 仅 8 处
- AR/AP 深度：`business-modules/ar|ap/testcases/` 仅列表只读用例
