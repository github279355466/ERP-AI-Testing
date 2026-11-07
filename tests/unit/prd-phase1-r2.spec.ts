import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { buildKnowledge } from '../../src/prd/pipeline';
import { KnowledgeBundle } from '../../src/prd/types';
import { buildEntityRelations } from '../../src/prd/relations';
import { Dependency, DocumentRecord, Entity, OpenQuestion } from '../../src/prd/types';
import { resolveJsonPath, validateKnowledgeBundle } from '../../src/prd/validate';

const SAMPLE_MD = `# 测试单据

**PRD类型**：表单

**版本**：V1.0

**业务对象**：测试单据（test_doc）

**数据模型**：\`test_doc\`（单头）

**所属应用**：smbcloud

## 一、功能说明

### 测试单据详情页

#### 1. 测试单据

##### 单号 (doc_no)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 单号 |
| 填值方式 | 文本输入 |
| 是否必填 | ✅ 是 |
| 必填条件 | 新增时必填 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 校验项 | 1. 单号不可重复。 |

##### 备注 (remark)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 备注 |
| 填值方式 | 文本输入 |
| 是否必填 | ✅ 否 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 校验项 |  |

##### 说明 (memo)

| 字段项 | 详细内容 |
| --- | --- |
| 标题名 | 说明 |
| 填值方式 | 文本输入 |
| 是否必填 | ✅ 否 |
| 是否只读 | ✅ 否 |
| 是否隐藏 | ✅ 否 |
| 是否禁用 | ✅ 否 |
| 默认值 |  |
| 开窗类型 | 无 |
| 开窗说明 |  |
| 校验项 | 1. 说明只读，不可修改。 |
`;

const JSON_ATTR = {
  id: 1,
  v_source: 0,
  cnst: {
    dis: {},
    hid: {},
    read: { on: true, cond: '始终只读' },
    reqd: { on: true, cond: '始终必填' },
    others: {},
  },
  v_type: ['0'],
  def_v: '系统带出',
  f_desc: '单号',
  input_desc: '不可修改',
  title: '单号',
  vals: [{ val_id: '', logic: '1.必填校验：为空时 E+MSG：「请录入单号！」' }],
  win_desc: '单选',
  win_type: '1',
  list_v: '',
};

const JSON_OPR = {
  avail_cond: '有新增权限',
  pre_check: '1.登录用户无权限时 E+MSG：「无权限！」',
  processing: '打开空白新增页',
  post_action: '停留在列表页',
  display_settings: ['列表'],
  rmk: '',
};

function jsonPayload(): string {
  return JSON.stringify(
    {
      data: {
        params: {
          prd_spec: [
            {
              prd_file_no: 'PRD-TEST-0001',
              prd_file_name: '测试单据',
              biz_model_no: 'test_doc',
              biz_model_name: '测试单据',
              biz_model_version: '1.0',
              application: 'smbcloud',
              prd_spec_attr_func_cfg: [
                {
                  seq: 1,
                  field_no: 'doc_no',
                  field_name: '单号',
                  reg_obj_en_sname: 'test_doc',
                  reg_obj_zh_name: '测试单据',
                  field_attr_cfg_cont: JSON.stringify(JSON_ATTR),
                },
              ],
              prd_spec_opr_func_cfg: [
                {
                  seq: 1,
                  opr_cntl_name: '保存',
                  opr_cntl_cfg_cont: JSON.stringify(JSON_OPR),
                },
              ],
            },
          ],
        },
      },
    },
    null,
    1
  );
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
  config.prd.moduleRules = [{ pattern: '^测试单据$', module: '基础资料' }];
  return config;
}

function seedProject(): { root: string; config: PrdModelingConfig; jsonFile: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-phase1-r2-'));
  const mdDir = path.join(root, 'prd', '测试单据');
  fs.mkdirSync(mdDir, { recursive: true });
  fs.writeFileSync(path.join(mdDir, '测试单据PRD.v1.0.md'), SAMPLE_MD, 'utf8');
  const jsonDir = path.join(root, 'prd', '测试单据JSON');
  fs.mkdirSync(jsonDir, { recursive: true });
  const jsonFile = path.join(jsonDir, '测试单据-v1.0.payload.json');
  fs.writeFileSync(jsonFile, jsonPayload(), 'utf8');
  return { root, config: makeConfig(root), jsonFile };
}

function scan(): { bundle: KnowledgeBundle; jsonDocumentId: string } {
  const { config } = seedProject();
  const result = buildKnowledge(config, 'FULL', { useCache: false });
  const jsonDocument = result.bundle.documents.find((item) => item.relative_path.endsWith('.json'));
  expect(jsonDocument).toBeTruthy();
  return { bundle: result.bundle, jsonDocumentId: jsonDocument!.id };
}

test('JSON 字段与操作规则使用 json_path 定位，且不再写行号 1', () => {
  const { bundle, jsonDocumentId } = scan();
  const jsonRules = bundle.rules.filter((rule) => rule.document_id === jsonDocumentId);
  expect(jsonRules.length).toBeGreaterThan(0);
  const payload = JSON.parse(fs.readFileSync(seedProject().jsonFile, 'utf8')) as unknown;
  for (const rule of jsonRules) {
    const ref = rule.source_refs[0];
    expect(ref.line_start).toBeUndefined();
    expect(ref.json_path).toBeTruthy();
    // 不允许再出现 JSON 首行 `{` 作为证据
    expect((ref.excerpt ?? '').trim()).not.toBe('{');
    expect(resolveJsonPath(payload, ref.json_path!).found).toBe(true);
  }
});

test('json_path 无法解析时报 EVIDENCE_JSON_PATH_UNRESOLVED', () => {
  const { bundle, jsonDocumentId } = scan();
  const rule = bundle.rules.find((item) => item.document_id === jsonDocumentId && item.source_refs[0].json_path);
  expect(rule).toBeTruthy();
  rule!.source_refs[0].json_path = 'data.params.prd_spec[0].prd_spec_attr_func_cfg[0].field_attr_cfg_cont.cnst.nope.on';
  const validation = validateKnowledgeBundle(bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'EVIDENCE_JSON_PATH_UNRESOLVED' && issue.object_id === rule!.id
    )
  ).toBe(true);
});

test('空校验项单元格不生成校验规则', () => {
  const { bundle } = scan();
  const remarkRules = bundle.rules.filter((rule) => rule.field_name === '备注');
  expect(remarkRules.some((rule) => rule.rule_type === 'VALIDATION')).toBe(false);
  expect(remarkRules.every((rule) => !/(^|\|)\s*$/.test((rule.source_refs[0].excerpt ?? '').trim()))).toBe(true);
});

test('负向：空单元格证据被 RULE_EMPTY_EVIDENCE 检出', () => {
  const { bundle } = scan();
  const rule = bundle.rules.find((item) => item.rule_type === 'REQUIRED');
  expect(rule).toBeTruthy();
  rule!.source_refs[0].excerpt = '| 校验项 |  |';
  const validation = validateKnowledgeBundle(bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'RULE_EMPTY_EVIDENCE' && issue.object_id === rule!.id
    )
  ).toBe(true);
});

test('校验项与状态行冲突时按状态行降级为 VALIDATION', () => {
  const { bundle } = scan();
  const memoRules = bundle.rules.filter((rule) => rule.field_name === '说明');
  expect(memoRules.length).toBeGreaterThan(0);
  expect(memoRules.some((rule) => rule.rule_type === 'READONLY')).toBe(false);
  expect(memoRules.some((rule) => rule.description.includes('只读'))).toBe(true);
  expect(
    bundle.openQuestions.some(
      (question) => question.category === 'RULE_CONTRADICTS_SOURCE' && question.question.includes('说明')
    )
  ).toBe(true);
});

test('负向：状态型规则与状态行矛盾时被 RULE_CONTRADICTS_SOURCE 检出', () => {
  const { bundle } = scan();
  const memo = bundle.fields.find((field) => field.label === '说明');
  expect(memo).toBeTruthy();
  const rule = bundle.rules.find((item) => item.field_no === memo!.field_no && item.rule_type === 'VALIDATION');
  expect(rule).toBeTruthy();
  rule!.rule_type = 'READONLY';
  const validation = validateKnowledgeBundle(bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'RULE_CONTRADICTS_SOURCE' && issue.object_id === rule!.id
    )
  ).toBe(true);
});

test('条件型规则证据直接指向条件行且摘录含条件原文', () => {
  const { bundle } = scan();
  const field = bundle.fields.find((item) => item.label === '单号');
  expect(field).toBeTruthy();
  const condLine = field!.attribute_lines?.['必填条件'];
  expect(condLine).toBeTruthy();
  const rule = bundle.rules.find((item) => item.field_no === field!.field_no && item.rule_type === 'REQUIRED');
  expect(rule).toBeTruthy();
  expect(rule!.source_refs[0].line_start).toBe(condLine);
  expect(rule!.source_refs[0].excerpt).toContain('新增时必填');
  const validation = validateKnowledgeBundle(bundle);
  expect(validation.errors.some((issue) => issue.code === 'EVIDENCE_NOT_COVERING_CONDITION')).toBe(false);
});

test('负向：条件型规则证据回退到状态行时报 EVIDENCE_NOT_COVERING_CONDITION', () => {
  const { bundle } = scan();
  const field = bundle.fields.find((item) => item.label === '单号');
  const rule = bundle.rules.find((item) => item.field_no === field!.field_no && item.rule_type === 'REQUIRED');
  expect(rule).toBeTruthy();
  rule!.source_refs[0].line_start = field!.attribute_lines?.['是否必填'] ?? 1;
  rule!.source_refs[0].excerpt = '| 是否必填 | ✅ 是 |';
  const validation = validateKnowledgeBundle(bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'EVIDENCE_NOT_COVERING_CONDITION' && issue.object_id === rule!.id
    )
  ).toBe(true);
});

function relationFixture(body: string, selfNo = 'src_doc'): {
  relations: Dependency[];
  questions: OpenQuestion[];
} {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-rel-'));
  const file = path.join(root, '源单据PRD.v1.0.md');
  fs.writeFileSync(file, body, 'utf8');
  const document = {
    id: 'DOC-SRC',
    object_type: 'Document',
    name: '源单据',
    module: '采购',
    status: 'ACTIVE',
    file_path: file,
    relative_path: '采购域/源单据/源单据PRD.v1.0.md',
    file_name: '源单据PRD.v1.0.md',
    sha256: 'a'.repeat(64),
    title: '源单据',
    doc_version: '1.0',
    entity_names: ['源单据'],
    source_role: 'PRD',
    is_latest: true,
    job_directory: '源单据',
    supersedes: [],
    superseded_by: null,
    related_document_ids: [],
  } as unknown as DocumentRecord;
  const entity = (id: string, label: string, entityNo: string): Entity =>
    ({ id, object_type: 'Entity', name: label, label, entity_no: entityNo, module: '采购', status: 'ACTIVE', document_ids: [], field_count: 1 }) as Entity;
  const entities = [
    { ...entity('ENT-SRC', '源单据', selfNo), document_ids: ['DOC-SRC'] } as Entity,
    entity('ENT-OUT', '采购退货出库单', 'pur_rtn_stkou_doc'),
    entity('ENT-PO', '采购订单', 'po'),
  ];
  const questions: OpenQuestion[] = [];
  const relations = buildEntityRelations([document], entities, '2026-11-07T00:00:00.000Z', questions);
  return { relations, questions };
}

test('S-04 否定语义：不提供取单按钮不建立确认关系', () => {
  const { relations, questions } = relationFixture(`# 源单据

## 三、取单

本作业不提供【取单】按钮；《采购退货出库单》的五段式取单样式在本作业不适用，无需对齐。
`);
  expect(relations.filter((item) => item.relation_type === 'DERIVED_FROM')).toHaveLength(0);
  expect(questions.some((item) => item.category === 'NEGATED_RELATION')).toBe(true);
});

test('S-04 否定语义：不作为来源单据类型不建立确认关系', () => {
  const { relations } = relationFixture(`# 源单据

## 三、取单

主来源为采购退货单；采购订单不作为来源单据类型，仅作筛选条件。
`);
  expect(relations.some((item) => item.name.includes('采购订单') && item.relation_type === 'DERIVED_FROM')).toBe(false);
});

test('S-04 格式声明：五段式重写不建立确认关系', () => {
  const { relations } = relationFixture(`# 源单据

## 三、取单

取单块按《采购退货出库单》PRD 五段式重写（画面 / 字段说明 / 信息处理）。
`);
  expect(relations.filter((item) => item.relation_type === 'DERIVED_FROM')).toHaveLength(0);
});

test('S-04 正向：显式来源声明仍建立 DERIVED_FROM', () => {
  const { relations } = relationFixture(`# 源单据

## 三、取单

依据来源开启不同清单——采购订单、采购退货出库单。
`);
  expect(relations.some((item) => item.name.includes('采购订单') && item.relation_type === 'DERIVED_FROM')).toBe(true);
});

test('S-05 关系映射解析为字段级数组', () => {
  const { relations } = relationFixture(
    `# 源单据

## 三、取单

| 控制项 | 说明 |
| --- | --- |
| 操作中处理 | 依据来源类型开启不同清单——采购订单 |
| 操作后处理 | 单头带入（仅在目标字段为空时写入）： · 供应商编号 (pur_rtn_doc.supp_no) = 来源单据.供应商编号(po.supp_no / pur_arr_doc.supp_no) · 货币编号 (pur_rtn_doc.ccy_no) = 来源单据.货币编号(po.ccy_no / pur_arr_doc.ccy_no) · 含税标识 (pur_rtn_doc.intax_flag) = 来源单据.含税标识(po.intax_flag / pur_arr_doc.intax_flag) |
`,
    'pur_rtn_doc'
  );
  const relation = relations.find((item) => item.relation_type === 'DERIVED_FROM');
  expect(relation).toBeTruthy();
  expect(Array.isArray(relation!.mapping)).toBe(true);
  const mapping = relation!.mapping as Array<{ target: string; source: string }>;
  expect(mapping.length).toBeGreaterThanOrEqual(3);
  expect(mapping[0].target).toBe('pur_rtn_doc.supp_no');
  expect(mapping[0].source).toContain('po.supp_no');
});

test('S-05 负向：占位串映射被 RELATION_MAPPING_PLACEHOLDER 检出', () => {
  const { bundle } = scan();
  const relation: Dependency = {
    id: 'DEP-PLACEHOLDER',
    object_type: 'Dependency',
    name: '测试单据 ← 采购订单',
    module: '基础资料',
    status: 'ACTIVE',
    source_refs: [
      {
        document_id: bundle.documents[0].id,
        file_path: bundle.documents[0].relative_path,
        line_start: 1,
        excerpt: '依据来源开启不同清单——采购订单',
      },
    ],
    created_by_parser_version: 'test',
    updated_at: '2026-11-07T00:00:00.000Z',
    source_id: bundle.entities[0]?.id ?? 'ENT-X',
    target_id: null,
    target_ref: 'po',
    relation_type: 'DERIVED_FROM',
    mapping: '取单带入来源单据字段（详见原文取单章节）',
    source_type: 'PRD_EXPLICIT',
    confidence: 'CONFIRMED',
    document_id: bundle.documents[0].id,
  };
  bundle.dependencies.push(relation);
  const validation = validateKnowledgeBundle(bundle);
  expect(
    validation.errors.some(
      (issue) => issue.code === 'RELATION_MAPPING_PLACEHOLDER' && issue.object_id === 'DEP-PLACEHOLDER'
    )
  ).toBe(true);
});

test('S-05 方向修正：原文「生成下游单据」时关系方向反转并登记 OQ', () => {
  const { relations, questions } = relationFixture(`# 源单据

## 三、取单

审核时按退货出库规则生成并审核采购退货出库单。
`);
  const relation = relations.find((item) => item.name.includes('采购退货出库单'));
  expect(relation).toBeTruthy();
  expect(relation!.name).toBe('采购退货出库单 ← 源单据');
  expect(relation!.source_id).toBe('ENT-OUT');
  expect(questions.some((item) => item.category === 'RELATION_DIRECTION_FIXED')).toBe(true);
});
