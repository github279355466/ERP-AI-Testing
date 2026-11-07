import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadPrdConfig, PrdModelingConfig } from '../../src/prd/config';
import { buildKnowledge } from '../../src/prd/pipeline';
import { KnowledgeBundle } from '../../src/prd/types';
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
