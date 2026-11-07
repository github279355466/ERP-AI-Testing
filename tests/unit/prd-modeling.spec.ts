import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { extractCaseLibrary } from '../../src/prd/cases';
import { extractPrdDocument } from '../../src/prd/extract';
import { computeCoverage, detectVersionConflicts, markLatestDocuments } from '../../src/prd/link';
import { parseMarkdown, parsePrdJsonPayload } from '../../src/prd/parsers';
import { buildKnowledge } from '../../src/prd/pipeline';
import { generateScenarios } from '../../src/prd/scenarios';
import { scanSources, writeScanState } from '../../src/prd/scanner';
import { DocumentRecord, Entity, PARSER_VERSION, Rule, Scenario, KnowledgeBundle } from '../../src/prd/types';
import { validateKnowledgeBundle, validateScenario } from '../../src/prd/validate';

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

function makeTempRoot(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'athena-prd-'));
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
  return config;
}

function writeSamplePrd(root: string): string {
  const dir = path.join(root, 'prd', '测试单据');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, '测试单据PRD.v1.2.md');
  fs.writeFileSync(file, SAMPLE_MD, 'utf8');
  return dir;
}

test('Markdown 解析保留标题层级、表格与行号', () => {
  const parsed = parseMarkdown(SAMPLE_MD);
  expect(parsed.headings[0]).toMatchObject({ level: 1, text: '测试单据', line: 1 });
  expect(parsed.headings.some((heading) => heading.level === 5 && heading.text.includes('单号'))).toBe(true);
  const fieldTable = parsed.tables.find((table) => table.header.includes('字段项'));
  expect(fieldTable).toBeTruthy();
  expect(fieldTable?.rows.length).toBeGreaterThan(10);
  expect(fieldTable?.lineStart).toBeGreaterThan(1);
  expect(fieldTable?.sectionPath).toContain('测试单据详情页');
});

test('平台 JSON 支持 data.params.prd_spec 与根级 prd_spec 两种包装', () => {
  const spec = {
    prd_file_no: 'DOC-1',
    biz_model_no: 'item_gen_info',
    biz_model_name: '品号通用信息',
    application: 'smbcloud',
    biz_model_version: '1.9',
    prd_spec_attr_func_cfg: [
      {
        seq: 1,
        field_no: 'item_no',
        field_name: '品号',
        reg_obj_en_sname: 'item_gen_info',
        reg_obj_zh_name: '品号通用信息',
        field_attr_cfg_cont: JSON.stringify({
          title: '品号',
          def_v: '',
          cnst: { reqd: { on: true, cond: '始终必填' }, read: { on: false } },
        }),
      },
    ],
    prd_spec_opr_func_cfg: [],
    prd_spec_chg_log: [],
  };
  const nested = parsePrdJsonPayload(JSON.stringify({ data: { params: { prd_spec: [spec] } } }));
  const rootLevel = parsePrdJsonPayload(JSON.stringify({ prd_spec: [spec] }));
  expect(nested?.attrs[0].required).toBe(true);
  expect(rootLevel?.attrs[0].fieldNo).toBe('item_no');
  expect(nested?.bizModelNo).toBe('item_gen_info');
});

test('Markdown 抽取字段、动作、状态机与证据行号', () => {
  const root = makeTempRoot();
  const dir = writeSamplePrd(root);
  const config = makeConfig(root);
  const scan = scanSources(config, 'FULL');
  const file = scan.files.find((item) => item.supported);
  expect(file).toBeTruthy();
  const extracted = extractPrdDocument(file!, config, new Date().toISOString());

  expect(extracted.document.doc_version).toBe('1.2');
  expect(extracted.document.relative_path).toContain('测试单据');
  expect(extracted.entities.some((entity) => entity.entity_no === 'test_doc')).toBe(true);
  expect(extracted.fields).toHaveLength(1);
  const field = extracted.fields[0];
  expect(field.field_no).toBe('doc_no');
  expect(field.required).toBe(true);
  expect(field.readonly).toBe(true);
  expect(field.default_value).toContain('自动编号');
  expect(field.source_refs[0].line_start).toBeGreaterThan(0);

  const ruleTypes = extracted.rules.map((rule) => rule.rule_type);
  expect(ruleTypes).toContain('REQUIRED');
  expect(ruleTypes).toContain('READONLY');
  expect(ruleTypes).toContain('DEFAULT_VALUE');
  expect(ruleTypes).toContain('STATE_TRANSITION');

  const stateRule = extracted.rules.find((rule) => rule.rule_type === 'STATE_TRANSITION');
  expect(stateRule?.description).toContain('N.未审核');
  expect(stateRule?.description).toContain('Y.已审核');

  expect(extracted.actions.map((action) => action.action_name)).toContain('保存');
  const save = extracted.actions.find((action) => action.action_name === '保存');
  expect(save?.apis).toContain('bm.test_doc.create');
  expect(extracted.workflows[0].steps).toHaveLength(2);

  for (const rule of extracted.rules) {
    expect(rule.source_refs.length).toBeGreaterThan(0);
    expect(rule.source_refs[0].document_id).toBe(extracted.document.id);
  }
  expect(dir).toContain('测试单据');
});

test('扫描器识别新增、未变化、修改与源文件缺失', () => {
  const root = makeTempRoot();
  const dir = writeSamplePrd(root);
  const config = makeConfig(root);

  const first = scanSources(config, 'FULL');
  expect(first.summary.new_documents).toBe(1);
  writeScanState(config, first.state);

  const second = scanSources(config, 'INCREMENTAL');
  expect(second.summary.unchanged_documents).toBe(1);
  expect(second.summary.new_documents).toBe(0);

  fs.appendFileSync(path.join(dir, '测试单据PRD.v1.2.md'), '\n<!-- changed -->\n', 'utf8');
  const third = scanSources(config, 'INCREMENTAL');
  expect(third.summary.modified_documents).toBe(1);

  fs.unlinkSync(path.join(dir, '测试单据PRD.v1.2.md'));
  const fourth = scanSources(config, 'INCREMENTAL');
  expect(fourth.summary.missing_documents).toBe(1);
});

test('同一业务对象多版本产生版本冲突问题', () => {
  const now = new Date().toISOString();
  const base = {
    object_type: 'Document' as const,
    module: '测试',
    status: 'ACTIVE' as const,
    source_refs: [],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    file_path: '',
    file_name: '',
    sha256: 'a'.repeat(64),
    size_bytes: 1,
    modified_at: now,
    doc_date: '2026-11-01',
    doc_status: null,
    prd_type: null,
    business_object: null,
    biz_model_no: 'test_doc',
    application: 'smbcloud',
    entity_names: [],
    section_count: 1,
    table_count: 1,
    last_scan_status: 'NEW' as const,
    parser: 'markdown',
    source_role: 'PRD' as const,
    is_latest: true,
  };
  const documents = [
    { ...base, id: 'DOC-A', name: '测试单据', title: '测试单据', relative_path: '测试/v1.1.md', doc_version: '1.1' },
    { ...base, id: 'DOC-B', name: '测试单据', title: '测试单据', relative_path: '测试/v1.2.md', doc_version: '1.2' },
  ] as DocumentRecord[];
  const questions = detectVersionConflicts(documents, now);
  expect(questions).toHaveLength(1);
  expect(questions[0].category).toBe('VERSION_CONFLICT');
  expect(questions[0].question).toContain('1.2');

  const latest = markLatestDocuments(documents, new Set(['DOC-A', 'DOC-B']));
  expect(latest.has('DOC-B')).toBe(true);
  expect(documents.find((document) => document.id === 'DOC-A')?.is_latest).toBe(false);
});

test('证据缺失的明确规则会被校验拦截', () => {
  const rule: Rule = {
    id: 'RULE-X',
    object_type: 'Rule',
    name: '测试规则',
    module: '测试',
    status: 'ACTIVE',
    source_refs: [],
    created_by_parser_version: PARSER_VERSION,
    updated_at: new Date().toISOString(),
    description: '描述',
    rule_type: 'VALIDATION',
    source_type: 'PRD_EXPLICIT',
    confidence: 'CONFIRMED',
    applies_to: [],
    field_no: 'doc_no',
    field_name: '单号',
    trigger: 'SAVE',
    conditions: [],
    expected_result: '应提示',
    derivation: null,
    document_id: 'DOC-X',
    open_question_ids: [],
  };
  const entity: Entity = {
    id: 'ENT-X',
    object_type: 'Entity',
    name: '测试',
    module: '测试',
    status: 'ACTIVE',
    source_refs: [],
    created_by_parser_version: PARSER_VERSION,
    updated_at: rule.updated_at,
    entity_no: 'test_doc',
    label: '测试',
    parent_entity_no: null,
    document_ids: ['DOC-X'],
    field_count: 0,
    page_count: 0,
    rule_count: 0,
  };
  const document = {
    id: 'DOC-X',
    object_type: 'Document',
    name: '测试',
    module: '测试',
    status: 'ACTIVE',
    source_refs: [],
    created_by_parser_version: PARSER_VERSION,
    updated_at: rule.updated_at,
    file_path: '',
    relative_path: '测试/doc.md',
    file_name: 'doc.md',
    sha256: 'b'.repeat(64),
    size_bytes: 1,
    modified_at: rule.updated_at,
    title: '测试',
    doc_version: '1.0',
    doc_date: null,
    doc_status: null,
    prd_type: null,
    business_object: null,
    biz_model_no: 'test_doc',
    application: 'smbcloud',
    entity_names: [],
    section_count: 1,
    table_count: 1,
    last_scan_status: 'NEW',
    parser: 'markdown',
    source_role: 'PRD',
    is_latest: true,
  } as DocumentRecord;
  const bundle: KnowledgeBundle = {
    documents: [document],
    entities: [entity],
    pages: [],
    fields: [],
    controls: [],
    rules: [rule],
    actions: [],
    workflows: [],
    dependencies: [],
    scenarios: [],
    existingCases: [],
    openQuestions: [],
    issues: [],
    scan: {
      scanned_at: rule.updated_at,
      source_root: '',
      total_files: 1,
      supported_files: 1,
      unsupported_files: 0,
      new_documents: 1,
      modified_documents: 0,
      unchanged_documents: 0,
      missing_documents: 0,
      parse_errors: 0,
      mode: 'FULL',
    },
  };
  const result = validateKnowledgeBundle(bundle);
  expect(result.valid).toBe(false);
  expect(result.errors.some((issue) => issue.code === 'RULE_EVIDENCE_MISSING')).toBe(true);
});

test('场景必须是 DRAFT 且引用规则，否则校验失败', () => {
  const scenario: Scenario = {
    id: 'SCN-X',
    object_type: 'Scenario',
    name: '场景',
    title: '场景',
    test_objective: '验证必填校验',
    module: '测试',
    status: 'APPROVED',
    source_refs: [],
    created_by_parser_version: PARSER_VERSION,
    updated_at: new Date().toISOString(),
    scenario_type: '必填校验',
    automation_feasibility: 'UI_READY',
    business_object: null,
    preconditions: [],
    data_requirements: [],
    steps: [],
    assertions: [],
    expected_result: '提示不可为空',
    evidence_requirements: ['截图'],
    rule_ids: [],
    document_ids: [],
    case_ids: [],
    review_required: true,
    origin: 'GENERATED',
  };
  const issues = validateScenario(scenario);
  expect(issues.some((issue) => issue.code === 'SCENARIO_STATUS_NOT_DRAFT')).toBe(true);
  expect(issues.some((issue) => issue.code === 'SCENARIO_RULE_MISSING')).toBe(true);
});

test('场景生成只使用最新版文档且全部为 DRAFT', () => {
  const now = new Date().toISOString();
  const rule = (id: string, documentId: string, type: Rule['rule_type']): Rule => ({
    id,
    object_type: 'Rule',
    name: `${id} 规则`,
    module: '测试',
    status: 'ACTIVE',
    source_refs: [{ document_id: documentId, file_path: 'a.md', line_start: 1 }],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    description: '描述',
    rule_type: type,
    source_type: 'PRD_EXPLICIT',
    confidence: 'CONFIRMED',
    applies_to: [],
    field_no: 'doc_no',
    field_name: '单号',
    trigger: 'SAVE',
    conditions: [],
    expected_result: '应拦截',
    derivation: null,
    document_id: documentId,
    open_question_ids: [],
  });
  const bundle = {
    rules: [rule('R1', 'DOC-NEW', 'REQUIRED'), rule('R2', 'DOC-OLD', 'REQUIRED')],
    entities: [],
    documents: [],
  } as unknown as KnowledgeBundle;
  const scenarios = generateScenarios(bundle, new Set(['DOC-NEW']));
  expect(scenarios).toHaveLength(1);
  expect(scenarios[0].status).toBe('DRAFT');
  expect(scenarios[0].rule_ids).toEqual(['R1']);
});

test('批量用例通过断言字段目标参与覆盖率匹配', () => {
  const now = new Date().toISOString();
  const rules: Rule[] = [
    {
      id: 'RULE-1',
      object_type: 'Rule',
      name: '单号 只读',
      module: '测试',
      status: 'ACTIVE',
      source_refs: [{ document_id: 'DOC-1', file_path: 'a.md', line_start: 1 }],
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      description: '只读',
      rule_type: 'READONLY',
      source_type: 'PRD_EXPLICIT',
      confidence: 'CONFIRMED',
      applies_to: [],
      field_no: 'doc_no',
      field_name: '单号',
      trigger: 'FORM_OPEN',
      conditions: [],
      expected_result: '不可编辑',
      derivation: null,
      document_id: 'DOC-1',
      open_question_ids: [],
    },
  ];
  const cases = [
    {
      case_id: 'TC-1',
      package: '测试',
      module: '测试',
      title: '批量只读',
      category: 'readonly',
      priority: 'P1',
      rule_ids: [],
      object: '测试单据',
      field: null,
      field_nos: ['doc_no'],
      needs_confirm: false,
      assertion_types: ['ui_state'],
      document_id: 'DOC-CASE',
    },
  ];
  const coverage = computeCoverage(rules, cases, []);
  expect(coverage.covered_rule_ids.has('RULE-1')).toBe(true);
  expect(coverage.matched_case_ids.has('TC-1')).toBe(true);
  expect(coverage.unmatched_cases).toHaveLength(0);
});

test('测试用例库读取兼容 v2 的 objectRef 与 fieldRef', () => {
  const root = makeTempRoot();
  const dir = path.join(root, '测试用例', '基础资料域', '测试作业');
  fs.mkdirSync(dir, { recursive: true });
  const payload = {
    meta: { name: '测试作业', version: 'V1.0', bizModelNo: 'test_doc', application: 'smbcloud' },
    caseCount: 1,
    cases: [
      {
        caseId: 'TC-T-0001',
        title: '单号必填',
        category: 'required',
        priority: 'P0',
        ruleId: 'F-001',
        objectRef: { entity: 'test_doc', objectPath: 'test_doc', label: '测试单据' },
        fieldRef: { fieldNo: 'doc_no', label: '单号' },
        needsConfirm: false,
      },
    ],
  };
  fs.writeFileSync(path.join(dir, 'test-cases.json'), JSON.stringify(payload), 'utf8');
  fs.writeFileSync(
    path.join(dir, 'assertions.json'),
    JSON.stringify({
      assertions: {
        'TC-T-0001': [{ type: 'error_message', target: { objectPath: 'test_doc', fieldNo: 'doc_no' } }],
      },
    }),
    'utf8'
  );
  const config = makeConfig(root);
  const scan = scanSources(config, 'FULL');
  const file = scan.files.find((item) => item.role === 'TEST_CASE_LIBRARY' && item.file_name === 'test-cases.json');
  const extracted = extractCaseLibrary(file!, new Date().toISOString());
  expect(extracted?.cases[0]).toMatchObject({
    case_id: 'TC-T-0001',
    field: '单号',
    field_no: 'doc_no',
    object: '测试单据',
  });
  expect(extracted?.cases[0].field_nos).toContain('doc_no');
});

test('端到端：扫描、建模、校验、报告全部产出', () => {
  const root = makeTempRoot();
  writeSamplePrd(root);
  const config = makeConfig(root);
  const result = buildKnowledge(config, 'FULL', { useCache: false });

  expect(result.validation.valid).toBe(true);
  expect(result.bundle.documents.length).toBe(1);
  expect(result.bundle.fields.length).toBe(1);
  expect(result.bundle.scenarios.length).toBeGreaterThan(0);
  expect(result.bundle.scenarios.every((scenario) => scenario.status === 'DRAFT')).toBe(true);

  for (const file of [
    'PRD_INDEX.md',
    'PRD_ANALYSIS_REPORT.md',
    'COVERAGE_MATRIX.md',
    'OPEN_QUESTIONS.md',
    'VERSION_CONFLICTS.md',
    'PARSE_ERRORS.md',
  ]) {
    expect(fs.existsSync(path.join(config.output.reportDir, file))).toBe(true);
  }
  expect(fs.existsSync(path.join(config.output.sourceIndexDir, 'DOCUMENT_REGISTER.json'))).toBe(true);
  expect(fs.existsSync(path.join(config.output.knowledgeDir, 'rules.json'))).toBe(true);
});
