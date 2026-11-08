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

## 6. 边界

- P1 只建立骨架与契约，不迁移现有采购实现。
- 不连接 ERP、不启动浏览器、不执行写操作。
- 不复制其他模块的页面对象或内部步骤。
