import { expect, test } from '@playwright/test';
import { loadFieldRuleSets, rulesForPage } from '../../src/platform/rules/loader';
import { evaluateFieldRule, evaluateFieldRuleSet, FieldRule, FieldState } from '../../src/platform/rules/engine';

const sourceRef = { document_id: 'RULE-X', file_path: 'artifacts/modules/purchase/knowledge/rules.json', source_type: 'PRD_DERIVED' as const };

function rule(overrides: Partial<FieldRule> = {}): FieldRule {
  return {
    id: 'FR-TEST-1',
    type: 'REQUIRED',
    field: 'po.supp_no',
    trigger: 'FORM_OPEN',
    expected: { required: true },
    status: 'verified',
    source_ref: sourceRef,
    ...overrides,
  };
}

function state(overrides: Partial<FieldState> = {}): FieldState {
  return { value: '', required: false, readonly: false, disabled: false, visible: true, label: '供应商', ...overrides };
}

test.describe('字段规则加载', () => {
  test('采购订单规则集通过契约且规则均可追溯', () => {
    const loaded = loadFieldRuleSets(process.cwd(), 'purchase');
    expect(loaded.issues).toEqual([]);
    const rules = rulesForPage(loaded.sets, 'purchase-order');
    expect(rules.length).toBeGreaterThanOrEqual(10);
    expect(rules.every((entry) => entry.source_ref.document_id.length > 0)).toBe(true);
    expect(rules.some((entry) => entry.type === 'REQUIRED')).toBe(true);
    expect(rules.some((entry) => entry.type === 'DEFAULT_VALUE')).toBe(true);
    expect(rules.some((entry) => entry.type === 'LINKAGE')).toBe(true);
  });
});

test.describe('字段规则求值', () => {
  test('必填标记匹配', () => {
    const context = { before: { fields: { 'po.supp_no': state({ required: true }) } } };
    expect(evaluateFieldRule(rule(), context).status).toBe('passed');
    context.before.fields['po.supp_no'] = state({ required: false });
    expect(evaluateFieldRule(rule(), context).status).toBe('failed');
  });

  test('只读规则匹配', () => {
    const readonly = rule({ type: 'READONLY', expected: { readonly: true } });
    const context = { before: { fields: { 'po.supp_no': state({ readonly: true }) } } };
    expect(evaluateFieldRule(readonly, context).status).toBe('passed');
    context.before.fields['po.supp_no'] = state({ readonly: false });
    expect(evaluateFieldRule(readonly, context).status).toBe('failed');
  });

  test('默认值与联动在变更后快照求值', () => {
    const linkage = rule({ type: 'LINKAGE', field: 'po.ccy_no', trigger: 'ON_CHANGE', when: { field: 'po.supp_no', state: 'not_empty' }, expected: { value_mode: 'not_empty' } });
    const context = {
      before: { fields: { 'po.ccy_no': state({ value: '' }), 'po.supp_no': state({ value: '' }) } },
      after: { fields: { 'po.ccy_no': state({ value: 'RMB' }), 'po.supp_no': state({ value: 'SUPP-1001' }) } },
    };
    expect(evaluateFieldRule(linkage, context).status).toBe('passed');
    context.after.fields['po.ccy_no'] = state({ value: '' });
    expect(evaluateFieldRule(linkage, context).status).toBe('failed');
  });

  test('触发条件不满足时联动跳过', () => {
    const linkage = rule({ type: 'LINKAGE', field: 'po.ccy_no', trigger: 'ON_CHANGE', when: { field: 'po.supp_no', state: 'not_empty' }, expected: { value_mode: 'not_empty' } });
    const context = { before: { fields: { 'po.ccy_no': state(), 'po.supp_no': state() } }, after: { fields: { 'po.ccy_no': state(), 'po.supp_no': state() } } };
    expect(evaluateFieldRule(linkage, context).status).toBe('skipped');
  });

  test('保存拦截规则读取保存结果', () => {
    const saveBlock = rule({ type: 'SAVE_BLOCK', trigger: 'SAVE', expected: { blocked: true, message_contains: '不能' } });
    const context = { before: { fields: {} }, save: { attempted: true, blocked: true, message: '输入参数po.supp_no不能缺失或者为空' } };
    expect(evaluateFieldRule(saveBlock, context).status).toBe('passed');
    expect(evaluateFieldRule(saveBlock, { ...context, save: { attempted: true, blocked: false, message: '操作成功' } }).status).toBe('failed');
  });

  test('未渲染字段跳过而不是失败', () => {
    const context = { before: { fields: { 'po.supp_no': state({ visible: false }) } } };
    const result = evaluateFieldRule(rule(), context);
    expect(result.status).toBe('skipped');
    expect(result.message).toBe('FIELD_NOT_RENDERED');
  });

  test('候选规则违反记为 warning 且不阻塞通过', () => {
    const candidate = rule({ status: 'candidate' });
    const evaluation = evaluateFieldRuleSet([candidate], { before: { fields: { 'po.supp_no': state({ required: false }) } } });
    expect(evaluation.failed).toBe(0);
    expect(evaluation.warnings).toBe(1);
    expect(evaluation.passed).toBe(true);
  });

  test('changed 条件只在依赖字段实际变化时求值', () => {
    const changedRule = rule({
      type: 'DISABLED',
      field: 'po.ccy_no',
      trigger: 'ON_CHANGE',
      when: { field: 'po.supp_no', state: 'changed' },
      expected: { disabled: true },
    });
    const before = { fields: { 'po.supp_no': state({ value: '' }), 'po.ccy_no': state({ disabled: true }) } };
    const after = { fields: { 'po.supp_no': state({ value: 'SUPP-1001' }), 'po.ccy_no': state({ disabled: true }) } };
    expect(evaluateFieldRule(changedRule, { before, after }).status).toBe('passed');
    const unchanged = { fields: { 'po.supp_no': state({ value: 'SUPP-1001' }) } };
    expect(evaluateFieldRule(changedRule, { before: unchanged, after: unchanged }).status).toBe('skipped');
  });

  test('when 条件对非联动规则同样生效', () => {
    const conditional = rule({ type: 'REQUIRED', when: { field: 'po.supp_no', state: 'empty' } });
    const context = { before: { fields: { 'po.supp_no': state({ value: 'SUPP-1001' }), 'po.supp_no.required': state() } } };
    expect(evaluateFieldRule(conditional, context).status).toBe('skipped');
  });

  test('唯一性规则读取探测结果', () => {
    const uniqueRule = rule({ type: 'UNIQUE', trigger: 'SAVE', expected: { unique: true, message_contains: '已存在' } });
    const base = { before: { fields: { 'po.supp_no': state({ value: 'SUPP-1001' }) } } };
    expect(
      evaluateFieldRule(uniqueRule, { ...base, unique: { 'po.supp_no': { attempted: true, blocked: true, message: '供应商编号已存在' } } }).status,
    ).toBe('passed');
    expect(
      evaluateFieldRule(uniqueRule, { ...base, unique: { 'po.supp_no': { attempted: true, blocked: false, message: '操作成功' } } }).status,
    ).toBe('failed');
    expect(evaluateFieldRule(uniqueRule, base).status).toBe('skipped');
  });

  test('最大长度规则比对 maxlength', () => {
    const lengthRule = rule({ type: 'MAX_LENGTH', expected: { max_length: 20 } });
    expect(evaluateFieldRule(lengthRule, { before: { fields: { 'po.supp_no': state({ maxLength: 20 }) } } }).status).toBe('passed');
    expect(evaluateFieldRule(lengthRule, { before: { fields: { 'po.supp_no': state({ maxLength: 10 }) } } }).status).toBe('failed');
    expect(evaluateFieldRule(lengthRule, { before: { fields: { 'po.supp_no': state({ maxLength: -1 }) } } }).status).toBe('skipped');
  });

  test('格式规则使用正则校验字段值', () => {
    const formatRule = rule({ type: 'FORMAT', expected: { value: '^ZTEST\\d+$' } });
    expect(evaluateFieldRule(formatRule, { before: { fields: { 'po.supp_no': state({ value: 'ZTEST001' }) } } }).status).toBe('passed');
    expect(evaluateFieldRule(formatRule, { before: { fields: { 'po.supp_no': state({ value: 'ABC' }) } } }).status).toBe('failed');
    expect(evaluateFieldRule(formatRule, { before: { fields: { 'po.supp_no': state({ value: '' }) } } }).status).toBe('skipped');
  });

  test('数值范围规则处理边界与非数值', () => {
    const rangeRule = rule({ type: 'RANGE', expected: { min: 1, max: 10 } });
    expect(evaluateFieldRule(rangeRule, { before: { fields: { 'po.supp_no': state({ value: '5' }) } } }).status).toBe('passed');
    expect(evaluateFieldRule(rangeRule, { before: { fields: { 'po.supp_no': state({ value: '10' }) } } }).status).toBe('passed');
    expect(evaluateFieldRule(rangeRule, { before: { fields: { 'po.supp_no': state({ value: '11' }) } } }).status).toBe('failed');
    expect(evaluateFieldRule(rangeRule, { before: { fields: { 'po.supp_no': state({ value: 'abc' }) } } }).status).toBe('failed');
  });
});
