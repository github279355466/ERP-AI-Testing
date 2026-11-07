import { expect, test } from '@playwright/test';
import { PageSnapshot, toCandidateEntry } from '../../src/discovery/page-explorer';

const snapshot: PageSnapshot = {
  url: 'https://lowcode.test/?token=<redacted>',
  title: '存货参数',
  capturedAt: '2026-11-06T10:00:00.000Z',
  fields: [
    { fieldPath: 'ops_unit_invnt_param.ops_unit_no', label: '运营单元', required: true, kind: 'LOOKUP', reason: 'WindowSelect', disabled: true, value: '玄鸟公司' },
    { fieldPath: 'ops_unit_invnt_param.aprv_date_basis', label: '审核日依据', required: false, kind: 'DROPDOWN', reason: 'Select', disabled: false, value: '系统日' },
  ],
  grid: { headers: [{ colId: 'ops_unit_no', label: '运营单元编号' }], rowCount: 9, sampleRows: [] },
  tabs: ['列表'],
  buttons: ['新增', '筛选'],
  modal: null,
  menu: null,
};

test('探索结果生成 candidate 条目', () => {
  const entry = toCandidateEntry(snapshot, { id: 'invnt-param', menuPath: ['基础管理', '系统参数', '存货参数'] });
  expect(entry.status).toBe('candidate');
  expect(entry.type).toBe('lowcode-list');
  expect(entry.entity).toBe('ops_unit_invnt_param');
  expect(entry.fields).toHaveLength(2);
  expect(entry.fields[0]).toMatchObject({ name: 'ops_unit_no', label: '运营单元', componentType: 'LOOKUP' });
  expect(entry.verifiedAt).toBe('2026-11-06');
});

test('空列表会记录提示', () => {
  const entry = toCandidateEntry(
    { ...snapshot, grid: { headers: [], rowCount: 0, sampleRows: [] } },
    { id: 'x', menuPath: [], type: 'lowcode-list' },
  );
  expect(entry.type).toBe('lowcode-list');
  expect(entry.notes.join('')).toContain('空列表');
});
