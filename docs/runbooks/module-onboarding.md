# 运行手册：新增业务模块包

## 1. 复制模板

```powershell
Copy-Item -Recurse business-modules/_template business-modules/<module-id>
```

修改 `business-modules/<module-id>/module.yaml`：

- `module.id`：小写字母开头，仅小写字母、数字、连字符。
- `module.name`、`module.owner`、`module.description`：按实际填写。
- `module.status`：初始保持 `draft`。
- `compatibility.platform_api`：默认 `>=1.0.0 <2.0.0`。

## 2. 填充资产

按目录放置业务资产，不把模块字段写进平台核心：

| 目录 | 内容 |
| --- | --- |
| `source-index/` | PRD 索引与来源说明 |
| `knowledge/` | 实体、字段、规则、流程 |
| `page-mappings/` | 页面、菜单、字段、控件定位 |
| `scenarios/` | 业务场景 |
| `testcases/` | 测试用例 |
| `data-recipes/` | 数据配方 |
| `test-suites/` | 套件与执行顺序 |
| `fixtures/` | 测试夹具 |

## 3. 校验

```powershell
npm run platform:module -- business-modules/<module-id>
npm run test:contract
```

草稿模块允许资产目录暂缺，结果中会出现 warning；`approved` 模块必须资产齐全。

## 4. 评审与批准

1. 人工确认页面结构、字段与业务规则，未验证项保持 `candidate` / `UNKNOWN`。
2. 补齐来源引用与断言依据。
3. 把 `module.status` 改为 `reviewed`，完成评审后再改为 `approved`。
4. `approved` 后再次运行单模块校验，必须 0 error。

## 5. 接入集成包

新模块被集成包引用时，在 `integration-tests/<pack>/integration.yaml` 的 `module_dependencies` 中声明 `module_id` 与 `version_range`，再运行：

```powershell
npm run platform:integration -- integration-tests/<pack>
```

## 6. 从页面观测到可执行用例（P6 实证路径）

以 `base` / `ar` / `ap` 三个模块的接入为例：

1. **观测页面入口**：用只读脚本在门户点击菜单或复用已打开页签，记录页面标题与 `workItemCode`。
   P6 实测：`ar-biz-type=keeZGBfszTdp`、`ap-biz-type=pYIaGDZuhRRK`、`ap-biz-type-param=AyJIheXVzjAK`、`inventory-param=DTBBArnXZHrt`。
2. **写页面映射**：在 `page-mappings/<page-key>.yaml` 登记 `menu_path`、`work_item_code` 与字段；未逐字段复核的保持 `status: candidate`、`verified: false`。
3. **写用例**：`testcases/*.yaml` 中先 `navigate` 到页面，再 `invoke_flow` 调用流程；只读列表可用平台内置流程 `platform:list-smoke`。
4. **校验**：`npm run platform:module -- business-modules/<id>` 与 `npm run platform:runtime:doctor -- --module <id>`。
5. **只读执行**：启用 `ALLOW_ERP_UI_TEST=true` 后运行
   `node dist/cli/platform-run.js run --module <id> --case <case-id>`。
6. **写用例执行**：必须同时提供 `--allow-write` 与 `safety.allowWrite=true` 的运行配置（如 `config/athena.write.config.json`），并保持唯一数据前缀与 `mark_for_cleanup`。
7. **回填复核结果**：真实跑通的字段把 `verified` 改为 `true`；页面整体仍需人工评审后再改 `confirmed`。

## 7. 边界

- 平台核心不写模块字段、选择器或业务流程；流程实现放在 `src/modules/<module-id>/`，页面知识放在模块包。
- 默认只读；写操作必须显式授权，且不得自动重试非幂等动作。
- 不复制其他模块的页面对象或内部步骤；需要复用能力时抽到平台通用层。
