import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests',
  timeout: 120_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'off',
  },
  projects: [
    { name: 'unit', testDir: 'tests/unit' },
    { name: 'contract', testDir: 'tests/contract' },
    { name: 'platform', testDir: 'tests/platform' },
    { name: 'smoke', testDir: 'tests/smoke' },
    { name: 'integration', testDir: 'tests/integration' },
  ],
});
