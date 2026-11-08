import { Page } from '@playwright/test';
import { AthenaConfig } from '../config/athena-config';
import { EvidenceManager } from '../evidence/evidence-manager';
import {
  createRunManifest,
  ManifestOutcome,
  RunManifest,
} from '../evidence/run-manifest';
import { EnvironmentGuard } from './environment-guard';
import { createRunContext, RunContext, startupBanner } from './run-context';

export interface RunSession {
  run: RunContext;
  guard: EnvironmentGuard;
  evidence: EvidenceManager;
  manifest: RunManifest;
  attach(page: Page): Promise<void>;
  stopTrace(page: Page, name?: string): Promise<void>;
  addEvidence(file: string | null | undefined): void;
  addCreatedDocument(identifier: string): void;
  finish(outcome: ManifestOutcome, patch?: Partial<RunManifest>): RunManifest;
}

export interface StartRunOptions {
  testCaseId?: string;
  operator?: string;
}

/**
 * 建立一次可审计的运行会话。调用方必须在连接浏览器前创建它。
 * 会话创建即写入 manifest（outcome=not_run），结束时更新 outcome 与证据清单。
 */
export function startRunSession(config: AthenaConfig, options: StartRunOptions = {}): RunSession {
  const guard = new EnvironmentGuard(config);
  guard.assertConnectionAllowed();

  const run = createRunContext(config, {
    testCaseId: options.testCaseId,
    operator: options.operator,
  });
  const expected = config.knowledge.expectedModelVersion.trim();
  if (expected && expected !== run.knowledgeModelVersion) {
    throw new Error(`知识模型版本不匹配：期望 ${expected}，实际 ${run.knowledgeModelVersion ?? 'UNKNOWN'}`);
  }

  const evidence = new EvidenceManager(config, run.runId);
  evidence.init();
  const manifest = createRunManifest({
    runId: run.runId,
    startedAt: run.startedAt,
    environmentName: run.environmentName,
    environmentType: run.environmentType as 'development' | 'test' | 'staging',
    baseURL: run.baseUrl,
    testCaseId: run.testCaseId,
    knowledgeModelVersion: run.knowledgeModelVersion,
    codeCommit: run.codeCommit,
    operator: run.operator,
  });
  evidence.writeManifest(manifest);

  console.log(JSON.stringify({ event: 'run.start', ...startupBanner(config, run) }));

  return {
    run,
    guard,
    evidence,
    manifest,
    async attach(page: Page) {
      evidence.attachDiagnostics(page);
      await evidence.startTrace(page);
    },
    async stopTrace(page: Page, name = 'trace') {
      const file = await evidence.stopTrace(page, name);
      if (file) {
        if (!manifest.evidenceFiles.includes(file)) manifest.evidenceFiles.push(file);
      }
    },
    addEvidence(file: string | null | undefined) {
      if (!file) return;
      if (!manifest.evidenceFiles.includes(file)) manifest.evidenceFiles.push(file);
    },
    addCreatedDocument(identifier: string) {
      const value = identifier.trim();
      if (!value) return;
      if (!manifest.createdDocumentIdentifiers.includes(value)) {
        manifest.createdDocumentIdentifiers.push(value);
      }
    },
    finish(outcome: ManifestOutcome, patch: Partial<RunManifest> = {}) {
      const finished = {
        ...manifest,
        ...patch,
        finishedAt: new Date().toISOString(),
        outcome,
        evidenceFiles: patch.evidenceFiles ?? manifest.evidenceFiles,
        createdDocumentIdentifiers:
          patch.createdDocumentIdentifiers ?? manifest.createdDocumentIdentifiers,
      };
      evidence.writeManifest(finished);
      evidence.pruneExpiredRuns();
      return finished;
    },
  };
}
