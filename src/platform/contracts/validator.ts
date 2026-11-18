import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import YAML from 'yaml';
import { satisfies } from './semver';

export const PLATFORM_API_VERSION = '1.0.0';
export const CONTRACT_SCHEMA_VERSION = '1.0';

export type ContractSchemaName =
  | 'module-manifest'
  | 'source-index'
  | 'scenario'
  | 'test-case'
  | 'field-rule'
  | 'page-mapping'
  | 'data-recipe'
  | 'execution-report'
  | 'run-manifest-v2'
  | 'integration-pack'
  | 'action-registry'
  | 'test-suite'
  | 'execution-plan'
  | 'run-config'
  | 'environment-profile'
  | 'user-profile'
  | 'ui-spec';

export interface ContractIssue {
  path: string;
  message: string;
  keyword?: string;
}

export interface ContractValidationResult {
  valid: boolean;
  target: string;
  schema: ContractSchemaName | 'bundle';
  issues: ContractIssue[];
  warnings: string[];
}

const SCHEMA_FILES: Record<ContractSchemaName, string> = {
  'module-manifest': 'module-manifest.schema.json',
  'source-index': 'source-index.schema.json',
  scenario: 'scenario.schema.json',
  'test-case': 'test-case.schema.json',
  'field-rule': 'field-rule.schema.json',
  'page-mapping': 'page-mapping.schema.json',
  'data-recipe': 'data-recipe.schema.json',
  'execution-report': 'execution-report.schema.json',
  'run-manifest-v2': 'run-manifest-v2.schema.json',
  'integration-pack': 'integration-pack.schema.json',
  'action-registry': 'action-registry.schema.json',
  'test-suite': 'test-suite.schema.json',
  'execution-plan': 'execution-plan.schema.json',
  'run-config': 'run-config.schema.json',
  'environment-profile': 'environment-profile.schema.json',
  'user-profile': 'user-profile.schema.json',
  'ui-spec': 'ui-spec.schema.json',
};

export function schemaDirectory(root = process.cwd()): string {
  const candidates = [
    path.resolve(root, 'platform/contracts/schemas'),
    path.resolve(__dirname, '..', '..', '..', 'platform/contracts/schemas'),
    path.resolve(__dirname, '..', '..', '..', '..', 'platform/contracts/schemas'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, 'common.schema.json')));
  if (!found) throw new Error(`契约 Schema 目录不存在: ${candidates.join(' | ')}`);
  return found;
}

export function readStructured(filePath: string): unknown {
  const content = fs.readFileSync(filePath, 'utf8');
  if (/\.ya?ml$/i.test(filePath)) return YAML.parse(content);
  return JSON.parse(content);
}

function createAjv(directory = schemaDirectory()): Ajv2020 {
  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const files = fs.readdirSync(directory).filter((file) => file.endsWith('.schema.json'));
  for (const file of files) {
    const schema = JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8')) as { $id?: string };
    if (!schema.$id) throw new Error(`Schema 缺少 $id: ${file}`);
    ajv.addSchema(schema, schema.$id);
  }
  return ajv;
}

export function validateData(
  schemaName: ContractSchemaName,
  data: unknown,
  options: { target?: string; directory?: string } = {},
): ContractValidationResult {
  const directory = options.directory ?? schemaDirectory();
  const schemaPath = path.join(directory, SCHEMA_FILES[schemaName]);
  const schema = JSON.parse(fs.readFileSync(schemaPath, 'utf8')) as { $id?: string };
  if (!schema.$id) throw new Error(`Schema 缺少 $id: ${schemaPath}`);
  const ajv = createAjv(directory);
  const validate = ajv.getSchema(schema.$id);
  if (!validate) throw new Error(`无法加载 Schema: ${schema.$id}`);
  const valid = validate(data) as boolean;
  const issues = (validate.errors ?? []).map((error) => ({
    path: error.instancePath || '/',
    message: error.message ?? '不符合 Schema',
    keyword: error.keyword,
  }));
  return {
    valid,
    target: options.target ?? schemaName,
    schema: schemaName,
    issues,
    warnings: [],
  };
}

export function validateFile(
  filePath: string,
  schemaName: ContractSchemaName,
  options: { directory?: string } = {},
): ContractValidationResult {
  const absolute = path.resolve(filePath);
  if (!fs.existsSync(absolute)) {
    return {
      valid: false,
      target: absolute,
      schema: schemaName,
      issues: [{ path: '/', message: `文件不存在: ${absolute}` }],
      warnings: [],
    };
  }
  try {
    return validateData(schemaName, readStructured(absolute), { target: absolute, directory: options.directory });
  } catch (error) {
    return {
      valid: false,
      target: absolute,
      schema: schemaName,
      issues: [{ path: '/', message: error instanceof Error ? error.message : String(error) }],
      warnings: [],
    };
  }
}

export function findManifest(directory: string): string | null {
  const candidates = ['module.yaml', 'module.yml', 'module.json'];
  const found = candidates.map((name) => path.join(directory, name)).find((file) => fs.existsSync(file));
  return found ?? null;
}

export function findIntegration(directory: string): string | null {
  const candidates = ['integration.yaml', 'integration.yml', 'integration.json'];
  const found = candidates.map((name) => path.join(directory, name)).find((file) => fs.existsSync(file));
  return found ?? null;
}

export function validateModulePack(
  directory: string,
  options: { root?: string; directory?: string } = {},
): ContractValidationResult {
  const root = options.root ?? process.cwd();
  const absolute = path.resolve(root, directory);
  const manifestPath = findManifest(absolute);
  if (!manifestPath) {
    return {
      valid: false,
      target: absolute,
      schema: 'module-manifest',
      issues: [{ path: '/', message: '缺少 module.yaml / module.yml / module.json' }],
      warnings: [],
    };
  }
  const result = validateFile(manifestPath, 'module-manifest', { directory: options.directory });
  if (!result.valid) return result;
  const manifest = readStructured(manifestPath) as {
    module?: { id?: string; status?: string };
    compatibility?: { platform_api?: string };
    assets?: Record<string, string>;
  };
  const warnings = [...result.warnings];
  const range = manifest.compatibility?.platform_api ?? '';
  if (!satisfies(PLATFORM_API_VERSION, range)) {
    result.issues.push({
      path: '/compatibility/platform_api',
      message: `平台 API 不兼容：平台 ${PLATFORM_API_VERSION}，模块要求 ${range || '(空)'}`,
      keyword: 'compatibility',
    });
    result.valid = false;
  }
  for (const [name, relative] of Object.entries(manifest.assets ?? {})) {
    const assetPath = path.resolve(absolute, relative);
    if (!fs.existsSync(assetPath)) {
      const message = `资产目录不存在: ${name}=${relative}`;
      if (manifest.module?.status === 'approved') {
        result.issues.push({ path: `/assets/${name}`, message, keyword: 'asset' });
        result.valid = false;
      } else {
        warnings.push(message);
      }
    }
  }
  return { ...result, warnings };
}

export function validateIntegrationPack(
  directory: string,
  options: { root?: string; directory?: string } = {},
): ContractValidationResult {
  const root = options.root ?? process.cwd();
  const absolute = path.resolve(root, directory);
  const integrationPath = findIntegration(absolute);
  if (!integrationPath) {
    return {
      valid: false,
      target: absolute,
      schema: 'integration-pack',
      issues: [{ path: '/', message: '缺少 integration.yaml / integration.yml / integration.json' }],
      warnings: [],
    };
  }
  const result = validateFile(integrationPath, 'integration-pack', { directory: options.directory });
  if (!result.valid) return result;
  const pack = readStructured(integrationPath) as {
    integration?: { status?: string };
    module_dependencies?: Array<{ module_id: string; version_range: string }>;
    steps?: unknown[];
    assertions?: unknown[];
  };
  const warnings = [...result.warnings];
  for (const dependency of pack.module_dependencies ?? []) {
    const moduleDir = path.resolve(root, 'business-modules', dependency.module_id);
    const moduleManifest = findManifest(moduleDir);
    if (!moduleManifest) {
      const message = `集成包依赖的模块不存在: ${dependency.module_id}`;
      if (pack.integration?.status === 'approved') {
        result.issues.push({ path: '/module_dependencies', message, keyword: 'module' });
        result.valid = false;
      } else {
        warnings.push(message);
      }
      continue;
    }
    const module = readStructured(moduleManifest) as { module?: { version?: string } };
    const version = module.module?.version ?? '';
    if (version && !satisfies(version, dependency.version_range)) {
      result.issues.push({
        path: '/module_dependencies',
        message: `模块 ${dependency.module_id} 版本 ${version} 不满足 ${dependency.version_range}`,
        keyword: 'version',
      });
      result.valid = false;
    }
  }
  if (pack.integration?.status === 'approved') {
    if ((pack.steps ?? []).length === 0) {
      result.issues.push({ path: '/steps', message: '已批准的集成包至少需要 1 个步骤', keyword: 'semantic' });
      result.valid = false;
    }
    if ((pack.assertions ?? []).length === 0) {
      result.issues.push({ path: '/assertions', message: '已批准的集成包至少需要 1 条断言', keyword: 'semantic' });
      result.valid = false;
    }
  }
  return { ...result, warnings };
}

export function validateAll(options: { root?: string; directory?: string } = {}): ContractValidationResult[] {
  const root = options.root ?? process.cwd();
  const directory = options.directory;
  const results: ContractValidationResult[] = [];
  const examples: Array<[string, ContractSchemaName]> = [
    ['platform/contracts/examples/module.valid.yaml', 'module-manifest'],
    ['platform/contracts/examples/source-index.valid.yaml', 'source-index'],
    ['platform/contracts/examples/scenario.valid.json', 'scenario'],
    ['platform/contracts/examples/testcase.valid.json', 'test-case'],
    ['platform/contracts/examples/page-mapping.valid.json', 'page-mapping'],
    ['platform/contracts/examples/data-recipe.valid.json', 'data-recipe'],
    ['platform/contracts/examples/execution-report.valid.json', 'execution-report'],
    ['platform/contracts/examples/run-manifest-v2.valid.json', 'run-manifest-v2'],
    ['platform/contracts/examples/integration.valid.yaml', 'integration-pack'],
    ['platform/contracts/examples/test-suite.valid.json', 'test-suite'],
    ['platform/contracts/examples/execution-plan.valid.json', 'execution-plan'],
    ['platform/contracts/examples/run-config.valid.json', 'run-config'],
    ['platform/contracts/examples/environment.valid.json', 'environment-profile'],
    ['platform/contracts/examples/user.valid.json', 'user-profile'],
  ];
  for (const [file, schema] of examples) {
    results.push(validateFile(path.resolve(root, file), schema, { directory }));
  }
  results.push(validateFile(path.resolve(root, 'platform/contracts/action-registry.json'), 'action-registry', { directory }));
  results.push(validateModulePack('business-modules/_template', { root, directory }));
  results.push(validateModulePack('business-modules/purchase', { root, directory }));
  results.push(validateModulePack('business-modules/foundation', { root, directory }));
  results.push(validateIntegrationPack('integration-tests/_template', { root, directory }));
  results.push(validateIntegrationPack('integration-tests/purchase-to-ap', { root, directory }));
  return results;
}
