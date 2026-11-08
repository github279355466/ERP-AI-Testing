import fs from 'node:fs';
import path from 'node:path';
import { ConsoleMessage, Page } from '@playwright/test';

export interface DiagnosticLogSink {
  log(event: string, data?: Record<string, unknown>): void;
}

export interface PageDiagnosticSnapshot {
  url: string;
  title: string;
  console: Array<{ type: string; text: string; time: string }>;
  pageErrors: Array<{ message: string; stack: string | null; time: string }>;
}

export class ConsoleCapture {
  private readonly consoleLines: PageDiagnosticSnapshot['console'] = [];
  private readonly pageErrors: PageDiagnosticSnapshot['pageErrors'] = [];
  private attached = false;

  constructor(
    private readonly page: Page,
    private readonly logsDir: string,
    private readonly sink: DiagnosticLogSink,
  ) {}

  attach(): void {
    if (this.attached) return;
    this.attached = true;
    this.page.on('console', (message) => {
      const record = {
        type: message.type(),
        text: redact(message.text()),
        time: new Date().toISOString(),
      };
      this.consoleLines.push(record);
      this.append('console.jsonl', record);
    });
    this.page.on('pageerror', (error) => {
      const record = {
        message: redact(error.message),
        stack: error.stack ? redact(error.stack) : null,
        time: new Date().toISOString(),
      };
      this.pageErrors.push(record);
      this.append('page-errors.jsonl', record);
      this.sink.log('pageerror', { message: record.message });
    });
  }

  async snapshot(): Promise<PageDiagnosticSnapshot> {
    const title = await this.page.title().catch(() => '');
    return {
      url: redact(this.page.url()),
      title: redact(title),
      console: [...this.consoleLines],
      pageErrors: [...this.pageErrors],
    };
  }

  private append(name: string, record: unknown): void {
    fs.mkdirSync(this.logsDir, { recursive: true });
    fs.appendFileSync(path.join(this.logsDir, name), `${JSON.stringify(record)}\n`, 'utf8');
  }
}

const SECRET_PATTERN = /(token|password|passwd|cookie|authorization)(["']?\s*[=:]\s*["']?)([^&\s"',}]+)/gi;

export function redact(value: string): string {
  return value.replace(SECRET_PATTERN, (_match, key: string, sep: string) => `${key}${sep}<redacted>`);
}
