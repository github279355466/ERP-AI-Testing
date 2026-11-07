# Codex 开发启动指令

> 将本文件与整个开发包放在项目根目录。打开 Codex 后，先完整阅读本文件，再阅读 `README.md` 和 `docs/` 中全部规范。

## 一、任务目标

你负责开发 **Athena ERP 全功能业务自动化测试平台**。本次优先开发 Phase 1：PRD 扫描与业务知识建模子项目，同时建立整个项目的可扩展代码骨架和架构边界。

不要把任务理解为“只做一个 Markdown 解析脚本”。也不要一次性实现全部七个子系统。当前交付重点是 Phase 1 可运行、可验证、可扩展，其他子系统只建立清晰接口和路线图。

## 二、先勘察，不要直接编码

1. 检查当前仓库目录、已有代码、运行环境、Node.js / npm 版本、Git 状态。
2. 检查项目根目录下 `prd/` 是否存在；若用户已有其他 PRD 目录，优先识别并在配置中登记，不得移动或修改原始 PRD。
3. 检查现有项目是否已有 Playwright、测试框架、日志、配置、Schema 校验依赖。
4. 先输出 `reports/IMPLEMENTATION_ASSESSMENT.md`，说明现状、复用项、风险和实施计划。
5. 如果仓库已有架构与本包冲突，先列出差异和建议，不得擅自大规模重构。

## 三、必须遵守的架构约束

- ERP 业务交互仅通过 Playwright UI 完成。
- 不使用 ERP OpenAPI / MCP 准备数据、执行操作或验证结果。
- Phase 1 不连接 ERP，不启动浏览器，不执行任何业务操作。
- PRD 原文只读，不得改写、移动或删除。
- 规则必须保留来源类别和证据位置。
- 推导规则必须明确标记 `PRD_DERIVED` 并记录推导依据。
- 未知规则标记 `PENDING`，不得编造。
- 不同版本冲突必须保留并报告。
- 测试场景初始状态必须是 `DRAFT`，未经评审不得执行。
- 使用模块化单体，避免过早引入微服务、消息队列和外部数据库。
- 本地处理 PRD，默认不得上传到外部模型或第三方服务。

## 四、Phase 1 实施任务

按以下顺序执行，每完成一组任务先运行测试并记录结果：

### Task 1：项目骨架
建议目录：
```text
src/
├── cli/
├── config/
├── prd-scanner/
├── parsers/
├── extractors/
├── knowledge-model/
├── linker/
├── validators/
├── scenario-generator/
├── reporters/
└── shared/
tests/
config/
prd/
artifacts/
reports/
docs/
```

根据现有仓库决定是否调整，但必须保持模块职责清楚。

### Task 2：文件扫描与登记
- 递归扫描 `prd/`。
- 第一阶段支持 MD / TXT / JSON。
- 计算 SHA-256。
- 生成稳定 document ID。
- 识别新增、修改、未变化和源文件缺失。
- 不静默忽略不支持的文件。
- 生成 `DOCUMENT_REGISTER.json` 和扫描报告。

### Task 3：Markdown 解析
- 保留标题层级、段落、列表、表格和行号。
- 不要仅用正则把整份文档切成无上下文文本。
- 解析失败时保留错误位置和原文文件引用。
- 为 DOCX / XLSX / PDF 设计 Parser Adapter 接口，但本阶段可不实现完整解析。

### Task 4：知识抽取
抽取 Document、Entity、Page、Field、Control、Rule、Action、Workflow、Dependency、Evidence。
采用“规则/模板解析 + 可选 AI 辅助”的可替换架构。AI 辅助不得成为运行的强制外部依赖；若调用模型，必须可关闭、可记录、可复核，且不得将模型猜测写为明确规则。

### Task 5：关联与质量检查
- 关联同一业务对象的多个 PRD。
- 识别上下游流程候选。
- 识别重复定义和版本冲突。
- 校验证据引用。
- 校验 Schema。
- 生成问题清单。
- 对不确定关联使用 `CANDIDATE_LINK`，不要强行合并。

### Task 6：测试场景草案
从明确规则生成场景草案。
每个场景必须引用规则 ID 和来源证据。
所有场景初始为 DRAFT。
不能形成可观察断言的场景标记 `NOT_UI_OBSERVABLE` 或 `NEEDS_CONFIRMATION`。

### Task 7：报告
至少生成：
- `PRD_INDEX.md`
- `PRD_ANALYSIS_REPORT.md`
- `COVERAGE_MATRIX.md`
- `OPEN_QUESTIONS.md`
- `VERSION_CONFLICTS.md`
- `PARSE_ERRORS.md`

### Task 8：命令行
提供等价命令：
- `prd:scan`
- `prd:scan:incremental`
- `prd:validate`
- `prd:report`
- `prd:build`

每条命令有清楚帮助、退出码和日志。

### Task 9：测试
至少包含：
- 扫描器单元测试。
- 哈希与增量扫描测试。
- Markdown 标题/表格/列表/行号解析测试。
- 规则来源标记测试。
- 证据缺失测试。
- 版本冲突测试。
- Schema 校验测试。
- 场景草案状态测试。
- 端到端样本测试。

### Task 10：采购样本验证
使用 `prd/采购/` 中现有 PRD 样本验证。
如果目录没有样本，不得虚构样本结果；明确提示用户将完整 PRD 放入该目录。
对采购请购、采购订单、采购到货、采购入库、采购退货及相关基础资料建立候选实体和流程关系。所有关系必须有证据；不明确的数量口径、状态条件、回写逻辑进入待确认清单。

## 五、Phase 1 验收条件

- [ ] 可扫描完整 PRD 目录及子目录。
- [ ] 支持 MD / TXT / JSON。
- [ ] 生成文档登记表、哈希和稳定 ID。
- [ ] 可识别新增、修改、未变化文件。
- [ ] 输出结构化知识模型。
- [ ] 所有规则包含来源类型和证据引用或缺失标记。
- [ ] 可识别版本冲突和待确认问题。
- [ ] 可建立实体、规则、流程和依赖关系。
- [ ] 输出测试场景草案和覆盖率矩阵。
- [ ] 场景未经评审不可执行。
- [ ] 自动化测试通过。
- [ ] 提供 Windows 环境运行说明。
- [ ] Phase 1 未连接 ERP、未调用 ERP API/MCP、未执行 UI 操作。

## 六、交付报告

开发完成后，输出：
1. `reports/IMPLEMENTATION_ASSESSMENT.md`
2. `reports/PHASE1_COMPLETION_REPORT.md`
3. `reports/KNOWN_LIMITATIONS.md`
4. `reports/NEXT_PHASE_RECOMMENDATION.md`

报告必须说明真实完成项、未完成项、测试结果、运行命令和下一阶段建议。禁止把计划写成已完成。

## 七、执行方式

先完成仓库勘察并给出实施评估，然后开始 Phase 1。若存在会影响架构或数据安全的重大不确定项，先停下来提问；普通技术实现细节由你自行选择合理方案并记录决策。
