import { execFileSync } from 'node:child_process';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';
import { createRunId } from '../evidence/evidence-manager';
import { computeKnowledgeModelVersion } from '../knowledge/model-version';

export interface RunContext {
  runId: string;
  startedAt: string;
  operator: string;
  testCaseId: string;
  knowledgeModelVersion: string | null;
  codeCommit: string | null;
  environmentName: string;
  environmentType: string;
  baseUrl: string;
}

export interface CreateRunContextOptions {
  testCaseId?: string;
  operator?: string;
  computeModelVersion?: boolean;
}

export function createRunContext(config: AthenaConfig, options: CreateRunContextOptions = {}): RunContext {
  const knowledgeDir = resolveProjectPath(config, config.knowledge.frozenModelPath || 'artifacts/knowledge');
  let knowledgeModelVersion: string | null = null;
  if (options.computeModelVersion !== false) {
    try {
      knowledgeModelVersion = computeKnowledgeModelVersion(knowledgeDir).modelVersion;
    } catch {
      knowledgeModelVersion = null;
    }
  }

  return {
    runId: createRunId(),
    startedAt: new Date().toISOString(),
    operator: resolveOperator(config, options.operator),
    testCaseId: options.testCaseId || config.run?.testCaseId || 'PHASE2-UNSPECIFIED',
    knowledgeModelVersion,
    codeCommit: readCodeCommit(config.projectRoot),
    environmentName: config.environment.name,
    environmentType: config.environment.type,
    baseUrl: config.environment.baseUrl,
  };
}

export function startupBanner(config: AthenaConfig, context: RunContext): Record<string, unknown> {
  return {
    runId: context.runId,
    environmentName: context.environmentName,
    environmentType: context.environmentType,
    baseUrl: redactUrl(context.baseUrl),
    operator: context.operator,
    testCaseId: context.testCaseId,
    knowledgeModelVersion: context.knowledgeModelVersion,
    codeCommit: context.codeCommit,
  };
}

function resolveOperator(config: AthenaConfig, explicit?: string): string {
  const candidate =
    explicit || process.env.ERP_OPERATOR || config.run?.operator || process.env.USERNAME || process.env.USER || '';
  return candidate.trim() || 'unknown';
}

function readCodeCommit(projectRoot: string): string | null {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: projectRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).trim();
  } catch {
    return null;
  }
}

function redactUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    for (const key of ['token', 'access_token', 'password', 'cookie']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '<redacted>');
    }
    return url.toString();
  } catch {
    return value;
  }
}
