import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import {
  computeKnowledgeModelVersion,
  verifyKnowledgeModelVersion,
} from '../../src/knowledge/model-version';

function makeBundle(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-model-'));
  fs.writeFileSync(
    path.join(dir, 'summary.json'),
    JSON.stringify({ schema_version: '1.0.0', parser_version: '1.0.0', generated_at: '2026-11-07T15:48:10.908Z', counts: { rules: 1 } }),
    'utf8',
  );
  fs.writeFileSync(path.join(dir, 'documents.json'), '[]', 'utf8');
  return dir;
}

test('模型版本稳定且包含文件哈希', () => {
  const dir = makeBundle();
  try {
    const first = computeKnowledgeModelVersion(dir);
    const second = computeKnowledgeModelVersion(dir);
    expect(first.modelVersion).toMatch(/^KM-[0-9a-f]{16}$/);
    expect(second.modelVersion).toBe(first.modelVersion);
    expect(first.generatedAt).toBe('2026-11-07T15:48:10.908Z');
    expect(first.files.map((file) => file.name)).toContain('documents.json');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('知识文件变化会产生新版本', () => {
  const dir = makeBundle();
  try {
    const before = computeKnowledgeModelVersion(dir).modelVersion;
    fs.writeFileSync(path.join(dir, 'documents.json'), '[{"id":"X"}]', 'utf8');
    const after = computeKnowledgeModelVersion(dir).modelVersion;
    expect(after).not.toBe(before);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('期望版本不匹配时抛错', () => {
  const dir = makeBundle();
  try {
    expect(() => verifyKnowledgeModelVersion(dir, 'KM-0000000000000000')).toThrow(/版本不匹配/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
