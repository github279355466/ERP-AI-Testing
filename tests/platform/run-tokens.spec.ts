import { expect, test } from '@playwright/test';
import { formatRunTimestamp, substituteRunTokens } from '../../src/platform/execution/run-tokens';

test('运行时间戳在同一运行内固定', () => {
  const stamp = formatRunTimestamp(new Date('2026-11-11T02:56:50'));
  expect(stamp).toBe('20261111025650');
  expect(substituteRunTokens('QA${RUN_TIMESTAMP}-BT', 'run-1', stamp)).toBe('QA20261111025650-BT');
  expect(substituteRunTokens('QA${RUN_TIMESTAMP}-BT', 'run-1', stamp)).toBe('QA20261111025650-BT');
});

test('运行 ID 与时间戳可同时替换', () => {
  expect(substituteRunTokens('${RUN_ID}/${RUN_TIMESTAMP}', '20261111-025650-abc', '20261111025650')).toBe(
    '20261111-025650-abc/20261111025650',
  );
});
