# P1 验收报告：平台骨架与契约治理

> 状态：**P1 已完成，等待人工确认后进入 P2**。
> 验收日期：2026-11-08。
> 基线：`c4243c7`（tag `baseline-p0-20261108`）。
> 范围：只建立 v2.0 三层架构骨架与核心契约；不迁移采购实现，不连接 ERP，不启动浏览器，不执行写操作。

## 1. 硬边界核对

| 约束 | 结果 | 证据 |
| --- | --- | --- |
| 不连接 ERP | 通过 | 全部命令为静态校验/单测 |
| 不启动浏览器 | 通过 | `test:contract` 不加载 Playwright 浏览器 |
| 不执行写操作 | 通过 | 未调用任何 ERP 写接口或页面动作 |
| 不重写/删除 legacy | 通过 | `src/`、`knowledge/`、`cases/` 未改动 |
| 采购逻辑不进平台核心 | 通过 | 通用 Schema 无采购字段，契约测试有反向检查 |
| 无凭据入库 | 通过 | `runtime/users/` 只存操作者标识与凭据环境变量前缀 |

## 2. 交付物

| 类别 | 交付物 |
| --- | --- |
| 平台契约 | `platform/contracts/schemas/` 15 个 Schema（14 个契约 + `common`） |
| 契约示例 | `platform/contracts/examples/` 13 个正向样例 |
| 契约文档 | `docs/contracts/` 10 份（索引 + 9 份契约说明） |
| 校验器 | `src/platform/contracts/validator.ts`、`src/platform/contracts/semver.ts` |
| 运行清单 | `src/platform/governance/run-manifest-v2.ts`（v2 工厂 + v1 适配器） |
| CLI | `src/cli/platform.ts`（`validate` / `module` / `integration` / `file`） |
| 模块包 | `business-modules/_template/`、`business-modules/purchase/` |
| 集成包 | `integration-tests/_template/`、`integration-tests/purchase-to-ap/` |
| 运行时配置 | `runtime/environments/`、`runtime/users/`、`runtime/run-configs/` |
| 目标边界目录 | `adapters/`、`executions/`、`tools/`、`tests/platform/`（仅说明，不含实现） |
| 架构与决策 | `docs/architecture/`、`docs/decisions/` ADR-001/002 |
| 运行手册 | `docs/runbooks/validate-contracts.md`、`module-onboarding.md` |
| 契约测试 | `tests/contract/contracts.spec.ts`、`platform-cli.spec.ts`、`run-manifest-v2.spec.ts` |

## 3. P1 工作项逐项结果

| 工作项 | 状态 | 证据与说明 |
| --- | --- | --- |
| P1-01 基线冻结 | 完成 | 提交 `c4243c7`、标签 `baseline-p0-20261108`；`probe/` 未入库 |
| P1-02 文档信息架构 | 完成 | 新增 `docs/architecture/`、`contracts/`、`decisions/`、`runbooks/`；更新 README/AGENTS |
| P1-03 目录骨架 | 完成 | 新增 `platform/`、`adapters/`、`business-modules/`、`integration-tests/`、`runtime/`、`executions/`、`tools/`、`tests/contract/`、`tests/platform/` |
| P1-04 核心契约 | 完成 | 15 个 Schema、13 个示例；覆盖模块/场景/用例/页面/数据/报告/集成/动作/套件/运行配置 |
| P1-05 校验器与 CLI | 完成 | 支持单文件、模块包、集成包、全量校验；失败退出码 2，参数错误退出码 1 |
| P1-06 版本兼容 | 完成 | `semver.ts` 支持比较符、`^`、`~`、`||`；模块/集成包不兼容时拒绝 |
| P1-07 运行时配置拆分 | 完成 | 环境、操作者、运行配置分目录；凭据只留环境变量前缀 |
| P1-08 运行清单 v2 | 契约完成 | v2 Schema、工厂、v1 适配器与测试完成；运行时接入留待 P5 |
| P1-09 模块/集成模板 | 完成 | 模板无业务字段，通过契约校验；复制即可开始新模块 |
| P1-10 采购 manifest 骨架 | 完成 | `module.yaml`（draft）+ `ASSET-INDEX.md`；未搬迁任何采购代码 |
| P1-11 契约测试与 CI 基线 | 完成 | 92 项契约测试；本地 CI 基线 `npm run platform:check` |
| P1-12 验收与文档更新 | 完成 | 本报告 + README/AGENTS/契约/运行手册同步 |

## 4. 验证证据

| 命令 | 结果 |
| --- | --- |
| `npm run typecheck` | 通过，0 error |
| `npm run build` | 通过 |
| `npm run test:unit` | 139 passed |
| `npm run test:integration` | 27 passed |
| `npm run test:contract` | 92 passed |
| `npm run platform:validate` | 18/18 passed，0 failed，3 warnings |

`platform:validate` 的 3 条 warning 均为预期：

- `integration-tests/_template` 依赖的 `module-a`、`module-b` 是模板占位。
- `integration-tests/purchase-to-ap` 依赖的 `ap` 模块尚未建立（P6 前评估）。

契约测试覆盖：

- 13 个示例与动作注册表正向通过。
- 每个 Schema 的缺字段、错类型、未知字段、非法枚举反例被拒绝。
- 模块平台版本不兼容、资产缺失、集成包依赖缺失/版本不满足、已批准包空步骤被拒绝。
- CLI 退出码 0/1/2 与只读汇总输出。
- 运行清单 v2 正反例与 v1 四状态适配。

## 5. 验收标准对照

| 指标 | 通过标准 | 结果 |
| --- | --- | --- |
| 契约覆盖 | Module/Scenario/TestCase/PageMapping/DataRecipe/Report 均有 Schema | 通过 |
| 校验器 | 正常通过，缺字段/错类型/不兼容版本失败 | 通过 |
| 模块隔离 | 采购字段不进入通用 Schema | 通过（含反向测试） |
| 自动化测试 | 契约核心路径全绿 | 92 passed |
| 示例模块 | 空白模板通过校验 | 通过 |
| 采购资产 | 可逐步迁入新契约 | manifest + 资产索引就绪 |
| 代码变更 | 不破坏现有构建/测试 | build + 139 unit + 27 integration 全绿 |
| 无 ERP | 不连接、不启动浏览器、不写业务数据 | 通过 |

## 6. 已知问题与偏差

| 项 | 说明 | 处理 |
| --- | --- | --- |
| 运行清单 v2 未接入执行器 | P1 只交付契约、工厂与 v1 适配器 | P5 接入证据/执行链路 |
| 托管 CI 未配置 | 仓库未声明托管平台，先提供 `platform:check` 本地基线 | 需要时补 CI 配置 |
| `ap` 模块不存在 | `purchase-to-ap` 的预期 warning | 第二模块评估时创建 |
| 采购包仍为 draft | 仅资产索引与空目录，未迁移实现 | P4/P6 迁移 |
| `docs/ARCHITECTURE.md` 为历史文档 | 当前架构以 `docs/architecture/TO-BE.md` 为准 | 保留，不再新增事实 |
| 未做真实页面验证 | P1 明确不连接 ERP | 真实页面验证放 P2 之后按需执行 |

## 7. 停点与下一步

P1 到此停止：

- 不自动进入 P2。
- 不自动迁移采购代码。
- 不自动创建 `ap` 或第二业务模块。
- 不执行任何 ERP 连接或写操作。

P2 建议范围（仅建议，不执行）：

1. PRD 扫描器平台化，移除采购常量与目录假设。
2. 知识引擎按模块包输出契约化资产。
3. 建立知识冻结快照清单（版本、生成时间、SHA-256、残余问题）。
4. 保持页面对象与执行器不动，P4 再迁移。
