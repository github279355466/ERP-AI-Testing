# Issue tracker: 本地 Markdown

本仓库的 issue 与 spec 以 markdown 文件形式存放在 `.scratch/` 下（仓库当前没有 Git remote，因此不使用 GitHub / GitLab Issues）。

## 约定

- 一个特性一个目录：`.scratch/<feature-slug>/`
- spec 为 `.scratch/<feature-slug>/spec.md`
- 实现 ticket 一票一文件：`.scratch/<feature-slug>/issues/<NN>-<slug>.md`，从 `01` 起编号，禁止把所有 ticket 合并成一个文件
- triage 状态写在每个 issue 文件顶部附近的 `Status:` 行（角色字符串见 `triage-labels.md`）
- 评论与讨论历史追加到文件底部的 `## Comments` 标题下

## 当技能要求「发布到 issue tracker」

在 `.scratch/<feature-slug>/` 下新建文件（目录不存在则先创建）。

## 当技能要求「读取相关 ticket」

直接读取对应路径的文件。用户通常会给出路径或 issue 编号。

## Wayfinding 操作

供 `/wayfinder` 使用。**map** 是一个文件，每个 ticket 对应一个 **child** 文件。

- **Map**：`.scratch/<effort>/map.md`（承载 Notes / Decisions-so-far / Fog 正文）。
- **Child ticket**：`.scratch/<effort>/issues/NN-<slug>.md`，从 `01` 起编号，问题写在正文里。`Type:` 行记录 ticket 类型（`research`/`prototype`/`grilling`/`task`），`Status:` 行记录 `claimed`/`resolved`。
- **Blocking**：顶部附近的 `Blocked by: NN, NN` 行。它列出的文件全部为 `resolved` 时，该 ticket 才算解除阻塞。
- **Frontier**：扫描 `.scratch/<effort>/issues/`，找出未完成、未阻塞、未被认领的文件，编号最小者优先。
- **Claim**：开始工作前先把 `Status:` 置为 `claimed` 并保存。
- **Resolve**：在 `## Answer` 标题下追加答案，把 `Status:` 置为 `resolved`，再把上下文指针（要点 + 链接）追加到 `map.md` 的 Decisions-so-far。

## 本仓库约束

- `.scratch/` 只记录需求、spec 与 ticket，不存放凭据、Cookie 或浏览器 profile。
- 进入实现前仍须遵守 `AGENTS.md` 的只读默认与写操作授权要求；ticket 被标为 `ready-for-agent` 不等于获得写操作授权。
