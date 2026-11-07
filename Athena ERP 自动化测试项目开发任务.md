# Athena ERP 自动化测试项目开发任务

## 项目定位

建立专门针对 Athena ERP 的 Web 自动化测试框架。

项目目录：

D:\AIProject\ERP-AI-Testing

ERP 测试地址：

https://athena-test.digiwincloud.com.cn/

## 一、开发原则

1. 使用 TypeScript + Playwright。

2. 使用 Page Object Model。

3. 建立 ERP 专用控件库。

4. 建立动态表单识别引擎。

5. 建立业务规则断言引擎。

6. 建立页面知识库。

7. 建立专用 athena-erp-testing Skill。

8. 支持 Chrome CDP 探索和独立 Chromium 回归测试。

## 二、开发阶段

### Phase 0：真实页面探索

连接现有 Chrome。

探索：

- 登录页面

- ERP 主框架

- 菜单结构

- 页面导航机制

- 查询列表

- 动态表单

- 基础资料选择窗口

- 弹窗

- 表格和明细行

输出：

- athena-page-map.json

- athena-component-map.json

- PAGE-DISCOVERY-REPORT.md

- 页面截图

未知结构标记 UNKNOWN，不允许猜测。

### Phase 1：测试框架

开发：

- CDP Browser Adapter

- Playwright Browser Adapter

- Page Manager

- Locator Engine

- ERP Form

- ERP Grid

- ERP Lookup

- ERP Dropdown

- ERP Modal

- Assertion Engine

- Evidence Manager

- HTML Reporter

所有模块必须有基础测试。

### Phase 2：业务测试

先开发客户资料测试。

覆盖：

- 页面打开

- 查询

- 新增

- 必填验证

- 基础资料关联

- 修改

- 重复数据验证

- 保存后重新查询

后续扩展供应商、商品、仓库、采购、销售和生产业务。

## 三、质量要求

1. 页面定位优先使用稳定 DOM 和 ARIA。

2. 不允许大量使用固定坐标。

3. 所有操作必须有超时和异常处理。

4. 每个测试用例有明确断言。

5. 保存截图、Trace 和错误日志。

6. 不得用页面成功提示代替后端数据验证。

7. 不得虚构 ERP 业务规则。

8. 高风险操作必须人工确认。

9. 测试账号、认证状态和敏感信息必须安全存储。

## 四、Codex 工作方式

采用增量开发：

1. 先检查现有环境。

2. 编写技术设计。

3. 实现一个模块。

4. 执行单元测试。

5. 执行实际浏览器验证。

6. 输出验收结果。

7. 验收通过后再开发下一个模块。

不得一次性生成全部代码后才进行验证。

## 五、第一阶段验收标准

- 可以连接已登录的 Chrome。

- 能够识别 Athena ERP 主页面。

- 能够读取菜单和页面 DOM。

- 能够识别表单及主要控件。

- 能够识别基础资料选择器。

- 能够生成页面知识库。

- 不修改任何 ERP 业务数据。

第一阶段完成后暂停，提交报告等待确认。
