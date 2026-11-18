# 领域文档

工程技能探索代码库时应如何消费本仓库的领域文档。

## 探索之前先读

- 仓库根目录的 **`GLOSSARY.md`**；或
- 若存在根目录 **`GLOSSARY-MAP.md`**：它指向每个上下文各自的 `GLOSSARY.md`，只读与当前主题相关的那几份。
- **`docs/adr/`**：读取涉及待改动区域的 ADR。多上下文仓库还要检查 `src/<context>/docs/adr/` 下的上下文级决策。
- 本仓库另有一份追加式决策日志 **`DECISIONS.md`**（根目录），记录「规则/关系是否可信」判定口径的变更；涉及知识库可信度判定时必须先读它。

上述文件不存在时**静默继续**：不要提示缺失，也不要主动建议先创建。`/domain-modeling` 技能（由 `/grill-with-docs` 与 `/improve-codebase-architecture` 触达）会在术语或决策真正定案时按需创建。

## 文件结构

单上下文仓库（绝大多数仓库，本仓库属于此类）：

```
/
├── GLOSSARY.md
├── DECISIONS.md
├── docs/adr/
│   ├── 0001-event-sourced-orders.md
│   └── 0002-postgres-for-write-model.md
└── src/
```

多上下文仓库（根目录存在 `GLOSSARY-MAP.md` 时）：

```
/
├── GLOSSARY-MAP.md
├── docs/adr/                          ← 系统级决策
└── src/
    ├── ordering/
    │   ├── GLOSSARY.md
    │   └── docs/adr/                  ← 上下文级决策
    └── billing/
        ├── GLOSSARY.md
        └── docs/adr/
```

本仓库当前为**单上下文**：根目录 `GLOSSARY.md` + `docs/adr/`，另有既有的 `DECISIONS.md` 决策日志。

## 使用术语表中的词汇

输出中提到领域概念时（issue 标题、重构方案、假设、测试名称），使用 `GLOSSARY.md` 定义的术语，不要漂移到术语表明确回避的同义词。

需要的概念尚未进入术语表时，这是一个信号：要么你在发明项目不使用的语言（重新考虑），要么确实存在缺口（记录给 `/domain-modeling`）。

## 标出 ADR 冲突

若你的输出与既有 ADR 或 `DECISIONS.md` 记录相矛盾，必须显式提出，而不是静默覆盖：

> _与 ADR-0007（event-sourced orders）冲突，但值得重新讨论，因为……_
