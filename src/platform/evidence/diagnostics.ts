import fs from 'node:fs';
import path from 'node:path';
import { Page } from '@playwright/test';
import { redactSecrets } from '../../evidence/evidence-manager';
import { LocatorAttempt } from '../../locator/strategy';

export interface LocatorDiagnostic {
  name: string;
  strategy: string;
  attempts: LocatorAttempt[];
}

export interface FailureEvidenceInput {
  runId: string;
  caseId: string;
  stepId: string;
  error: unknown;
  locators?: LocatorDiagnostic[];
  repoRoot?: string;
  extra?: Record<string, unknown>;
}

export interface FailureEvidence {
  directory: string;
  screenshot?: string;
  dom?: string;
  meta: string;
  error_code: string;
  url: string;
}

function sanitize(name: string): string {
  return name.replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 80);
}

export function errorCodeOf(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /^\[([A-Z0-9_]+)\]/.exec(message)?.[1] ?? 'UNCLASSIFIED_ERROR';
}

export async function captureFailureEvidence(page: Page, input: FailureEvidenceInput): Promise<FailureEvidence> {
  const repoRoot = input.repoRoot ?? process.cwd();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const directory = path.join(
    repoRoot,
    'artifacts',
    input.runId,
    'failures',
    `${sanitize(input.caseId)}-${sanitize(input.stepId)}-${stamp}`,
  );
  fs.mkdirSync(directory, { recursive: true });
  const evidence: FailureEvidence = {
    directory,
    meta: path.join(directory, 'meta.json'),
    error_code: errorCodeOf(input.error),
    url: redactSecrets(page.url()),
  };
  try {
    evidence.screenshot = path.join(directory, 'failure.png');
    await page.screenshot({ path: evidence.screenshot, fullPage: true });
  } catch {
    delete evidence.screenshot;
  }
  try {
    evidence.dom = path.join(directory, 'dom.html');
    fs.writeFileSync(evidence.dom, redactSecrets(await page.content()), 'utf8');
  } catch {
    delete evidence.dom;
  }
  const meta = {
    captured_at: new Date().toISOString(),
    run_id: input.runId,
    case_id: input.caseId,
    step_id: input.stepId,
    error_code: evidence.error_code,
    error_message: redactSecrets(input.error instanceof Error ? input.error.message : String(input.error)),
    url: evidence.url,
    title: await page.title().catch(() => ''),
    viewport: page.viewportSize(),
    locators: input.locators ?? [],
    extra: input.extra ?? {},
  };
  fs.writeFileSync(evidence.meta, `${redactSecrets(JSON.stringify(meta, null, 2))}\n`, 'utf8');
  return evidence;
}
