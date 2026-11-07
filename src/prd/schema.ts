import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';
import { KnowledgeBundle, ObjectType } from './types';
import type { ValidationIssue } from './validate';

const SCHEMA_FILES: Array<{ objectType: ObjectType; file: string; collection: keyof KnowledgeBundle }> = [
  { objectType: 'Document', file: 'Document.schema.json', collection: 'documents' },
  { objectType: 'Entity', file: 'Entity.schema.json', collection: 'entities' },
  { objectType: 'Page', file: 'Page.schema.json', collection: 'pages' },
  { objectType: 'Field', file: 'Field.schema.json', collection: 'fields' },
  { objectType: 'Control', file: 'Control.schema.json', collection: 'controls' },
  { objectType: 'Rule', file: 'Rule.schema.json', collection: 'rules' },
  { objectType: 'Action', file: 'Action.schema.json', collection: 'actions' },
  { objectType: 'Workflow', file: 'Workflow.schema.json', collection: 'workflows' },
  { objectType: 'Dependency', file: 'Dependency.schema.json', collection: 'dependencies' },
  { objectType: 'Scenario', file: 'Scenario.schema.json', collection: 'scenarios' },
  { objectType: 'OpenQuestion', file: 'OpenQuestion.schema.json', collection: 'openQuestions' },
  { objectType: 'ExistingCase', file: 'ExistingCase.schema.json', collection: 'existingCases' },
  { objectType: 'Evidence', file: 'Evidence.schema.json', collection: 'evidence' },
];

export function schemaDirectory(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'schemas'),
    path.resolve(process.cwd(), 'schemas'),
  ];
  return candidates.find((candidate) => fs.existsSync(path.join(candidate, 'common.schema.json'))) ?? candidates[0];
}

export function schemaFiles(): string[] {
  const dir = schemaDirectory();
  return SCHEMA_FILES.map((entry) => path.join(dir, entry.file));
}

export function validateBundleSchemas(bundle: KnowledgeBundle, maxIssuesPerType = 50): ValidationIssue[] {
  const dir = schemaDirectory();
  if (!fs.existsSync(path.join(dir, 'common.schema.json'))) {
    return [
      {
        code: 'SCHEMA_DIRECTORY_MISSING',
        severity: 'ERROR',
        object_type: 'Schema',
        object_id: dir,
        message: '未找到 schemas/ 目录，无法执行 JSON Schema 校验',
      },
    ];
  }
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  ajv.addSchema(JSON.parse(fs.readFileSync(path.join(dir, 'common.schema.json'), 'utf8')));
  const issues: ValidationIssue[] = [];
  for (const entry of SCHEMA_FILES) {
    const schemaPath = path.join(dir, entry.file);
    if (!fs.existsSync(schemaPath)) {
      issues.push({
        code: 'SCHEMA_FILE_MISSING',
        severity: 'ERROR',
        object_type: entry.objectType,
        object_id: entry.file,
        message: `缺少 Schema 文件 ${entry.file}`,
      });
      continue;
    }
    const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
    const collection = bundle[entry.collection] as unknown;
    if (!Array.isArray(collection)) continue;
    let count = 0;
    for (const item of collection as unknown[]) {
      if (count >= maxIssuesPerType) break;
      if (validate(item)) continue;
      count += 1;
      const detail = (validate.errors ?? [])
        .slice(0, 3)
        .map((error) => `${error.instancePath || '/'} ${error.message ?? ''}`.trim())
        .join('；');
      issues.push({
        code: 'SCHEMA_VALIDATION_FAILED',
        severity: 'ERROR',
        object_type: entry.objectType,
        object_id: String((item as { id?: string }).id ?? 'UNKNOWN'),
        message: detail,
      });
    }
  }
  return issues;
}
