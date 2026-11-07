import crypto from 'node:crypto';
import { expect, test } from '@playwright/test';
import {
  documentId,
  entityId,
  fieldId,
  ruleId,
  sha256,
  shortHash,
  stableId,
} from '../../src/prd/ids';

test('sha256 与 Node crypto 结果一致', () => {
  const expected = crypto.createHash('sha256').update('采购订单').digest('hex');
  expect(sha256('采购订单')).toBe(expected);
});

test('stableId 输出前缀加大写 12 位短哈希且可重复', () => {
  const first = stableId('DOC', '采购订单/采购订单PRD.v1.2.md');
  const second = stableId('DOC', '采购订单/采购订单PRD.v1.2.md');
  expect(first).toBe(second);
  expect(first).toMatch(/^DOC-[A-F0-9]{12}$/);
  expect(shortHash('采购订单')).toHaveLength(12);
});

test('documentId 归一化路径分隔符与大小写', () => {
  expect(documentId('采购订单\\采购订单PRD.v1.2.md')).toBe(documentId('采购订单/采购订单prd.v1.2.md'));
});

test('fieldId 在字段码缺失时回退到字段名，且实体不同则 ID 不同', () => {
  const withFieldNo = fieldId('DOC-1', 'po', 'doc_no', '单号');
  const withoutFieldNo = fieldId('DOC-1', 'po', null, '单号');
  const otherEntity = fieldId('DOC-1', 'po_rtn', 'doc_no', '单号');
  expect(withFieldNo).not.toBe(withoutFieldNo);
  expect(withFieldNo).not.toBe(otherEntity);
  expect(fieldId('DOC-1', null, null, '单号')).toBe(fieldId('DOC-1', null, null, '单号'));
});

test('entityId 与 ruleId 同键稳定、异键可区分', () => {
  expect(entityId('PO')).toBe(entityId('po'));
  expect(ruleId('DOC-1', 'doc_no|REQUIRED')).toBe(ruleId('DOC-1', 'doc_no|REQUIRED'));
  expect(ruleId('DOC-1', 'doc_no|REQUIRED')).not.toBe(ruleId('DOC-1', 'doc_no|READONLY'));
});
