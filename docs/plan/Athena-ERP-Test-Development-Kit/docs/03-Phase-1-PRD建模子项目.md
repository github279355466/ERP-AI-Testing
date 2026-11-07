# Phase 1：PRD 扫描与业务知识建模子项目

## 1. 子项目目标

交付一个可独立运行的 PRD 知识建模工具，为 Athena ERP 自动化测试平台提供统一业务知识底座。用户将 PRD 放入本地目录后，工具能够递归扫描并生成结构化知识库和分析报告。

## 2. 输入与输出

输入：
- `prd/` 下全部 PRD 文件。
- `config/project.config.json`。
- 可选的人工补充映射文件。

输出：
```text
artifacts/
├── source-index/
│   ├── DOCUMENT_REGISTER.json
│   └── scan-report.md
├── knowledge/
│   ├── documents/
│   ├── entities/
│   ├── pages/
│   ├── fields/
│   ├── controls/
│   ├── rules/
│   ├── actions/
│   ├── workflows/
│   ├── dependencies/
│   ├── scenarios/
│   └── evidence/
└── reports/
    ├── PRD_ANALYSIS_REPORT.md
    ├── PRD_INDEX.md
    ├── COVERAGE_MATRIX.md
    ├── OPEN_QUESTIONS.md
    ├── VERSION_CONFLICTS.md
    └── PARSE_ERRORS.md
```

## 3. 功能模块

### F1 文件扫描器
- 递归扫描配置目录。
- 按扩展名识别解析器。
- 计算 SHA-256。
- 排除临时文件、隐藏目录和配置排除项。
- 增量识别新增、修改、删除文件。
- 不删除历史解析结果；文档删除只标记源文件缺失。

### F2 文档识别器
- 提取标题、模块、对象、版本、日期、状态。
- 允许配置模块目录映射。
- 文件名和正文信息冲突时记录冲突，不静默覆盖。

### F3 文档解析器
第一阶段先完整支持 Markdown / TXT / JSON。
采用 Parser Adapter 接口，为 DOCX / XLSX / PDF 留扩展点。
解析结果保留章节、表格、列表和段落结构。

### F4 业务知识抽取器
抽取 Document、Entity、Page、Field、Control、Rule、Action、Workflow、Dependency、Evidence。
对无法可靠识别的信息保留原文并标记待确认。

### F5 关联与去重引擎
- 同名实体候选匹配。
- 业务对象跨文档引用。
- 字段定义合并候选。
- 上下游关系链接。
- 重复规则候选识别。
- 不能确定是否同一对象时保留独立对象并标记候选关联。

### F6 质量检查器
- Schema 校验。
- 证据完整性。
- 版本冲突。
- 规则冲突。
- 字段定义缺失。
- 状态机不完整。
- 流程依赖断链。
- 场景缺少断言或前置条件。

### F7 场景草案生成器
根据明确规则生成测试场景草案。
对于推导规则生成的场景必须标记 `NEEDS_CONFIRMATION`。
不允许自动执行场景。

### F8 报告生成器
生成文档目录、知识索引、覆盖率矩阵、问题清单、解析错误和整体分析报告。

## 4. 非功能要求

- 可重复运行：相同输入应得到稳定 ID 和可比较输出。
- 可增量运行：只重新解析新增或变更文件，但允许全量重建。
- 可审计：保留扫描时间、解析器版本、源文件哈希。
- 可恢复：单个文件失败不影响其他文件。
- 可测试：解析器、模型校验、关联器和报告生成器均有单元测试。
- 可移植：Windows 本地开发环境可运行。
- 安全：不上传 PRD 到外部服务；默认本地处理。
- 可扩展：解析器、模型类型、报告输出均采用插件或模块化接口。

## 5. 推荐命令接口

Codex 可按仓库现状调整命令名称，但必须提供等价能力：

```bash
# 查看帮助
npm run prd:help

# 全量扫描与建模
npm run prd:scan

# 增量扫描与建模
npm run prd:scan:incremental

# 校验知识模型
npm run prd:validate

# 生成报告
npm run prd:report

# 一键执行扫描、校验、报告
npm run prd:build
```

每个命令需提供成功/失败退出码，并输出可读日志。

## 6. 建议技术实现

优先采用 TypeScript 模块化单体：
- `src/prd-scanner/`
- `src/parsers/`
- `src/extractors/`
- `src/knowledge-model/`
- `src/linker/`
- `src/validators/`
- `src/scenario-generator/`
- `src/reporters/`
- `src/cli/`

第一阶段不要引入 ERP 浏览器自动化依赖，除非仓库已有统一依赖且不会造成耦合。

## 7. 验收演示

至少使用采购模块的多份 PRD 作为样本，验证：
- 供应商、品号等基础资料与采购单据实体能被识别。
- 请购、采购订单、采购到货、采购入库、采购退货等对象能建立候选业务关联。
- 采购订单取请购、到货取采购订单、入库取到货、退货关联已入库业务等内容，只有在 PRD 原文有证据时才建成明确关系。
- 未明确的数量口径、状态条件和回写逻辑进入问题清单。
- 输出的场景是草案，不能直接触发 ERP 操作。

注意：样本验收只证明解析和建模能力，不代表采购全流程规则已经完整。
