# TP-002 存货参数只读验证记录

日期：2026-11-06　环境：`athena-test`（租户 `digichannel`）
模式：Chrome CDP 接管（`127.0.0.1:9333`）
用例：`cases/tp-002-invnt-param-readonly.json`
运行：`artifacts/20261106-062707-j3b8/`

## 1. 结果

用例状态 `passed`，19 个步骤、15 条断言全部通过，耗时 7780 ms。执行后列表恢复为 9 条，无残留详情页签。

## 2. 覆盖情况

| 用例 | 场景 | 结果 | 证据 |
| --- | --- | --- | --- |
| TP-002-S01 | 运营单元主键识别 | PASS | 查看态 LOOKUP、必填；编辑态 `disabled=true` |
| TP-002-S02 | 运营单元基础资料选择器 | BLOCKED | 查看态不可交互；编辑已存在记录时主键禁用，需新增态 |
| TP-002-S03 | 审核日依据下拉 | PASS | 编辑态选项集合 `系统日 | 单据日`，当前选中 `系统日` |
| TP-002-S04 | 储位管理下拉 | NOT RUN | 当前详情 DOM 未渲染该字段 |
| TP-002-S05 | 开关状态读取 | PASS | `is_ena_proj_mgmt` 读到 `checked=false`，未切换 |
| TP-002-S06 | 系统字段只读性 | NOT RUN | 当前详情 DOM 仅渲染 3 个字段，系统字段不可见 |
| TP-002-S07 | 列表行数基线 | PASS | 9 行 / 7 列；关闭详情后恢复 9 行 |

## 3. 关键发现

1. 查看态控件只渲染不可交互：点击下拉或 WindowSelect 仅聚焦，不出现浮层。
2. 点击「编辑」后表单可交互，`aprv_date_basis` 下拉可打开并读取枚举；主键 `ops_unit_no` 仍为禁用态。
3. 详情态当前只渲染 3 个可见字段：`ops_unit_no`、`is_ena_proj_mgmt`、`aprv_date_basis`；元数据中的储位管理与系统字段未出现在 DOM。
4. 关闭编辑态页签出现未保存守卫，执行器选择「直接离开」，未保存任何内容。

## 4. 安全声明

- 未点击保存、删除、审核等写入按钮，未修改任何字段值。
- 进入编辑态仅用于读取下拉枚举，随后关闭页签并丢弃草稿。
- 所有证据中的 token 已脱敏，列表仍为 9 条。

## 5. 证据

- `results.json`、`report.md`、`report.html`
- `shots/TP-002-list.png`、`shots/TP-002-detail-edit.png`、`shots/TP-002-list-restored.png`
- `dom/TP-002-list.html`、`dom/TP-002-detail-edit.html`
- `logs/requests.jsonl`

## 6. 后续

- S02 需要新增一条测试记录，属于写入操作，需专项授权、唯一测试前缀与清理方案。
- S04 / S06 需要确认页面设计或权限是否应在详情态展示；在拿到证据前保持 NOT RUN。
