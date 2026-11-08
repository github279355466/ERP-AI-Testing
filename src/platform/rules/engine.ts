import { PlatformSourceRef } from '../plan/compile';

export type FieldRuleType = 'REQUIRED' | 'DEFAULT_VALUE' | 'LINKAGE' | 'READONLY' | 'DISABLED' | 'SAVE_BLOCK';
export type FieldRuleTrigger = 'FORM_OPEN' | 'ON_CHANGE' | 'SAVE';
export type FieldRuleStatus = 'verified' | 'candidate';

export interface FieldRule {
  id: string;
  type: FieldRuleType;
  field: string;
  trigger: FieldRuleTrigger;
  when?: { field: string; state: 'empty' | 'not_empty' | 'changed' };
  expected: {
    required?: boolean;
    readonly?: boolean;
    disabled?: boolean;
    blocked?: boolean;
    value_mode?: 'equals' | 'not_empty' | 'empty' | 'today' | 'regex';
    value?: string;
    message_contains?: string;
  };
  status: FieldRuleStatus;
  source_ref: PlatformSourceRef;
  notes?: string;
}

export interface FieldState {
  value: string;
  required: boolean;
  readonly: boolean;
  disabled: boolean;
  visible: boolean;
  label: string;
}

export interface FieldStateSnapshot {
  fields: Record<string, FieldState>;
}

export interface SaveOutcome {
  attempted: boolean;
  blocked: boolean;
  message: string;
}

export interface FieldRuleContext {
  before: FieldStateSnapshot;
  after?: FieldStateSnapshot;
  save?: SaveOutcome;
  now?: Date;
}

export type RuleResultStatus = 'passed' | 'failed' | 'warning' | 'skipped';

export interface FieldRuleResult {
  rule_id: string;
  type: FieldRuleType;
  field: string;
  status: RuleResultStatus;
  expected: string;
  actual: string;
  message?: string;
  source_ref: PlatformSourceRef;
}

export interface FieldRuleEvaluation {
  results: FieldRuleResult[];
  passed: boolean;
  failed: number;
  warnings: number;
  skipped: number;
}

function localDate(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

function matchValue(mode: NonNullable<FieldRule['expected']['value_mode']>, expected: string | undefined, actual: string, now: Date): boolean {
  const left = actual.replace(/\s+/g, ' ').trim();
  if (mode === 'not_empty') return left.length > 0;
  if (mode === 'empty') return left.length === 0;
  if (mode === 'today') return left.slice(0, 10) === localDate(now);
  if (mode === 'equals') return left === (expected ?? '').replace(/\s+/g, ' ').trim();
  if (mode === 'regex') {
    try {
      return new RegExp(expected ?? '').test(left);
    } catch {
      return false;
    }
  }
  return false;
}

function describeExpected(rule: FieldRule): string {
  const expected = rule.expected;
  if (rule.type === 'REQUIRED') return `required=${expected.required ?? true}`;
  if (rule.type === 'READONLY') return `readonly=${expected.readonly ?? true}`;
  if (rule.type === 'DISABLED') return `disabled=${expected.disabled ?? true}`;
  if (rule.type === 'SAVE_BLOCK') return `blocked=${expected.blocked ?? true}${expected.message_contains ? ` 且提示含「${expected.message_contains}」` : ''}`;
  return `${rule.type === 'LINKAGE' ? '联动' : '默认值'} ${expected.value_mode ?? 'not_empty'}${expected.value ? `:${expected.value}` : ''}`;
}

function describeActual(state: FieldState | undefined, save?: SaveOutcome): string {
  if (save) return `blocked=${save.blocked} message=${save.message.slice(0, 80)}`;
  if (!state) return '字段未渲染';
  if (!state.visible) return '字段不可见';
  return `value=${state.value.slice(0, 60)} required=${state.required} readonly=${state.readonly} disabled=${state.disabled}`;
}

export function evaluateFieldRule(rule: FieldRule, context: FieldRuleContext): FieldRuleResult {
  const now = context.now ?? new Date();
  const useAfter = rule.trigger === 'ON_CHANGE' || rule.type === 'LINKAGE';
  const snapshot = useAfter && context.after ? context.after : context.before;
  const state = snapshot.fields[rule.field];
  const base = { rule_id: rule.id, type: rule.type, field: rule.field, source_ref: rule.source_ref };

  if (rule.type === 'SAVE_BLOCK') {
    if (!context.save?.attempted) {
      return { ...base, status: 'skipped', expected: describeExpected(rule), actual: '未执行保存', message: 'SAVE_NOT_ATTEMPTED' };
    }
    const messageOk = !rule.expected.message_contains || context.save.message.includes(rule.expected.message_contains);
    const passed = context.save.blocked === (rule.expected.blocked ?? true) && messageOk;
    return { ...base, status: passed ? 'passed' : rule.status === 'candidate' ? 'warning' : 'failed', expected: describeExpected(rule), actual: describeActual(state, context.save) };
  }

  if (!state || !state.visible) {
    return { ...base, status: 'skipped', expected: describeExpected(rule), actual: describeActual(state), message: 'FIELD_NOT_RENDERED' };
  }

  if (rule.type === 'LINKAGE' && rule.when) {
    const whenState = snapshot.fields[rule.when.field];
    const whenEmpty = !whenState || whenState.value.trim() === '';
    if (rule.when.state === 'empty' && !whenEmpty) {
      return { ...base, status: 'skipped', expected: describeExpected(rule), actual: '触发条件不满足', message: 'WHEN_NOT_MATCHED' };
    }
    if (rule.when.state === 'not_empty' && whenEmpty) {
      return { ...base, status: 'skipped', expected: describeExpected(rule), actual: '触发条件不满足', message: 'WHEN_NOT_MATCHED' };
    }
  }

  let passed = false;
  if (rule.type === 'REQUIRED') passed = state.required === (rule.expected.required ?? true);
  else if (rule.type === 'READONLY') passed = state.readonly === (rule.expected.readonly ?? true);
  else if (rule.type === 'DISABLED') passed = state.disabled === (rule.expected.disabled ?? true);
  else passed = matchValue(rule.expected.value_mode ?? 'not_empty', rule.expected.value, state.value, now);

  return {
    ...base,
    status: passed ? 'passed' : rule.status === 'candidate' ? 'warning' : 'failed',
    expected: describeExpected(rule),
    actual: describeActual(state),
  };
}

export function evaluateFieldRuleSet(rules: FieldRule[], context: FieldRuleContext): FieldRuleEvaluation {
  const results = rules.map((rule) => evaluateFieldRule(rule, context));
  const failed = results.filter((result) => result.status === 'failed').length;
  const warnings = results.filter((result) => result.status === 'warning').length;
  const skipped = results.filter((result) => result.status === 'skipped').length;
  return { results, passed: failed === 0, failed, warnings, skipped };
}
