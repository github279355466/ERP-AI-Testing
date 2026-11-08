import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  createRunManifest,
  readRunManifest,
  validateRunManifest,
  writeRunManifest,
} from '../../src/evidence/run-manifest';

function validManifest() {
  return createRunManifest({
    runId: '20261108-120000-abcd',
    startedAt: '2026-11-08T12:00:00.000Z',
    environmentName: 'athena-test',
    environmentType: 'test',
    baseURL: 'https://athena-test.digiwincloud.com.cn/',
    testCaseId: 'P2.0-MANIFEST',
    knowledgeModelVersion: 'KM-1234567890abcdef',
    codeCommit: 'abc123',
    operator: 'qa',
  });
}

test('合法 manifest 通过 Schema 校验', () => {
  const result = validateRunManifest(validManifest());
  expect(result.valid).toBe(true);
  expect(result.issues).toEqual([]);
});

test('manifest 缺少必填字段被拒绝', () => {
  const manifest = validManifest() as Record<string, unknown>;
  delete manifest.outcome;
  const result = validateRunManifest(manifest);
  expect(result.valid).toBe(false);
});

test('manifest 非法时间被拒绝', () => {
  const manifest = validManifest();
  manifest.finishedAt = 'not-a-date';
  const result = validateRunManifest(manifest);
  expect(result.valid).toBe(false);
});

test('manifest 未知字段被拒绝', () => {
  const manifest = { ...validManifest(), password: 'should-not-exist' };
  const result = validateRunManifest(manifest);
  expect(result.valid).toBe(false);
});

test('manifest 可落盘并回读', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-manifest-'));
  try {
    const manifest = validManifest();
    const file = writeRunManifest(dir, manifest);
    const read = readRunManifest(file);
    expect(read).toEqual(manifest);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
