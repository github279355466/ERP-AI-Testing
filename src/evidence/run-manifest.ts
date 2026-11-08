import fs from 'node:fs';
import path from 'node:path';
import Ajv2020 from 'ajv/dist/2020';

export type ManifestOutcome = 'passed' | 'failed' | 'blocked' | 'not_run';
export type ManifestEnvironmentType = 'development' | 'test' | 'staging';

export interface RunManifest {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  environmentName: string;
  environmentType: ManifestEnvironmentType;
  baseURL?: string;
  testCaseId: string;
  knowledgeModelVersion: string | null;
  codeCommit: string | null;
  operator: string | null;
  createdDocumentIdentifiers: string[];
  outcome: ManifestOutcome;
  evidenceFiles: string[];
}

export interface ManifestValidationResult {
  valid: boolean;
  issues: string[];
  schemaPath: string;
}

const MANIFEST_SCHEMA = 'run-manifest.schema.json';

export function runManifestSchemaPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..', 'schemas', MANIFEST_SCHEMA),
    path.resolve(process.cwd(), 'schemas', MANIFEST_SCHEMA),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate)) ?? candidates[0];
}

export function validateRunManifest(manifest: unknown): ManifestValidationResult {
  const schemaPath = runManifestSchemaPath();
  if (!fs.existsSync(schemaPath)) {
    return { valid: false, schemaPath, issues: [`缺少 Schema: ${schemaPath}`] };
  }

  const issues: string[] = [];
  const record = manifest as Partial<RunManifest> | null;
  if (!record || typeof record !== 'object') {
    return { valid: false, schemaPath, issues: ['manifest 必须是对象'] };
  }
  if (!isDateString(record.startedAt)) issues.push('startedAt 必须是 ISO date-time');
  if (record.finishedAt !== null && record.finishedAt !== undefined && !isDateString(record.finishedAt)) {
    issues.push('finishedAt 必须是 ISO date-time 或 null');
  }
  if (record.baseURL && !isUri(record.baseURL)) issues.push('baseURL 必须是合法 URI');

  const ajv = new Ajv2020({ allErrors: true, strict: false, validateFormats: false });
  const validate = ajv.compile(JSON.parse(fs.readFileSync(schemaPath, 'utf8')));
  if (!validate(manifest)) {
    for (const error of validate.errors ?? []) {
      issues.push(`${error.instancePath || '/'} ${error.message ?? '不符合 Schema'}`.trim());
    }
  }
  return { valid: issues.length === 0, schemaPath, issues };
}

export function createRunManifest(input: Partial<RunManifest> & {
  runId: string;
  startedAt: string;
  environmentName: string;
  environmentType: ManifestEnvironmentType;
  testCaseId: string;
}): RunManifest {
  const manifest: RunManifest = {
    runId: input.runId,
    startedAt: input.startedAt,
    finishedAt: input.finishedAt ?? null,
    environmentName: input.environmentName,
    environmentType: input.environmentType,
    testCaseId: input.testCaseId,
    knowledgeModelVersion: input.knowledgeModelVersion ?? null,
    codeCommit: input.codeCommit ?? null,
    operator: input.operator ?? null,
    createdDocumentIdentifiers: input.createdDocumentIdentifiers ?? [],
    outcome: input.outcome ?? 'not_run',
    evidenceFiles: input.evidenceFiles ?? [],
  };
  if (input.baseURL) manifest.baseURL = input.baseURL;
  return manifest;
}

export function writeRunManifest(directory: string, manifest: RunManifest): string {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'manifest.json');
  fs.writeFileSync(file, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return file;
}

export function readRunManifest(file: string): RunManifest {
  return JSON.parse(fs.readFileSync(file, 'utf8')) as RunManifest;
}

function isDateString(value: unknown): boolean {
  return typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value));
}

function isUri(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
