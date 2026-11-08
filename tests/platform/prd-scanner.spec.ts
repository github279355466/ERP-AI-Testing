import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from '@playwright/test';
import YAML from 'yaml';
import { loadModuleSourceIndex } from '../../src/platform/prd/module-source';
import { scanModuleKnowledge } from '../../src/platform/prd/scan';
import { validateFile } from '../../src/platform/contracts/validator';

const SAMPLE_MD = `# 测试单据

**PRD类型**：表单

**版本**：V1.2

**业务对象**：测试单据（test_doc）

**数据模型**：\`test_doc\`（单头）/ \`test_doc_d\`（明细）

**所属应用**：smbcloud

## 一、变更日志

| 版本 | 日期 | 变更备注 |
| --- | --- | --- |
| V1.2 | 2026-11-01 | 初始化 |

## 二、业务说明

### 2.3 业务流程图

| 序 | 环节 | 说明 | 异常分支 |
| --- | --- | --- | --- |
| 1 | 进入作业 | 打开列表页 | 无 |
| 2 | 保存 | 校验后保存 | 校验失败 |

## 三、功能说明

### 测试单据详情页

#### 1. 测试单据

##### 单号 (doc_no)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 单号 |
| 填值方式 | 文本输入 |
| 字段含义 | 单据编号 |
| 是否必填 | ✅ 是 |
| 必填条件 |  |
| 是否只读 | ✅ 是 |
| 只读条件 |  |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 | 默认自动编号。时机点：默认执行时 |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 下拉项 |  |
| 校验项 | 1. 单号不可重复 |

## 四、操作说明

### 整体操作

#### 保存

| 控制项 | 说明 |
| --- | --- |
| 可用条件 | 无 |
| 展示设置 | 详情 |
| 操作前校验 | * 单号为空时 E+MSG："单号不可为空！" |
| 操作中处理 | * 调用 API：新增测试单据(bm.test_doc.create) |
| 操作后处理 | * 提示"保存成功" |

### 5.4 状态机

| 状态字段 | 流转 | 触发 |
| --- | --- | --- |
| 状态 \`manage_status\` | N.未审核 → Y.已审核 | 【审核】 |
`;

const tempRoots: string[] = [];

function makeRepo(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-p2-'));
  tempRoots.push(root);
  fs.mkdirSync(path.join(root, 'prd', 'ModuleA'), { recursive: true });
  fs.mkdirSync(path.join(root, 'prd', 'Other'), { recursive: true });
  fs.writeFileSync(path.join(root, 'prd', 'ModuleA', 'DOC1_测试单据_V1.2.md'), SAMPLE_MD, 'utf8');
  fs.writeFileSync(path.join(root, 'prd', 'Other', 'DOC2_其他单据_V1.0.md'), SAMPLE_MD.replace('测试单据', '其他单据'), 'utf8');

  const sourceDir = path.join(root, 'business-modules', 'demo', 'source-index');
  fs.mkdirSync(sourceDir, { recursive: true });
  fs.writeFileSync(
    path.join(sourceDir, 'index.yaml'),
    YAML.stringify({
      schema_version: '1.0',
      module_id: 'demo',
      module_name: '示例模块',
      prd_roots: ['${PRD_WORKSPACE}/prd'],
      include_paths: ['ModuleA/'],
      scenario_sources: [],
      module_rules: [{ pattern: '^.*$', module: '示例模块' }],
    }),
    'utf8',
  );
  return root;
}

afterAll(() => {
  for (const root of tempRoots) fs.rmSync(root, { recursive: true, force: true });
});

describe('模块化 PRD 扫描', () => {
  test('解析来源索引并限制 include_paths', () => {
    const root = makeRepo();
    const source = loadModuleSourceIndex({
      repoRoot: root,
      moduleId: 'demo',
      env: { ...process.env, PRD_WORKSPACE: root },
    });
    expect(source.index.module_id).toBe('demo');
    expect(source.prdRoots[0]).toBe(path.join(root, 'prd'));

    const result = scanModuleKnowledge({
      repoRoot: root,
      moduleId: 'demo',
      env: { ...process.env, PRD_WORKSPACE: root },
    });
    expect(result.pipeline.bundle.documents.length).toBe(1);
    expect(result.pipeline.bundle.documents[0].relative_path).toContain('ModuleA/');
    expect(result.pipeline.bundle.documents[0].source_refs.length).toBeGreaterThan(0);
    expect(result.summary.validation.valid).toBe(true);
    expect(fs.existsSync(result.summaryPath)).toBe(true);
    expect(fs.existsSync(result.glossaryPath)).toBe(true);
  });

  test('生成术语表并保留实体/字段来源', () => {
    const root = makeRepo();
    const result = scanModuleKnowledge({
      repoRoot: root,
      moduleId: 'demo',
      env: { ...process.env, PRD_WORKSPACE: root },
    });
    expect(result.glossary.some((term) => term.term.includes('测试单据') && term.kind === 'ENTITY')).toBe(true);
    expect(result.glossary.some((term) => term.term.includes('单号') && term.kind === 'FIELD')).toBe(true);
    expect(result.glossary.every((term) => term.source_refs.length > 0)).toBe(true);
  });

  test('增量扫描识别修改文件', () => {
    const root = makeRepo();
    const env = { ...process.env, PRD_WORKSPACE: root };
    scanModuleKnowledge({ repoRoot: root, moduleId: 'demo', env });
    const file = path.join(root, 'prd', 'ModuleA', 'DOC1_测试单据_V1.2.md');
    fs.appendFileSync(file, '\n\n补充说明：仅用于增量扫描测试。\n', 'utf8');
    const result = scanModuleKnowledge({ repoRoot: root, moduleId: 'demo', env, incremental: true });
    expect(result.pipeline.scan.summary.modified_documents).toBeGreaterThan(0);
    expect(result.pipeline.bundle.documents[0].last_scan_status).toBe('MODIFIED');
  });

  test('未解析的环境变量被拒绝', () => {
    const root = makeRepo();
    expect(() =>
      loadModuleSourceIndex({
        repoRoot: root,
        moduleId: 'demo',
        env: {},
      }),
    ).toThrow(/未解析变量/);
  });

  test('来源索引缺少必填字段被拒绝', () => {
    const root = makeRepo();
    const file = path.join(root, 'business-modules', 'demo', 'source-index', 'index.yaml');
    fs.writeFileSync(file, YAML.stringify({ schema_version: '1.0', module_id: 'demo' }), 'utf8');
    const result = validateFile(file, 'source-index');
    expect(result.valid).toBe(false);
  });
});
