import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  buildPrdIndex,
  comparePrdVersions,
  extractPrdMetadata,
  parsePrdVersion,
  readPrdSection,
  selectLatestPrd,
  validatePrdIndex,
} from '../../src/knowledge/prd-index';

test('解析 PRD 版本号', () => {
  expect(parsePrdVersion('应付单PRD.v1.9.md')).toBe('1.9');
  expect(parsePrdVersion('应付单PRD.v1.10.md')).toBe('1.10');
  expect(parsePrdVersion('应收启用期间PRD.v1.3-cloud.md')).toBe('1.3');
  expect(parsePrdVersion('无版本说明.md')).toBeNull();
});

test('版本按数字段比较而不是字符串比较', () => {
  expect(comparePrdVersions('1.10', '1.9')).toBeGreaterThan(0);
  expect(comparePrdVersions('2.0', '1.99')).toBeGreaterThan(0);
  expect(comparePrdVersions('1.3', '1.3.0')).toBe(0);
});

test('选择最新版，版本优先于修改时间', () => {
  const latest = selectLatestPrd([
    { name: '单据PRD.v1.9.md', mtimeMs: 300 },
    { name: '单据PRD.v1.10.md', mtimeMs: 100 },
    { name: '单据PRD.v1.3-cloud.md', mtimeMs: 200 },
  ]);
  expect(latest?.version).toBe('1.10');
});

test('同版本时选修改时间较新的文件', () => {
  const latest = selectLatestPrd([
    { name: '单据PRD.v1.3-cloud.md', mtimeMs: 100 },
    { name: '单据PRD.v1.3.md', mtimeMs: 200 },
  ]);
  expect(latest?.file.name).toBe('单据PRD.v1.3.md');
});

test('抽取 PRD 元数据与字段', () => {
  const content = [
    '# 测试单',
    '**PRD类型**：表单',
    '**业务对象**：测试对象（`test_doc`）',
    '**所属应用**：smbcloud',
    '## 一、变更日志',
    '## 二、业务说明',
    '### 2.1 名词解释',
    '##### 单号 (doc_no)',
    '##### 业务域（biz_reg）',
  ].join('\n');

  const meta = extractPrdMetadata(content);
  expect(meta.title).toBe('测试单');
  expect(meta.prdType).toBe('表单');
  expect(meta.entity).toBe('test_doc');
  expect(meta.entityLabel).toBe('测试对象');
  expect(meta.application).toBe('smbcloud');
  expect(meta.sections).toEqual(['一、变更日志', '二、业务说明']);
  expect(meta.subsections).toEqual(['2.1 名词解释']);
  expect(meta.fields).toEqual([
    { label: '单号', name: 'doc_no' },
    { label: '业务域', name: 'biz_reg' },
  ]);
});

test('构建索引时选最新版并关联计划与页面', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-prd-'));
  try {
    const prdDir = path.join(root, 'prd', '测试作业');
    const planDir = path.join(root, 'plans');
    fs.mkdirSync(prdDir, { recursive: true });
    fs.mkdirSync(planDir, { recursive: true });
    const body = [
      '# 测试作业',
      '**PRD类型**：表单',
      '**业务对象**：测试对象（`test_doc`）',
      '**所属应用**：smbcloud',
      '## 一、变更日志',
      '##### 单号 (doc_no)',
    ].join('\n');
    fs.writeFileSync(path.join(prdDir, '测试作业PRD.v1.9.md'), body, 'utf8');
    fs.writeFileSync(path.join(prdDir, '测试作业PRD.v1.10.md'), body, 'utf8');
    fs.writeFileSync(path.join(planDir, 'TP-999-测试作业-测试计划.md'), '# 计划', 'utf8');

    const index = buildPrdIndex({
      rootDir: path.join(root, 'prd'),
      testPlanRoot: planDir,
      pageMap: { pages: [{ id: 'test-page', name: '测试作业' }] },
    });

    expect(index.entries).toHaveLength(1);
    expect(index.entries[0]).toMatchObject({
      workItem: '测试作业',
      prdVersion: '1.10',
      pageId: 'test-page',
      testPlanIds: ['TP-999'],
      entity: 'test_doc',
      fieldCount: 1,
      versionCount: 2,
    });
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('校验重复条目与字段数不一致', () => {
  const entry = {
    workItem: 'A',
    pageId: null,
    testPlanIds: [],
    fileName: 'APRD.v1.0.md',
    relativePath: 'A/APRD.v1.0.md',
    prdVersion: '1.0',
    modifiedAt: '2026-11-06T00:00:00.000Z',
    title: 'A',
    prdType: '表单',
    entity: 'a',
    entityLabel: 'A',
    application: 'smbcloud',
    sections: [],
    subsections: [],
    fieldCount: 1,
    fields: [],
    versionCount: 1,
  };
  expect(validatePrdIndex({ entries: [entry, { ...entry }] }).join('\n')).toContain('重复');
  expect(validatePrdIndex({ entries: [entry] }).join('\n')).toContain('fieldCount');
});

test('按标题片段读取 PRD 章节', () => {
  const content = [
    '# 测试单',
    '## 二、业务说明',
    '### 2.3 业务流程图',
    '| 序 | 环节 | 说明 |',
    '| 1 | 新增 | 打开详情 |',
    '### 2.4 联动规则',
    '规则正文',
    '## 三、功能说明',
    '字段正文',
  ].join('\n');

  const section = readPrdSection(content, '2.3');
  expect(section).toContain('业务流程图');
  expect(section).toContain('打开详情');
  expect(section).not.toContain('联动规则');
  expect(readPrdSection(content, '不存在')).toBeNull();
});
