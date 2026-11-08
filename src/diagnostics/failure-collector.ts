import { Page } from '@playwright/test';
import { EvidenceManager } from '../evidence/evidence-manager';
import { PageDiagnosticSnapshot } from '../logging/console-capture';

export interface FailureEvidence {
  message: string;
  files: string[];
  snapshot: PageDiagnosticSnapshot | null;
}

export class FailureCollector {
  constructor(private readonly evidence: EvidenceManager) {}

  async capture(page: Page, name: string, error: unknown): Promise<FailureEvidence> {
    const message = error instanceof Error ? error.message : String(error);
    const result = await this.evidence.captureFailure(page, name, { error: message });
    return { message, files: result.files, snapshot: result.snapshot };
  }
}
