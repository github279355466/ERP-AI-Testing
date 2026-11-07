import { expect, test } from '@playwright/test';
import { createRunId, redactSecrets } from '../../src/evidence/evidence-manager';

test('脱敏 URL 中的 token', () => {
  const url = 'https://lowcode.test/?token=6729a605-694d&tabName=%E5%AD%98';
  const masked = redactSecrets(url);
  expect(masked).toContain('token=<redacted>');
  expect(masked).not.toContain('6729a605');
});

test('脱敏 JSON 中的密码与 Cookie', () => {
  const text = '{"password": "p@ss", "cookie": "abc123", "name": "ok"}';
  const masked = redactSecrets(text);
  expect(masked).toContain('"password": "<redacted>"');
  expect(masked).toContain('"cookie": "<redacted>"');
  expect(masked).toContain('"name": "ok"');
});

test('runId 格式稳定', () => {
  expect(createRunId(new Date('2026-11-06T02:03:04Z'))).toMatch(/^20261106-020304-[a-z0-9]{4}$/);
});
