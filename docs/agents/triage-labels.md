# Triage 标签

工程技能用五个固定 triage 角色沟通。本文件把这些角色映射到本仓库 issue tracker 实际使用的标签字符串。

| 技能中的角色 | 本仓库标签 | 含义 |
| --- | --- | --- |
| `needs-triage` | `needs-triage` | 维护者需要评估此 issue |
| `needs-info` | `needs-info` | 等待报告者补充信息 |
| `ready-for-agent` | `ready-for-agent` | 规格完整，可交给自动化 agent 执行 |
| `ready-for-human` | `ready-for-human` | 需要人工实现 |
| `wontfix` | `wontfix` | 不予处理 |

技能提到某个角色时（例如「打上可交给 agent 的 triage 标签」），使用上表对应的标签字符串。

本地 markdown tracker 中，标签以 issue 文件顶部的 `Status:` 行表达，多个标签可用逗号分隔。
