import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { extractPrdDocument } from '../../src/prd/extract';
import { markLatestDocuments } from '../../src/prd/link';
import { isPrdOriginal, scanSources } from '../../src/prd/scanner';
import { DocumentRecord } from '../../src/prd/types';

function samplePrd(title: string, entityNo: string): string {
  return `# ${title}

**PRD类型**：表单

**业务对象**：${title}（${entityNo}）

**数据模型**：\`${entityNo}\`（单头）

**所属应用**：smbcloud

## 一、功能说明

### ${title}详情页

#### 1. ${title}

##### 单号 (doc_no)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 单号 |
| 填值方式 | 文本输入 |
| 字段含义 | 单据编号 |
| 是否必填 | ✅ 是 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 下拉项 |  |
| 校验项 |  |
`;
}

function makeConfig(root: string): PrdModelingConfig {
  const config = loadPrdConfig({
    repoRoot: root,
    configPath: path.join(root, 'missing-config.json'),
    prdDirOverride: path.join(root, 'prd'),
  });
  config.scenarioSources = [
    { name: '测试用例', inputDir: path.join(root, '测试用例'), kind: 'TEST_CASE_LIBRARY' },
  ];
  config.output.artifactDir = path.join(root, 'artifacts');
  config.output.knowledgeDir = path.join(root, 'artifacts', 'knowledge');
  config.output.reportDir = path.join(root, 'reports');
  config.output.sourceIndexDir = path.join(root, 'artifacts', 'source-index');
  config.prd.moduleRules = [
    { pattern: '^采购域$', module: '采购' },
    { pattern: '^采购订单$', module: '采购' },
  ];
  return config;
}

test('用例库中的 PRD 原文档按 PRD 建模并归入同一作业目录', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-prd-supplement-'));
  const prdDir = path.join(root, 'prd', '采购订单');
  fs.mkdirSync(prdDir, { recursive: true });
  fs.writeFileSync(path.join(prdDir, '采购订单PRD.v1.12.md'), samplePrd('采购订单', 'po'), 'utf8');

  const caseDir = path.join(root, '测试用例', '采购域', '采购订单');
  fs.mkdirSync(caseDir, { recursive: true });
  fs.writeFileSync(
    path.join(caseDir, 'DOC415646892677804032_采购订单_V1.13.md'),
    samplePrd('采购订单', 'po'),
    'utf8'
  );
  fs.writeFileSync(
    path.join(caseDir, 'test-cases.json'),
    JSON.stringify({ meta: { name: '采购订单' }, cases: [] }),
    'utf8'
  );

  const config = makeConfig(root);
  const scan = scanSources(config, 'FULL');
  const original = scan.files.find((file) => file.file_name.startsWith('DOC'));
  expect(original?.role).toBe('PRD');
  expect(original?.job_directory).toBe('采购订单');
  expect(original?.domain_name).toBe('采购域');
  expect(isPrdOriginal('采购域/采购订单/DOC1_采购订单_V1.13.md')).toBe(true);
  expect(isPrdOriginal('采购域/采购订单/test-cases.json')).toBe(false);

  const caseJson = scan.files.find((file) => file.file_name === 'test-cases.json');
  expect(caseJson?.role).toBe('TEST_CASE_LIBRARY');

  const documents: DocumentRecord[] = scan.files
    .filter((file) => file.role === 'PRD')
    .map((file) => extractPrdDocument(file, config, new Date().toISOString()).document);
  expect(documents).toHaveLength(2);
  expect(documents.every((document) => document.module === '采购')).toBe(true);
  expect(documents.every((document) => document.job_directory === '采购订单')).toBe(true);

  const latest = markLatestDocuments(documents, new Set(documents.map((document) => document.id)));
  const winner = documents.find((document) => document.id === [...latest][0]);
  expect(latest.size).toBe(1);
  expect(winner?.doc_version).toBe('1.13');
  expect(winner?.file_name.startsWith('DOC')).toBe(true);
});
