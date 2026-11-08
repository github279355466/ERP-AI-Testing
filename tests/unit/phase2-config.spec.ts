import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { validateConfigDocument } from '../../src/config/config-schema';
import { loadDotEnv } from '../../src/config/load-env';

test('P2 配置包含环境类型、证据与知识版本字段', () => {
  const config = loadConfig('config/athena.config.json');
  expect(config.environment.type).toBe('test');
  expect(config.environment.allowedOrigins.length).toBeGreaterThan(0);
  expect(config.browser.engine).toBe('chromium');
  expect(config.browser.persistSession).toBe(false);
  expect(config.evidence.captureTrace).toBe(true);
  expect(config.evidence.localOnly).toBe(true);
  expect(config.knowledge.frozenModelPath).toBe('artifacts/knowledge');
  expect(config.safety.allowHighRiskActions).toBe(false);
  expect(config.safety.allowDelete).toBe(false);
});

test('默认配置文件通过 Schema 校验', () => {
  const raw = JSON.parse(fs.readFileSync('config/athena.config.json', 'utf8'));
  const result = validateConfigDocument(raw);
  expect(result.valid).toBe(true);
  expect(result.issues).toEqual([]);
});

test('配置 Schema 拒绝未知字段', () => {
  const raw = JSON.parse(fs.readFileSync('config/athena.config.json', 'utf8'));
  raw.unexpectedField = true;
  const result = validateConfigDocument(raw);
  expect(result.valid).toBe(false);
  expect(result.issues.some((issue) => issue.message.includes('additional'))).toBe(true);
});

test('.env 加载只填充缺失变量且返回值不含秘密', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'ATHENA_TEST_ONLY_KEY=value-from-file\nATHENA_TEST_SECOND_KEY="quoted"\n', 'utf8');
  delete process.env.ATHENA_TEST_ONLY_KEY;
  delete process.env.ATHENA_TEST_SECOND_KEY;
  try {
    const result = loadDotEnv(file);
    expect(result.loadedKeys).toContain('ATHENA_TEST_ONLY_KEY');
    expect(result.loadedKeys).toContain('ATHENA_TEST_SECOND_KEY');
    expect(result.loadedKeys.join(',')).not.toContain('value-from-file');
    expect(process.env.ATHENA_TEST_ONLY_KEY).toBe('value-from-file');
    expect(process.env.ATHENA_TEST_SECOND_KEY).toBe('quoted');
  } finally {
    delete process.env.ATHENA_TEST_ONLY_KEY;
    delete process.env.ATHENA_TEST_SECOND_KEY;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('.env 不覆盖已存在的环境变量', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-env-'));
  const file = path.join(dir, '.env');
  fs.writeFileSync(file, 'ATHENA_TEST_PRECEDENCE=file-value\n', 'utf8');
  process.env.ATHENA_TEST_PRECEDENCE = 'process-value';
  try {
    const result = loadDotEnv(file);
    expect(result.skippedKeys).toContain('ATHENA_TEST_PRECEDENCE');
    expect(process.env.ATHENA_TEST_PRECEDENCE).toBe('process-value');
  } finally {
    delete process.env.ATHENA_TEST_PRECEDENCE;
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
