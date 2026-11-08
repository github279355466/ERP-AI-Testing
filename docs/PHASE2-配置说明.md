# Phase 2 配置说明

## 1. 配置文件

| 文件 | 用途 |
| --- | --- |
| config/athena.config.json | 默认只读配置 |
| config/athena.write.config.json | 写入配置（需显式授权） |
| config/phase2.navigation.json | 页面菜单路径、别名、workItemCode |
| schemas/athena-config.schema.json | 配置 Schema |
| schemas/run-manifest.schema.json | 运行清单 Schema |
| schemas/page-mapping.schema.json | 页面映射 Schema |

## 2. environment

| 字段 | 说明 |
| --- | --- |
| name | 环境名称，用于报告 |
| type | 必须是 test；production 强制拒绝 |
| baseUrl | 门户地址 |
| tenantId / applicationCode | 租户与应用标识 |
| lowcodeHost | 低代码业务页主机 |
| allowedOrigins | 允许连接的来源白名单 |
| blockedOrigins | 禁止连接的来源 |

环境门禁：未设置 ALLOW_ERP_UI_TEST=true 时拒绝连接；跨主机重定向、白名单外地址、生产特征 host 一律拒绝。

## 3. browser

| 字段 | 说明 |
| --- | --- |
| mode | cdp 或 launch |
| cdpEndpoint | 默认 http://127.0.0.1:9333 |
| proxy | 代理地址，可空 |
| userDataDir | 浏览器 profile，默认 probe/chrome-profile |
| trace | 是否采集 Playwright Trace |
| viewport | 视口大小 |
| navigationTimeoutMs / readyTimeoutMs / actionTimeoutMs | 超时配置 |
| retry | 有限重试次数 |

## 4. safety

| 字段 | 说明 |
| --- | --- |
| readOnly | true 时禁止写入 |
| allowWrite | 写入总开关 |
| allowHighRiskActions | 高风险动作总开关 |
| allowDelete / allowAudit / allowUnAudit / allowStatusChange | 细分开关 |
| allowPosting | 默认 false；结账/过账/作废仍禁止 |
| allowFixedCoordinates | 默认 false；禁止绝对坐标 |
| forbiddenActionTexts | 禁止按钮文本 |

只读配置与写入配置通过 Schema 校验；环境变量可强制关闭高风险动作。

## 5. knowledge 与 run

| 字段 | 说明 |
| --- | --- |
| knowledge.frozenModelPath | 冻结知识模型目录，默认 artifacts/knowledge |
| knowledge.expectedModelVersion | 期望模型版本，默认 KM-380242c08313e3c2 |
| run.operator / run.testCaseId | 运行身份与用例标识 |

知识库重新生成后版本会变化；版本不匹配时 doctor 与运行门禁会拒绝执行。确认变更后更新 expectedModelVersion。

## 6. 证据配置

| 字段 | 说明 |
| --- | --- |
| captureScreenshotOnFailure | 失败自动截图 |
| captureTrace | 采集 Trace |
| localOnly | 仅本地保存 |
| retentionDays | 证据保留天数 |
| redactSecrets | 自动脱敏 token/password/cookie/authorization |

## 7. 导航配置

config/phase2.navigation.json 的页面条目包含：

- title：页面标题。
- menuPath：一级/二级/三级菜单。
- menuAliases：菜单文案别名，例如 请购管理 → 请釆管理。
- workItemCode：真实页面标识。
- status：candidate 或 confirmed。
- verifiedAt：确认日期。
- ready：list 或 form，决定导航后的就绪信号。

当前已确认：purchase-order=ujtGFTEuPMdk、purchase-arrival=TamjPZejafdk、purchase-inbound=FWGGvzbgedYY、purchase-return=MWHdpGcpoeWT、purchase-return-outbound=GqXCkXLlQWbb。

## 8. 凭据

凭据只允许通过环境变量传入：ERP_USERNAME、ERP_PASSWORD。不得写入配置文件、代码、日志、报告或 Git。
