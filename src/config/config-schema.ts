import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

export interface ConfigValidationIssue {
  path: string;
  message: string;
}

export interface ConfigValidationResult {
  valid: boolean;
  issues: ConfigValidationIssue[];
  schemaPath: string;
}

const SCHEMA_FILE = 'athena-config.schema.json';

export function configSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'schemas', SCHEMA_FILE),
    path.resolve(process.cwd(), 'schemas', SCHEMA_FILE),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function validateConfigDocument(raw: unknown): ConfigValidationResult {
  const schemaPath = configSchemaPath();
  if (!fs.existsSync(schemaPath)) {
    return {
      valid: false,
      schemaPath,
      issues: [{ path: '/', message: `缺少配置 Schema: ${schemaPath}` }],
    };
  }

  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  if (validate(raw)) {
    return { valid: true, issues: [], schemaPath };
  }

  return {
    valid: false,
    schemaPath,
    issues: (validate.errors ?? []).map((error) => ({
      path: error.instancePath || '/',
      message: error.message ?? '配置不符合 Schema',
    })),
  };
}

export function assertValidConfigDocument(raw: unknown): void {
  const result = validateConfigDocument(raw);
  if (result.valid) return;
  const detail = result.issues.map((issue) => `${issue.path} ${issue.message}`).join('；');
  throw new Error(`配置 Schema 校验失败（${result.schemaPath}）：${detail}`);
}
