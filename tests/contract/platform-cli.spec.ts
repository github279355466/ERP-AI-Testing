import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, test } from '@playwright/test';
import YAML from 'yaml';

const root = process.cwd();
const cli = path.join(root, 'dist', 'cli', 'platform.js');
const tempRoots: string[] = [];

function run(args: string[]): { status: number; stdout: string; stderr: string } {
  const result = spawnSync(process.execPath, [cli, ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  return { status: result.status ?? -1, stdout: result.stdout, stderr: result.stderr };
}

function parseJson(stdout: string): Record<string, unknown> {
  return JSON.parse(stdout) as Record<string, unknown>;
}

function createTempRoot(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-cli-'));
  tempRoots.push(directory);
  return directory;
}

beforeAll(() => {
  if (!fs.existsSync(cli)) {
    const build = spawnSync('npm', ['run', 'build'], { cwd: root, shell: true, encoding: 'utf8' });
    if (build.status !== 0) {
      throw new Error(`构建失败: ${build.stdout}\n${build.stderr}`);
    }
  }
});

afterAll(() => {
  for (const directory of tempRoots) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('平台契约 CLI', () => {
  test('validate 通过并输出只读汇总', () => {
    const result = run(['validate']);
    expect(result.status, result.stderr).toBe(0);
    const payload = parseJson(result.stdout);
    expect(payload.mode).toBe('READ_ONLY');
    expect(payload.success).toBe(true);
    const summary = payload.summary as { total: number; passed: number; failed: number };
    expect(summary.total).toBeGreaterThanOrEqual(17);
    expect(summary.failed).toBe(0);
    expect(summary.passed).toBe(summary.total);
  });

  test('模块与集成包单包校验通过', () => {
    const module = run(['module', '--path', 'business-modules/purchase']);
    expect(module.status, module.stderr).toBe(0);
    expect((parseJson(module.stdout).summary as { failed: number }).failed).toBe(0);

    const integration = run(['integration', '--path', 'integration-tests/purchase-to-ap']);
    expect(integration.status, integration.stderr).toBe(0);
    expect((parseJson(integration.stdout).summary as { failed: number }).failed).toBe(0);
  });

  test('单文件校验通过', () => {
    const result = run([
      'file',
      '--path',
      'platform/contracts/examples/testcase.valid.json',
      '--schema',
      'test-case',
    ]);
    expect(result.status, result.stderr).toBe(0);
    expect(parseJson(result.stdout).success).toBe(true);
  });

  test('不兼容模块返回退出码 2', () => {
    const base = createTempRoot();
    const directory = path.join(base, 'business-modules', 'future');
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(
      path.join(directory, 'module.yaml'),
      YAML.stringify({
        schema_version: '1.0',
        module: {
          id: 'future',
          name: 'future',
          version: '0.1.0',
          status: 'draft',
          owner: 'qa',
          description: '不兼容平台版本',
        },
        compatibility: { platform_api: '>=9.0.0' },
        sources: { prd_index: 'source-index/index.yaml' },
        assets: {
          knowledge: 'knowledge/',
          page_mappings: 'page-mappings/',
          scenarios: 'scenarios/',
          testcases: 'testcases/',
          data_recipes: 'data-recipes/',
          test_suites: 'test-suites/',
        },
      }),
      'utf8',
    );
    const result = run(['module', '--path', directory]);
    expect(result.status).toBe(2);
    expect(parseJson(result.stdout).success).toBe(false);
  });

  test('schema 不匹配返回退出码 2', () => {
    const result = run([
      'file',
      '--path',
      'platform/contracts/examples/testcase.valid.json',
      '--schema',
      'scenario',
    ]);
    expect(result.status).toBe(2);
    expect(parseJson(result.stdout).success).toBe(false);
  });

  test('缺少参数与未知命令返回退出码 1', () => {
    const missing = run(['module']);
    expect(missing.status).toBe(1);
    expect(missing.stderr).toContain('用法');

    const unknown = run(['not-a-command']);
    expect(unknown.status).toBe(1);
    expect(unknown.stderr).toContain('未知命令');
  });

  test('help 返回 0 并列出命令', () => {
    const result = run(['help']);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('Athena Platform Contracts');
    expect(result.stdout).toContain('module --path');
    expect(result.stdout).toContain('integration --path');
  });
});
