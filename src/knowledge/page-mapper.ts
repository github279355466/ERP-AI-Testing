import type { Field } from '../prd/types';
import type { PageRecon, ReconField } from '../diagnostics/page-recon';

export type MappingStatus =
  | 'MATCHED'
  | 'PRD_FIELD_NOT_FOUND'
  | 'UNDOCUMENTED_UI_FIELD'
  | 'CONTROL_TYPE_MISMATCH'
  | 'LOCATOR_UNRESOLVED'
  | 'NEEDS_HUMAN_REVIEW';

export interface PageMappingField {
  fieldKey: string;
  locatorStrategy: string | null;
  controlTypeObserved: string | null;
  status: MappingStatus;
  evidence: string[];
}

export interface PageMapping {
  pageKey: string;
  knowledgePageId: string;
  knowledgeModelVersion: string | null;
  actualPageName: string | null;
  navigationPath: string[];
  reviewStatus: 'draft' | 'needs_review' | 'approved' | 'blocked';
  locatorMap: Record<string, string>;
  observedControls: Array<Record<string, unknown>>;
  unmappedFields: string[];
  unexpectedFields: string[];
  controlTypeMismatches: Array<{ fieldKey: string; expected: string; observed: string }>;
  evidence: string[];
  fields: PageMappingField[];
}

export interface MappingSummary {
  expected: number;
  observed: number;
  matched: number;
  missing: number;
  unexpected: number;
  mismatches: number;
  unresolved: number;
  keyFields: number;
  keyMatched: number;
  keyRate: number;
}

export interface MapPageResult {
  mapping: PageMapping;
  summary: MappingSummary;
  markdown: string;
}

const KEY_FIELDS = ['po_doc_no', 'supp_no', 'doc_date', 'item_no', 'biz_qty', 'price', 'amt'];

const TYPE_COMPATIBILITY: Record<string, string[]> = {
  TEXT_INPUT: ['TEXT_INPUT', 'TEXT', 'INPUT'],
  NUMBER_INPUT: ['NUMBER_INPUT', 'NUMBER'],
  DATE_PICKER: ['DATE_PICKER', 'DATE'],
  DROPDOWN: ['DROPDOWN', 'SELECT'],
  LOOKUP: ['LOOKUP', 'WINDOW_SELECT'],
  CHECKBOX: ['CHECKBOX', 'SWITCH'],
  SWITCH: ['SWITCH', 'CHECKBOX'],
  UNKNOWN: [],
};

export function mapPageModel(params: {
  recon: PageRecon;
  expectedFields: Field[];
  knowledgeModelVersion: string | null;
}): MapPageResult {
  const expectedByKey = new Map<string, Field>();
  for (const field of params.expectedFields) {
    if (field.field_no) expectedByKey.set(field.field_no, field);
  }

  const observedByKey = new Map<string, ReconField>();
  for (const field of params.recon.detail.fields) {
    if (!observedByKey.has(field.fieldKey)) observedByKey.set(field.fieldKey, field);
  }

  const fields: PageMappingField[] = [];
  const locatorMap: Record<string, string> = {};
  const controlTypeMismatches: PageMapping['controlTypeMismatches'] = [];
  const unexpectedFields: string[] = [];
  const unmappedFields: string[] = [];

  for (const [fieldKey, observed] of observedByKey) {
    const expected = expectedByKey.get(fieldKey);
    let status: MappingStatus;
    if (!expected) {
      status = 'UNDOCUMENTED_UI_FIELD';
      unexpectedFields.push(fieldKey);
    } else if (!observed.locatorStrategy) {
      status = 'LOCATOR_UNRESOLVED';
    } else if (expected.control_type === 'UNKNOWN' || observed.observedType === 'UNKNOWN') {
      status = 'NEEDS_HUMAN_REVIEW';
    } else if (!isCompatible(expected.control_type, observed.observedType)) {
      status = 'CONTROL_TYPE_MISMATCH';
      controlTypeMismatches.push({
        fieldKey,
        expected: expected.control_type,
        observed: observed.observedType,
      });
    } else {
      status = 'MATCHED';
    }
    locatorMap[fieldKey] = observed.locatorStrategy;
    fields.push({
      fieldKey,
      locatorStrategy: observed.locatorStrategy,
      controlTypeObserved: observed.observedType,
      status,
      evidence: [`ui:${observed.source}`],
    });
  }

  for (const [fieldKey] of expectedByKey) {
    if (!observedByKey.has(fieldKey)) unmappedFields.push(fieldKey);
  }

  const keyObserved = KEY_FIELDS.filter((field) => observedByKey.has(field));
  const keyMatched = keyObserved.filter(
    (field) => fields.find((item) => item.fieldKey === field)?.status === 'MATCHED',
  );

  const mapping: PageMapping = {
    pageKey: params.recon.pageKey,
    knowledgePageId: params.recon.knowledgePageId,
    knowledgeModelVersion: params.knowledgeModelVersion,
    actualPageName: params.recon.actualPageName,
    navigationPath: params.recon.navigationPath,
    reviewStatus: 'needs_review',
    locatorMap,
    observedControls: params.recon.detail.fields.map((field) => ({
      fieldKey: field.fieldKey,
      label: field.label,
      source: field.source,
      observedType: field.observedType,
      required: field.required,
      disabled: field.disabled,
    })),
    unmappedFields,
    unexpectedFields,
    controlTypeMismatches,
    evidence: params.recon.evidence,
    fields,
  };

  const summary: MappingSummary = {
    expected: expectedByKey.size,
    observed: observedByKey.size,
    matched: fields.filter((field) => field.status === 'MATCHED').length,
    missing: unmappedFields.length,
    unexpected: unexpectedFields.length,
    mismatches: controlTypeMismatches.length,
    unresolved: fields.filter((field) => field.status === 'LOCATOR_UNRESOLVED').length,
    keyFields: keyObserved.length,
    keyMatched: keyMatched.length,
    keyRate: keyObserved.length > 0 ? keyMatched.length / keyObserved.length : 0,
  };

  return { mapping, summary, markdown: renderMappingReport(mapping, summary, params.recon) };
}

export function renderMappingReport(
  mapping: PageMapping,
  summary: MappingSummary,
  recon: PageRecon,
): string {
  const lines: string[] = [
    '# 采购订单页面映射报告',
    '',
    `- 页面：${mapping.actualPageName ?? recon.actualPageName}`,
    `- knowledgePageId：${mapping.knowledgePageId}`,
    `- 知识模型版本：${mapping.knowledgeModelVersion ?? 'UNKNOWN'}`,
    `- 导航：${mapping.navigationPath.join(' → ')}`,
    `- 评审状态：${mapping.reviewStatus}`,
    '',
    '## 1. 汇总',
    '',
    '| 指标 | 数值 |',
    '| --- | ---: |',
    `| PRD 字段 | ${summary.expected} |`,
    `| 页面观察字段 | ${summary.observed} |`,
    `| MATCHED | ${summary.matched} |`,
    `| PRD 有而页面无 | ${summary.missing} |`,
    `| 页面有而 PRD 无 | ${summary.unexpected} |`,
    `| 控件类型不一致 | ${summary.mismatches} |`,
    `| 定位器未解析 | ${summary.unresolved} |`,
    `| 关键字段映射率 | ${(summary.keyRate * 100).toFixed(1)}% (${summary.keyMatched}/${summary.keyFields}) |`,
    '',
    '## 2. 关键字段',
    '',
    '| 字段 | 观察类型 | 状态 | 定位策略 |',
    '| --- | --- | --- | --- |',
  ];
  for (const key of KEY_FIELDS) {
    const field = mapping.fields.find((item) => item.fieldKey === key);
    if (!field) {
      lines.push(`| ${key} | - | PRD_FIELD_NOT_FOUND | - |`);
      continue;
    }
    lines.push(
      `| ${key} | ${field.controlTypeObserved ?? '-'} | ${field.status} | ${escapePipe(field.locatorStrategy ?? '-')} |`,
    );
  }
  lines.push('', '## 3. 全部观察字段', '', '| 字段 | 类型 | 状态 | 来源 |', '| --- | --- | --- | --- |');
  for (const field of mapping.fields) {
    const observed = recon.detail.fields.find((item) => item.fieldKey === field.fieldKey);
    lines.push(
      `| ${field.fieldKey} | ${field.controlTypeObserved ?? '-'} | ${field.status} | ${observed?.source ?? '-'} |`,
    );
  }
  lines.push('', '## 4. 控件类型不一致', '');
  if (mapping.controlTypeMismatches.length === 0) {
    lines.push('无。');
  } else {
    lines.push('| 字段 | PRD | 页面 |', '| --- | --- | --- |');
    for (const mismatch of mapping.controlTypeMismatches) {
      lines.push(`| ${mismatch.fieldKey} | ${mismatch.expected} | ${mismatch.observed} |`);
    }
  }
  lines.push('', '## 5. PRD 有而页面无（未映射）', '');
  lines.push(mapping.unmappedFields.length > 0 ? mapping.unmappedFields.join('、') : '无。');
  lines.push('', '## 6. 页面有而 PRD 无（未登记）', '');
  lines.push(mapping.unexpectedFields.length > 0 ? mapping.unexpectedFields.join('、') : '无。');
  lines.push('');
  return lines.join('\n');
}

function isCompatible(expected: string, observed: string): boolean {
  if (expected === observed) return true;
  if (observed === 'GRID_COLUMN') {
    return ['LOOKUP', 'NUMBER_INPUT', 'TEXT_INPUT', 'DATE_PICKER', 'DROPDOWN', 'CHECKBOX'].includes(expected);
  }
  return (TYPE_COMPATIBILITY[expected] ?? []).includes(observed);
}

function escapePipe(value: string): string {
  return value.replace(/\|/g, '\\|');
}
