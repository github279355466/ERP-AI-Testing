import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { versionFromFileName } from '../../src/prd/link';
import { buildKnowledge } from '../../src/prd/pipeline';
import { renderCoverageMatrix } from '../../src/prd/reports';
import { CoverageResult } from '../../src/prd/link';
import { KnowledgeBundle, SCHEMA_VERSION } from '../../src/prd/types';
import { validateKnowledgeBundle } from '../../src/prd/validate';
import { schemaFiles } from '../../src/prd/schema';

const SAMPLE_MD = `# 采购订单

**PRD类型**：表单

**版本**：V1.2

**业务对象**：采购订单（po）

**数据模型**：\`po\`（单头）

**所属应用**：smbcloud

## 一、业务流程图

| 序 | 环节 | 说明 | 异常分支 |
| --- | --- | --- | --- |
| 1 | 取单 | 从请购单取单 | 无 |
| 2 | 保存 | 校验后保存 | 校验失败 |

## 二、功能说明

### 采购订单详情页

#### 1. 采购订单

##### 单号 (doc_no)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 单号 |
| 填值方式 | 文本输入 |
| 字段含义 | 单据编号 |
| 是否必填 | ✅ 是 |
| 必填条件 | 新增时必填 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 下拉项 |  |
| 校验项 | 1. 单号不可重复。 |

## 三、操作说明

### 整体操作

#### 保存

| 控制项 | 说明 |
| --- | --- |
| 可用条件 | 单据未审核 |
| 展示设置 | 详情 |
| 操作前校验 | * 单号为空时 E+MSG："单号不可为空！" |
| 操作中处理 | * 调用 API：新增采购订单(bm.po.create) |
| 操作后处理 | * 回写来源请购单已下单数量 |
`;

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
  config.prd.moduleRules = [{ pattern: '^采购订单$', module: '采购' }];
  return config;
}

function seedProject(): { root: string; config: PrdModelingConfig; file: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase1-fix-'));
  const dir = path.join(root, 'prd', '采购订单');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '采购订单PRD.v1.2.md');
  fs.writeFileSync(file, SAMPLE_MD, 'utf8');
  return { root, config: makeConfig(root), file };
}

test('源文件删除后保留历史知识并标记 SOURCE_MISSING', () => {
  const { config, file } = seedProject();
  const first = buildKnowledge(config, 'FULL', { useCache: false });
  expect(first.bundle.rules.length).toBeGreaterThan(0);
  const ruleCount = first.bundle.rules.length;

  fs.unlinkSync(file);
  const second = buildKnowledge(config, 'INCREMENTAL', { useCache: true });
  const document = second.bundle.documents.find((item) => item.relative_path.includes('采购订单PRD'));
  expect(document).toBeTruthy();
  expect(document?.last_scan_status).toBe('SOURCE_MISSING');
  expect(document?.status).toBe('MISSING_SOURCE');
  expect(document?.is_latest).toBe(false);
  expect(second.bundle.rules.length).toBe(ruleCount);
  expect(second.bundle.openQuestions.some((question) => question.category === 'SOURCE_MISSING')).toBe(true);
  expect(second.bundle.scenarios.some((scenario) => scenario.document_ids.includes(document!.id))).toBe(false);

  const register = JSON.parse(
    fs.readFileSync(path.join(config.output.sourceIndexDir, 'DOCUMENT_REGISTER.json'), 'utf8')
  ) as { documents: Array<{ relative_path: string; status: string; is_latest: boolean }> };
  const entry = register.documents.find((item) => item.relative_path.includes('采购订单PRD'));
  expect(entry?.status).toBe('SOURCE_MISSING');
  expect(entry?.is_latest).toBe(false);
});

test('场景准入：推导规则必须 NEEDS_CONFIRMATION，且不存在 UI_READY', () => {
  const { config } = seedProject();
  const result = buildKnowledge(config, 'FULL', { useCache: false });
  expect(result.bundle.scenarios.length).toBeGreaterThan(0);
  expect(result.bundle.scenarios.every((scenario) => scenario.automation_feasibility !== 'UI_READY')).toBe(true);
  const ruleById = new Map(result.bundle.rules.map((rule) => [rule.id, rule]));
  for (const scenario of result.bundle.scenarios) {
    const rules = scenario.rule_ids.map((id) => ruleById.get(id)).filter(Boolean);
    const unconfirmed = rules.some(
      (rule) => rule!.source_type !== 'PRD_EXPLICIT' || rule!.confidence !== 'CONFIRMED'
    );
    const platformOnly = rules.length > 0 && rules.every((rule) => rule!.source_type === 'PLATFORM_SERVICE');
    if (unconfirmed && !platformOnly) {
      expect(scenario.automation_feasibility).toBe('NEEDS_CONFIRMATION');
    }
  }
});

test('明确规则证据逐字匹配原文并内嵌版本与哈希', () => {
  const { config, root } = seedProject();
  const result = buildKnowledge(config, 'FULL', { useCache: false });
  const rules = result.bundle.rules.filter((rule) => rule.source_type === 'PRD_EXPLICIT');
  expect(rules.length).toBeGreaterThan(0);
  const lines = fs.readFileSync(path.join(root, 'prd', '采购订单', '采购订单PRD.v1.2.md'), 'utf8').split(/\r?\n/);
  for (const rule of rules) {
    const ref = rule.source_refs[0];
    expect(ref.doc_version).toBe('1.2');
    expect(ref.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(ref.line_start).toBeTruthy();
    const raw = lines[(ref.line_start ?? 1) - 1].trim();
    expect(raw).toContain((ref.excerpt ?? '').replace(/…+$/, '').trim());
  }
});

test('证据逐字校验能覆盖 PRD 根目录之外的文档', () => {
  const { config, root } = seedProject();
  const result = buildKnowledge(config, 'FULL', { useCache: false });
  const document = result.bundle.documents[0];
  expect(document).toBeTruthy();

  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase1-external-'));
  const externalFile = path.join(elsewhere, 'DOC-EXTERNAL_采购订单_V1.2.md');
  fs.copyFileSync(path.join(root, 'prd', '采购订单', '采购订单PRD.v1.2.md'), externalFile);
  document.file_path = externalFile;
  document.relative_path = '外部用例库/采购订单/DOC-EXTERNAL_采购订单_V1.2.md';

  const rule = result.bundle.rules.find(
    (item) => item.source_type === 'PRD_EXPLICIT' && item.document_id === document.id
  );
  expect(rule).toBeTruthy();
  rule!.source_refs[0].excerpt = '原文中不存在的片段';

  const validation = validateKnowledgeBundle(result.bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'RULE_EXCERPT_NOT_VERBATIM' && issue.object_id === rule!.id
    )
  ).toBe(true);
});

test('校验器可检出场景引用推导规则但未标 NEEDS_CONFIRMATION', () => {
  const { config } = seedProject();
  const result = buildKnowledge(config, 'FULL', { useCache: false });
  const derived = result.bundle.rules.find((rule) => rule.source_type === 'PRD_DERIVED');
  expect(derived).toBeTruthy();
  const scenario = {
    ...result.bundle.scenarios[0],
    id: 'SCN-DERIVED-CHECK',
    rule_ids: [derived!.id],
    automation_feasibility: 'NEEDS_UI_EXPLORATION' as const,
  };
  result.bundle.scenarios.push(scenario);
  const validation = validateKnowledgeBundle(result.bundle);
  expect(validation.errors.some((issue) => issue.code === 'SCENARIO_DERIVED_NOT_CONFIRMED')).toBe(true);
});

test('版本号解析兼容 PRD.vX 与 _VX.md', () => {
  expect(versionFromFileName('采购订单PRD.v1.12.md')).toBe('1.12');
  expect(versionFromFileName('DOC415646892677804032_采购订单_V1.13.md')).toBe('1.13');
  expect(versionFromFileName('采购订单_说明.md')).toBeNull();
});

test('覆盖率矩阵按作业目录匹配，不再误报采购作业', () => {
  const bundle = {
    documents: [
      {
        id: 'DOC-1',
        relative_path: '采购域/采购退货单/采购退货单PRD.v1.11.md',
        job_directory: '采购退货单',
        source_role: 'PRD',
        module: '采购',
      },
    ],
    rules: [],
    scenarios: [],
    existingCases: [{ case_id: 'C-1', module: '采购退货单', category: 'required' }],
    scan: { scanned_at: '2026-11-07T00:00:00.000Z' },
  } as unknown as KnowledgeBundle;
  const coverage: CoverageResult = {
    covered_rule_ids: new Set(),
    case_ids_by_rule: new Map(),
    covered_by_category: new Map(),
    unmatched_cases: ['C-1'],
    matched_case_ids: new Set(),
    considered_rule_ids: new Set(),
    rules_considered: 0,
  };
  const report = renderCoverageMatrix(bundle, coverage);
  expect(report).not.toContain('PRD 作业目录无同名作业');
  expect(report).toContain('所有用例作业在 PRD 目录中均有同名目录');
});

test('13 类 JSON Schema 文件齐全且可被加载', () => {
  const files = schemaFiles();
  expect(files).toHaveLength(13);
  for (const file of files) expect(fs.existsSync(file)).toBe(true);
  expect(SCHEMA_VERSION).toBeTruthy();
});
