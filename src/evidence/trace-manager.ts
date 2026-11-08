import fs from 'node:fs';
import path from 'node:path';
import { BrowserContext } from '@playwright/test';

export class TraceManager {
  private started = false;

  constructor(
    private readonly context: BrowserContext,
    private readonly traceDir: string,
  ) {}

  async start(): Promise<boolean> {
    if (this.started) return true;
    try {
      await this.context.tracing.start({ screenshots: true, snapshots: true, sources: true });
      this.started = true;
      return true;
    } catch {
      this.started = false;
      return false;
    }
  }

  async stop(name: string): Promise<string | null> {
    if (!this.started) return null;
    fs.mkdirSync(this.traceDir, { recursive: true });
    const file = path.join(this.traceDir, `${sanitize(name)}.zip`);
    try {
      await this.context.tracing.stop({ path: file });
      this.started = false;
      return file;
    } catch {
      this.started = false;
      return null;
    }
  }

  get isStarted(): boolean {
    return this.started;
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}
