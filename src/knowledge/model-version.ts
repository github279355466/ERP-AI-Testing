import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const MODEL_FILES = [
  'summary.json',
  'documents.json',
  'entities.json',
  'pages.json',
  'fields.json',
  'controls.json',
  'rules.json',
  'actions.json',
  'workflows.json',
  'dependencies.json',
  'scenarios.json',
  'open-questions.json',
  'evidence.json',
] as const;

export interface KnowledgeModelInfo {
  modelVersion: string;
  digest: string;
  generatedAt: string | null;
  schemaVersion: string | null;
  parserVersion: string | null;
  counts: Record<string, number>;
  files: Array<{ name: string; bytes: number; sha256: string }>;
}

export function computeKnowledgeModelVersion(knowledgeDir: string): KnowledgeModelInfo {
  const summaryPath = path.join(knowledgeDir, 'summary.json');
  const summary = fs.existsSync(summaryPath)
    ? (JSON.parse(fs.readFileSync(summaryPath, 'utf8')) as Record<string, unknown>)
    : {};

  const files: KnowledgeModelInfo['files'] = [];
  const digest = crypto.createHash('sha256');
  for (const name of MODEL_FILES) {
    const file = path.join(knowledgeDir, name);
    if (!fs.existsSync(file)) continue;
    const content = fs.readFileSync(file);
    const fileDigest = crypto.createHash('sha256').update(content).digest('hex');
    files.push({ name, bytes: content.byteLength, sha256: fileDigest });
    digest.update(`${name}:${fileDigest}\n`);
  }

  const fullDigest = digest.digest('hex');
  return {
    modelVersion: `KM-${fullDigest.slice(0, 16)}`,
    digest: fullDigest,
    generatedAt: typeof summary.generated_at === 'string' ? summary.generated_at : null,
    schemaVersion: typeof summary.schema_version === 'string' ? summary.schema_version : null,
    parserVersion: typeof summary.parser_version === 'string' ? summary.parser_version : null,
    counts: normalizeCounts(summary.counts),
    files,
  };
}

export function verifyKnowledgeModelVersion(knowledgeDir: string, expected?: string | null): KnowledgeModelInfo {
  const info = computeKnowledgeModelVersion(knowledgeDir);
  const expectedValue = (expected ?? '').trim();
  if (expectedValue && expectedValue !== info.modelVersion) {
    throw new Error(
      `知识模型版本不匹配：期望 ${expectedValue}，实际 ${info.modelVersion}（generated_at=${info.generatedAt ?? 'UNKNOWN'}）`,
    );
  }
  return info;
}

function normalizeCounts(value: unknown): Record<string, number> {
  if (!value || typeof value !== 'object') return {};
  const counts: Record<string, number> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (typeof raw === 'number' && Number.isFinite(raw)) counts[key] = raw;
  }
  return counts;
}
