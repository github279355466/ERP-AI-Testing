# ADR-003: agent-browser 的定位 —— 探索层工具，不进执行层

- 状态：提议（待确认）
- 日期：2026-11-10
- 决策范围：`probe/` 探索方式、失败诊断方式；**不涉及** Playwright 执行层

## 1. 背景

本仓库是 Athena ERP 的 Playwright 自动化测试平台，执行层要求确定性、可 CI、分层断言（见 AGENTS.md §1）。
但页面结构的发现（page map、选择器、字段证据）目前靠 `probe/` 下约 100 个一次性脚本完成，
其中大量 `_tmp-*.cjs` 是"为问一个页面上有什么字段"而写 40 行 Playwright 的一次性产物。

问题不在 Playwright，而在"探索"这一步本来不需要写完整个脚本才能拿到答案。

## 2. 实测环境（本机，2026-11-10）

| 项 | 结果 |
| --- | --- |
| agent-browser 版本 | 0.42.0（Windows x86_64，全局已安装） |
| `agent-browser doctor` | 全 pass：Chrome 157.0.8103.39、ffmpeg、Chrome for Testing CDN 464ms、headless 启动 2.70s |
| 冷启动 open | 7.3s（daemon + 浏览器启动） |
| 后续单命令 | 无启动开销（daemon 常驻，浏览器保活） |
| `snapshot -i` 输出 | example.com 实测 **29 字符** |
| `--cdp` 挂已有 Chrome | 验证通过：挂到 9444 端口后复用**同一个 tab**（原 example.com tab 被导航为 example.org），关闭 session 后宿主 Chrome 存活 |

## 3. 与"直接让 agent 用浏览器"的本质差异

三条路线不是同一层的东西：

| 维度 | agent-browser | Hermes 内置 browser_exec | Playwright MCP |
| --- | --- | --- | --- |
| 驱动方式 | 一条 shell 命令一步，daemon 持有页面 | agent 写 Python 调 Browser Use helpers | MCP 工具调用 |
| 页面读取 | `snapshot -i` 紧凑 AX 树 + `@eN` ref | `page_info()` / `js()` 自己拼 | 全量 YAML AX 树（通常 3-8K token） |
| 每步 token | 极低（几十~几百） | 中（看你怎么写） | 高 |
| 状态存活 | daemon 跨命令保活浏览器 | 会话内存活 | 会话内存活 |
| 挂已有登录态 | `--cdp` / `--auto-connect` | CDP 可 | 可 |
| 测试专属能力 | `diff`、`record`(录像)、`trace`、`profiler`、`vitals`、`console`、`errors`、`network har` | 无 | trace 有，其余弱 |
| 安全闸门 | `--allowed-domains`、`--action-policy`、`--confirm-actions`、auth vault、content boundaries | 无内置 | 无 |
| 可移植性 | 任何 agent harness 都可用，`agent-browser mcp` 可转 MCP | 绑 Hermes | 绑 MCP 客户端 |
| 确定性/断言/CI | **不是它的活** | 不是它的活 | 不是它的活 |

结论：agent-browser **不能**替代 Playwright 执行层。它替代的是"写临时探针脚本"这一层。

## 4. 决策

1. **执行层零改动**。`platform/`、`business-modules/`、`integration-tests/`、`playwright.config.ts` 不动。
2. **`probe/` 探索一律走 agent-browser**，禁止新增 `_tmp-*.cjs`。探索步骤记录为命令序列，产物落 `probe/evidence/`。
3. **失败诊断优先用 agent-browser `--cdp` 挂同一浏览器**，配合 `console`/`errors`/`network requests`/`trace`，再回看 Playwright trace。
4. 探索得到的结论仍必须按 AGENTS.md §1 标注：已验证 / `candidate` / `UNKNOWN`。

## 5. 标准操作

```bash
# 1) 起专用 Chrome（沿用现有脚本，9333 端口 + probe/chrome-profile 登录态）
pwsh -File scripts/start-chrome.ps1

# 2) agent 挂上去，复用 ERP 登录态，不重新登录
agent-browser --session athena --cdp 9333 open https://athena-test.digiwincloud.com.cn/

# 3) 探索：只看可交互元素，极省 token
agent-browser --session athena snapshot -i -d 4
agent-browser --session athena snapshot -i -s "#form"     # 局部扫描
agent-browser --session athena get html <sel>             # 取控件属性证据
agent-browser --session athena get count <sel>
agent-browser --session athena is visible <sel>

# 4) 证据落盘（进 probe/evidence/，再人工确认后写进 business-modules/<id>/）
agent-browser --session athena snapshot -i > probe/evidence/<page>-<date>.txt

# 5) 诊断
agent-browser --session athena errors
agent-browser --session athena network requests --filter <pattern>
agent-browser --session athena screenshot --annotate probe/evidence/<page>.png

# 6) 收尾（不影响宿主 Chrome）
agent-browser --session athena close
```

## 6. 约束

- `--allowed-domains` 与 `--cdp` / `--profile` / `--restore` / `state load` 互斥（见 agent-browser Security 文档）。
  本仓库探索阶段用 `--cdp` 复用登录态，因此**不启用** domain allowlist；只有在无登录需求的全新上下文里才谈 allowlist。
- ref（`@eN`）在导航或 DOM 变更后失效，必须重新 `snapshot`。
- 点击被遮挡/禁用/不可见时 agent-browser 会**报错而不是假成功**——这与 AGENTS.md §1「不得把点击成功当业务成功」同向，是加分项。
- 不要在探索阶段触发写操作（保存/审核/删除），保持默认只读。

## 7. 不采用的情形

- 纯 CI 回归跑批：只用 Playwright，agent-browser 不参与。
- 一次性、答案已知的取数：`curl` / OpenAPI 直连更快。
- 需要强断言与可重现报告：Playwright + 分层断言。

## 修改记录

| 日期 | 变更 |
| --- | --- |
| 2026-11-10 | 初版：基于本机 0.42.0 实测（doctor / snapshot 体积 / --cdp 挂载）撰写 |