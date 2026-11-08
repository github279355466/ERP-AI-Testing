# Phase 1 → Phase 2 接口契约

## 1. 输入要求

Phase 2 读取 Phase 1 已评审、已冻结的知识模型版本。至少需要：
- `modelVersion`
- `documents`
- `pages`
- `fields`
- `controls`
- `entities`
- `rules`
- `workflows`
- `dependencies`
- `scenarios`（可选，Phase 2 不执行未评审场景）

## 2. 读取原则

- 只读加载，不覆盖 Phase 1 文件。
- 启动时校验 Schema 和版本。
- 版本不兼容时停止并报告。
- 不存在的字段、控件或规则不得自行补造。
- Phase 1 的业务场景 DRAFT 不代表可执行测试。

## 3. 页面映射输出

建议每个页面生成：
- `pageKey`
- `knowledgePageId`
- `actualPageName`
- `navigationPath`
- `locatorMap`
- `observedControls`
- `unmappedFields`
- `unexpectedFields`
- `controlTypeMismatches`
- `evidence`
- `reviewStatus`

## 4. 差异分类

- `MATCHED`
- `PRD_FIELD_NOT_FOUND`
- `UNDOCUMENTED_UI_FIELD`
- `CONTROL_TYPE_MISMATCH`
- `LOCATOR_UNRESOLVED`
- `BUSINESS_RULE_CONFLICT`
- `NEEDS_HUMAN_REVIEW`

## 5. 版本治理

冻结模型版本变更后：
- 新版本独立保存；
- 记录变更原因和证据；
- 页面映射声明兼容的模型版本；
- 不得在自动化运行期间悄悄切换知识模型。
