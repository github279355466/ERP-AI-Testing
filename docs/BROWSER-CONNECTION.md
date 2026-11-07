# 浏览器连接说明

## 1. 为什么需要代理

`athena-test.digiwincloud.com.cn` 解析到公网地址，但本机直连 443 不通，必须经代理 `http://127.0.0.1:10808`。
代理抖动时单次请求可能从 0.2s 涨到 30s 以上，因此框架的导航超时默认 120s，并允许重试。

自检：

```bash
curl.exe -sS --ssl-no-revoke -o NUL -w "%{http_code} %{time_total}\n" --max-time 60 https://athena-test.digiwincloud.com.cn/
```

## 2. 启动 Chrome（探索模式）

优先用脚本启动，参数全部来自 `config/athena.config.json`：

```bash
npm run browser:start
```

脚本 `scripts/start-chrome.ps1` 会读取 `browser.userDataDir`、`browser.cdpEndpoint`、`browser.proxy`、`environment.baseUrl`，并在端口已占用时提示退出（`-Force` 可强制再开一个窗口）。

等价的原始命令行：

```text
chrome.exe
  --no-sandbox
  --remote-debugging-port=9333
  --user-data-dir=D:\AIProject\ERP-AI-Testing\probe\chrome-profile
  --proxy-server=http://127.0.0.1:10808
  --ignore-certificate-errors
  --no-first-run --no-default-browser-check
  --window-size=1600,950 --lang=zh-CN
  https://athena-test.digiwincloud.com.cn/
```

注意：

- 在当前 Windows 执行上下文里，缺少 `--no-sandbox` 会让 Chrome 以退出码 3 立即退出。
- `browser.userDataDir` 默认 `probe/chrome-profile`（相对项目根解析），必须是项目内的独立目录：
  浏览器 profile 含大量小文件和登录 Cookie，放进 agent 会话工作区会让会话打开时扫描卡死。
- 该目录已加入 `.gitignore`，不得提交；换环境时删掉该目录即可得到干净登录态。
- `npm run athena -- doctor` 的 `profile` 检查项会打印实际解析到的绝对路径。
- 需要无人值守回归时，再用 `browser.storageState` 导出登录态，见下一节。

## 3. 登录

未登录访问 `/` 会 302 到 `/login?returnUrl=%2F`，标题「鼎捷雅典娜」。

- 账号字段：`input[name=userId]`
- 密码字段：`input[name=password]`
- 登录按钮：`button.ant-btn-primary`

测试账号由人工在窗口中输入；框架不保存、不自动填充凭据。登录后默认租户为「鼎捷渠道」（`digichannel`）。

登录后从左侧菜单打开目标作业。菜单点击会通过 `window.open` 打开**独立业务窗口**，门户地址栏不变，这是正常行为。

## 4. 验证连接

```bash
curl.exe -sS --max-time 5 http://127.0.0.1:9333/json/version
npm run athena -- doctor
```

`doctor` 会输出四类检查：配置、CDP 版本、知识库、当前页面清单。正常情况下应看到：

```
portal:https://athena-test.digiwincloud.com.cn/
business:https://lowcode-form-render-test.apps.digiwincloud.com.cn/list
```

## 5. 框架如何接管

```ts
const browser = await chromium.connectOverCDP('http://127.0.0.1:9333');
const context = browser.contexts()[0];
const page = context.pages().find((p) => p.url().includes('lowcode-form-render'));
```

- **不要**对 CDP 接管的 browser 调用 `browser.close()`，会关闭用户正在使用的窗口。
- 业务页与门户是两个独立 page，按 host 区分：门户 host 来自 `baseUrl`，业务页 host 为 `lowcodeHost`。
- 业务页 URL 携带 `token`，框架输出前会替换为 `<redacted>`。

## 6. 无头回归模式

若需要无人值守回归，先从已登录上下文导出 storageState，再用独立 Chromium 启动：

```ts
await context.storageState({ path: 'artifacts/state/auth.json' });
```

```json
{
  "browser": {
    "mode": "playwright",
    "headless": true,
    "storageState": "artifacts/state/auth.json"
  }
}
```

约束：

- `storageState` 含会话 Cookie，只能落本地 `artifacts/`，不得提交 Git。
- 登录态失效时立即失败并提示人工登录，不做自动重登。
- 同一账号并发会互相踢下线，回归默认串行（`workers: 1`）。

## 7. 常见问题

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| Chrome 启动后立刻退出（code 3） | 缺少 `--no-sandbox` | 补上该参数 |
| 页面只有骨架/白屏 | 资源加载中或代理抖动 | `page.reload()` 一次，等待业务信号 |
| `net::ERR_TIMED_OUT` | 代理不稳 | 重试 3 次，超时 120s |
| 业务页空白且地址被重定向回门户 | 登录态过期 | 人工重新登录 |
| 打开详情后列表变成 0 条 | 重复点击已激活的「列表」页签会触发空查询 | 框架已避免重复点击；必要时刷新页面 |
| 元素存在但点不动 | 自定义组件忽略合成事件 | 用元素包围盒真实点击，禁止页面绝对坐标 |
