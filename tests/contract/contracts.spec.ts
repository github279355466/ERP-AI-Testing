import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, test } from '@playwright/test';
import YAML from 'yaml';
import { satisfies } from '../../src/platform/contracts/semver';
import {
  ContractSchemaName,
  PLATFORM_API_VERSION,
  readStructured,
  schemaDirectory,
  validateData,
  validateFile,
  validateIntegrationPack,
  validateModulePack,
} from '../../src/platform/contracts/validator';

const root = process.cwd();
const tempRoots: string[] = [];

interface SchemaCase {
  schema: ContractSchemaName;
  file: string;
  mutateEnum?: (data: Record<string, unknown>) => void;
}

const schemaCases: SchemaCase[] = [
  {
    schema: 'module-manifest',
    file: 'platform/contracts/examples/module.valid.yaml',
    mutateEnum: (data) => {
      (data.module as Record<string, unknown>).status = 'not-a-status';
    },
  },
  {
    schema: 'scenario',
    file: 'platform/contracts/examples/scenario.valid.json',
    mutateEnum: (data) => {
      data.risk_level = 'extreme';
    },
  },
  {
    schema: 'test-case',
    file: 'platform/contracts/examples/testcase.valid.json',
    mutateEnum: (data) => {
      data.cleanup_policy = 'drop_everything';
    },
  },
  {
    schema: 'page-mapping',
    file: 'platform/contracts/examples/page-mapping.valid.json',
    mutateEnum: (data) => {
      data.status = 'maybe';
    },
  },
  {
    schema: 'data-recipe',
    file: 'platform/contracts/examples/data-recipe.valid.json',
    mutateEnum: (data) => {
      data.reuse_policy = 'sometimes';
    },
  },
  {
    schema: 'execution-report',
    file: 'platform/contracts/examples/execution-report.valid.json',
    mutateEnum: (data) => {
      data.outcome = 'unknown-outcome';
    },
  },
  {
    schema: 'integration-pack',
    file: 'platform/contracts/examples/integration.valid.yaml',
    mutateEnum: (data) => {
      data.failure_propagation = 'ignore';
    },
  },
  {
    schema: 'action-registry',
    file: 'platform/contracts/action-registry.json',
    mutateEnum: (data) => {
      const actions = data.actions as Array<Record<string, unknown>>;
      actions[0].risk_level = 'severe';
    },
  },
  {
    schema: 'test-suite',
    file: 'platform/contracts/examples/test-suite.valid.json',
    mutateEnum: (data) => {
      data.status = 'ready';
    },
  },
  {
    schema: 'execution-plan',
    file: 'platform/contracts/examples/execution-plan.valid.json',
    mutateEnum: (data) => {
      (data.steps as Array<Record<string, unknown>>)[0].order = 0;
    },
  },
  {
    schema: 'run-config',
    file: 'platform/contracts/examples/run-config.valid.json',
    mutateEnum: (data) => {
      data.mode = 'write_everything';
    },
  },
  {
    schema: 'environment-profile',
    file: 'platform/contracts/examples/environment.valid.json',
    mutateEnum: (data) => {
      data.type = 'production';
    },
  },
  {
    schema: 'user-profile',
    file: 'platform/contracts/examples/user.valid.json',
    mutateEnum: (data) => {
      data.credential_env_prefix = 'lower-case-prefix';
    },
  },
];

function createTempRoot(): string {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-contract-'));
  tempRoots.push(directory);
  return directory;
}

function loadExample(file: string): Record<string, unknown> {
  return readStructured(path.resolve(root, file)) as Record<string, unknown>;
}

function readSchema(schema: ContractSchemaName): Record<string, unknown> {
  const file = path.join(schemaDirectory(root), `${schema}.schema.json`);
  return JSON.parse(fs.readFileSync(file, 'utf8')) as Record<string, unknown>;
}

function requiredFields(schema: ContractSchemaName): string[] {
  const definition = readSchema(schema);
  return (definition.required as string[] | undefined) ?? [];
}

function writeYaml(file: string, data: unknown): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, YAML.stringify(data), 'utf8');
}

function writeModule(
  base: string,
  id: string,
  options: {
    status?: 'draft' | 'reviewed' | 'approved' | 'deprecated';
    version?: string;
    platformApi?: string;
    withAssets?: boolean;
  } = {},
): string {
  const directory = path.join(base, 'business-modules', id);
  const withAssets = options.withAssets ?? true;
  const assets = {
    knowledge: 'knowledge/',
    page_mappings: 'page-mappings/',
    scenarios: 'scenarios/',
    testcases: 'testcases/',
    data_recipes: 'data-recipes/',
    test_suites: 'test-suites/',
  };
  writeYaml(path.join(directory, 'module.yaml'), {
    schema_version: '1.0',
    module: {
      id,
      name: id,
      version: options.version ?? '0.1.0',
      status: options.status ?? 'draft',
      owner: 'qa',
      description: '契约测试临时模块',
    },
    compatibility: {
      platform_api: options.platformApi ?? '>=1.0.0 <2.0.0',
    },
    sources: { prd_index: 'source-index/index.yaml' },
    assets,
  });
  if (withAssets) {
    for (const relative of Object.values(assets)) {
      fs.mkdirSync(path.join(directory, relative), { recursive: true });
    }
  }
  return directory;
}

function writeIntegration(
  base: string,
  id: string,
  options: {
    status?: 'draft' | 'reviewed' | 'approved' | 'deprecated';
    dependencies?: Array<{ module_id: string; version_range: string }>;
    steps?: unknown[];
    assertions?: unknown[];
  } = {},
): string {
  const directory = path.join(base, 'integration-tests', id);
  writeYaml(path.join(directory, 'integration.yaml'), {
    schema_version: '1.0',
    integration: {
      id,
      name: id,
      version: '0.1.0',
      status: options.status ?? 'draft',
      owner: 'qa',
      description: '契约测试临时集成包',
    },
    module_dependencies: options.dependencies ?? [
      { module_id: 'purchase', version_range: '>=0.1.0 <1.0.0' },
    ],
    business_goal: '契约测试',
    steps: options.steps ?? [],
    data_mapping: [],
    assertions: options.assertions ?? [],
    cleanup_policy: 'mark_for_cleanup',
    failure_propagation: 'block_downstream',
  });
  return directory;
}

afterAll(() => {
  for (const directory of tempRoots) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe('核心契约正向校验', () => {
  for (const item of schemaCases) {
    test(`${item.schema} 示例通过`, () => {
      const result = validateFile(path.resolve(root, item.file), item.schema);
      expect(result.issues).toEqual([]);
      expect(result.valid).toBe(true);
    });
  }

  test('模块包与集成包骨架通过资产检查', () => {
    const modules = ['business-modules/_template', 'business-modules/purchase'].map((directory) =>
      validateModulePack(directory, { root }),
    );
    const integrations = ['integration-tests/_template', 'integration-tests/purchase-to-ap'].map((directory) =>
      validateIntegrationPack(directory, { root }),
    );
    for (const result of [...modules, ...integrations]) {
      expect(result.valid, `${result.target}\n${result.issues.map((issue) => issue.message).join('\n')}`).toBe(true);
    }
  });
});

describe('契约反例校验', () => {
  for (const item of schemaCases) {
    const required = requiredFields(item.schema);
    const target = required[1] ?? required[0];

    test(`${item.schema} 缺少必填字段被拒绝`, () => {
      const data = loadExample(item.file);
      delete data[target];
      const result = validateData(item.schema, data);
      expect(result.valid).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test(`${item.schema} 字段类型错误被拒绝`, () => {
      const data = loadExample(item.file);
      data[target] = null;
      const result = validateData(item.schema, data);
      expect(result.valid).toBe(false);
      expect(result.issues.some((issue) => issue.path.startsWith(`/${target}`))).toBe(true);
    });

    test(`${item.schema} 未知字段被拒绝`, () => {
      const data = loadExample(item.file);
      data.__unexpected_field__ = true;
      const result = validateData(item.schema, data);
      expect(result.valid).toBe(false);
      expect(result.issues.some((issue) => issue.message.includes('additional'))).toBe(true);
    });

    if (item.mutateEnum) {
      test(`${item.schema} 非法枚举值被拒绝`, () => {
        const data = loadExample(item.file);
        item.mutateEnum?.(data);
        const result = validateData(item.schema, data);
        expect(result.valid).toBe(false);
      });
    }
  }

  test('schema_version 必须是 1.0', () => {
    const data = loadExample('platform/contracts/examples/scenario.valid.json');
    data.schema_version = '2.0';
    expect(validateData('scenario', data).valid).toBe(false);
  });

  test('采购字段不得混入通用契约', () => {
    const text = fs.readdirSync(schemaDirectory(root))
      .filter((file) => file.endsWith('.schema.json'))
      .map((file) => fs.readFileSync(path.join(schemaDirectory(root), file), 'utf8'))
      .join('\n');
    expect(text).not.toMatch(/purchase_order|供应商|采购订单/);
  });
});

describe('模块版本与资产检查', () => {
  test('平台 API 不兼容时拒绝加载', () => {
    const base = createTempRoot();
    writeModule(base, 'future-module', { platformApi: '>=2.0.0 <3.0.0' });
    const result = validateModulePack('business-modules/future-module', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('平台 API 不兼容'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes(PLATFORM_API_VERSION))).toBe(true);
  });

  test('兼容范围通过', () => {
    const base = createTempRoot();
    writeModule(base, 'compatible-module', { platformApi: '^1.0.0' });
    const result = validateModulePack('business-modules/compatible-module', { root: base });
    expect(result.valid, result.issues.map((issue) => issue.message).join('\n')).toBe(true);
  });

  test('草稿模块资产缺失只告警', () => {
    const base = createTempRoot();
    writeModule(base, 'draft-module', { status: 'draft', withAssets: false });
    const result = validateModulePack('business-modules/draft-module', { root: base });
    expect(result.valid).toBe(true);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('已批准模块资产缺失被拒绝', () => {
    const base = createTempRoot();
    writeModule(base, 'approved-module', { status: 'approved', withAssets: false });
    const result = validateModulePack('business-modules/approved-module', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.keyword === 'asset')).toBe(true);
  });

  test('缺少 module.yaml 被拒绝', () => {
    const base = createTempRoot();
    fs.mkdirSync(path.join(base, 'business-modules', 'empty'), { recursive: true });
    const result = validateModulePack('business-modules/empty', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues[0].message).toContain('module.yaml');
  });
});

describe('集成包依赖检查', () => {
  test('已批准集成包依赖模块缺失被拒绝', () => {
    const base = createTempRoot();
    writeIntegration(base, 'missing-dependency', {
      status: 'approved',
      dependencies: [{ module_id: 'ghost', version_range: '>=0.1.0 <1.0.0' }],
    });
    const result = validateIntegrationPack('integration-tests/missing-dependency', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('ghost'))).toBe(true);
  });

  test('草稿集成包依赖模块缺失只告警', () => {
    const base = createTempRoot();
    writeIntegration(base, 'draft-dependency', {
      status: 'draft',
      dependencies: [{ module_id: 'ghost', version_range: '>=0.1.0 <1.0.0' }],
    });
    const result = validateIntegrationPack('integration-tests/draft-dependency', { root: base });
    expect(result.valid).toBe(true);
    expect(result.warnings.some((warning) => warning.includes('ghost'))).toBe(true);
  });

  test('模块版本不满足依赖范围被拒绝', () => {
    const base = createTempRoot();
    writeModule(base, 'purchase', { version: '0.1.0' });
    writeIntegration(base, 'version-mismatch', {
      status: 'approved',
      dependencies: [{ module_id: 'purchase', version_range: '>=1.0.0 <2.0.0' }],
      steps: [{ id: 's1', module_id: 'purchase', case_ref: 'TC-1', action: 'run' }],
      assertions: [
        {
          type: 'visible',
          target: 'any',
          expected: '可见',
          level: 'ui',
          source_ref: {
            document_id: 'DOC-1',
            file_path: 'docs/doc.md',
            source_type: 'PRD_EXPLICIT',
          },
        },
      ],
    });
    const result = validateIntegrationPack('integration-tests/version-mismatch', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.message.includes('不满足'))).toBe(true);
  });

  test('已批准集成包必须有步骤与断言', () => {
    const base = createTempRoot();
    writeModule(base, 'purchase', { version: '0.1.0' });
    writeIntegration(base, 'empty-approved', { status: 'approved' });
    const result = validateIntegrationPack('integration-tests/empty-approved', { root: base });
    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.path === '/steps')).toBe(true);
    expect(result.issues.some((issue) => issue.path === '/assertions')).toBe(true);
  });
});

describe('语义版本范围', () => {
  test('支持比较符、脱字符、波浪号与或运算', () => {
    expect(satisfies('1.0.0', '>=1.0.0 <2.0.0')).toBe(true);
    expect(satisfies('2.0.0', '>=1.0.0 <2.0.0')).toBe(false);
    expect(satisfies('1.4.2', '^1.0.0')).toBe(true);
    expect(satisfies('2.0.0', '^1.0.0')).toBe(false);
    expect(satisfies('1.4.9', '~1.4.0')).toBe(true);
    expect(satisfies('1.5.0', '~1.4.0')).toBe(false);
    expect(satisfies('3.1.0', '^1.0.0 || ^3.0.0')).toBe(true);
    expect(satisfies('1.0.0', '*')).toBe(true);
    expect(satisfies('not-a-version', '>=1.0.0')).toBe(false);
  });
});
