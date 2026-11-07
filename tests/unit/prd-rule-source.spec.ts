import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { extractPrdDocument } from '../../src/prd/extract';
import { scanSources } from '../../src/prd/scanner';

const SAMPLE_MD = `# 规则来源样例

**PRD类型**：表单

**版本**：V1.0

**业务对象**：规则来源样例（rule_src_doc）

**数据模型**：\`rule_src_doc\`（单头）

**所属应用**：smbcloud

## 一、功能说明

### 规则来源样例详情页

#### 1. 规则来源样例

##### 季度 (qtr)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 季度 |
| 填值方式 | 文本输入 |
| 字段含义 | 季度标识 |
| 是否必填 | ✅ 否 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 是 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 下拉项 |  |
| 校验项 | 隐藏字段，画面不显示。 |

## 二、操作说明

### 整体操作

#### 保存

| 控制项 | 说明 |
| --- | --- |
| 可用条件 | 无 |
| 展示设置 | 详情 |
| 操作前校验 | * 单号为空时 E+MSG："单号不可为空！" |
| 操作中处理 | * 调用 API：新增规则来源样例(bm.rule_src_doc.create) |
| 操作后处理 | * 提示"保存成功" |
`;

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'athena-prd-rule-'));
}

function makeConfig(root: string): PrdModelingConfig {
  const config = loadPrdConfig({
    repoRoot: root,
    configPath: path.join(root, 'missing-config.json'),
    prdDirOverride: path.join(root, 'prd'),
  });
  config.scenarioSources = [];
  config.output.artifactDir = path.join(root, 'artifacts');
  config.output.knowledgeDir = path.join(root, 'artifacts', 'knowledge');
  config.output.reportDir = path.join(root, 'reports');
  config.output.sourceIndexDir = path.join(root, 'artifacts', 'source-index');
  return config;
}

function extractSample() {
  const root = makeTempRoot();
  const dir = path.join(root, 'prd', '规则来源样例');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '规则来源样例PRD.v1.0.md'), SAMPLE_MD, 'utf8');
  const config = makeConfig(root);
  const scan = scanSources(config, 'FULL');
  const file = scan.files.find((item) => item.supported);
  expect(file).toBeTruthy();
  return extractPrdDocument(file!, config, new Date().toISOString());
}

test('操作说明推导出的规则标记为 PRD_DERIVED 并记录推导依据', () => {
  const extracted = extractSample();
  const processing = extracted.rules.find((rule) => rule.description.includes('调用 API'));
  expect(processing).toBeTruthy();
  expect(processing?.source_type).toBe('PRD_DERIVED');
  expect(processing?.confidence).toBe('DERIVED');
  expect(processing?.derivation).toBeTruthy();

  const stateLike = extracted.rules.find((rule) => rule.rule_type === 'HIDDEN');
  expect(stateLike?.source_type).toBe('PRD_EXPLICIT');
  expect(stateLike?.confidence).toBe('CONFIRMED');
});

test('字段说明重复标记不再生成第二条同类型规则', () => {
  const extracted = extractSample();
  const hiddenRules = extracted.rules.filter((rule) => rule.rule_type === 'HIDDEN' && rule.field_no === 'qtr');
  expect(hiddenRules).toHaveLength(1);
  expect(hiddenRules[0].description).not.toContain('画面不显示');
});
