import fs from 'node:fs';
import path from 'node:path';
import { Page } from '@playwright/test';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';

const SECRET_PATTERN = /(token|password|passwd|cookie|authorization)(["']?\s*[=:]\s*["']?)([^&\s"',}]+)/gi;

export function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, (_match, key: string, sep: string) => `${key}${sep}<redacted>`);
}

export function createRunId(now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${stamp}-${suffix}`;
}

export class EvidenceManager {
  readonly root: string;
  private readonly shots: string;
  private readonly dom: string;
  private readonly logs: string;

  constructor(
    private readonly config: AthenaConfig,
    readonly runId = createRunId(),
  ) {
    this.root = resolveProjectPath(config, path.join(config.paths.artifacts, runId));
    this.shots = path.join(this.root, 'shots');
    this.dom = path.join(this.root, 'dom');
    this.logs = path.join(this.root, 'logs');
  }

  init(): void {
    for (const dir of [this.root, this.shots, this.dom, this.logs]) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  async screenshot(page: Page, name: string, fullPage = false): Promise<string> {
    fs.mkdirSync(this.shots, { recursive: true });
    const file = path.join(this.shots, `${sanitize(name)}.png`);
    await page.screenshot({ path: file, fullPage });
    return relativeTo(this.root, file);
  }

  async domSnapshot(page: Page, name: string): Promise<string> {
    fs.mkdirSync(this.dom, { recursive: true });
    const file = path.join(this.dom, `${sanitize(name)}.html`);
    const html = redactSecrets(await page.content());
    fs.writeFileSync(file, html, 'utf8');
    return relativeTo(this.root, file);
  }

  log(event: string, data: Record<string, unknown> = {}): void {
    fs.mkdirSync(this.logs, { recursive: true });
    const line = JSON.stringify({
      time: new Date().toISOString(),
      event,
      ...data,
    });
    fs.appendFileSync(path.join(this.logs, 'run.jsonl'), `${redactSecrets(line)}\n`, 'utf8');
  }

  writeJson(name: string, data: unknown): string {
    fs.mkdirSync(this.root, { recursive: true });
    const file = path.join(this.root, `${sanitize(name)}.json`);
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return relativeTo(this.root, file);
  }

  writeText(name: string, content: string): string {
    fs.mkdirSync(this.root, { recursive: true });
    const file = path.join(this.root, sanitize(name));
    fs.writeFileSync(file, content, 'utf8');
    return relativeTo(this.root, file);
  }

  attachRequestLog(page: Page): void {
    fs.mkdirSync(this.logs, { recursive: true });
    const file = path.join(this.logs, 'requests.jsonl');
    page.on('request', (request) => {
      if (!['xhr', 'fetch', 'document'].includes(request.resourceType())) return;
      const record = {
        time: new Date().toISOString(),
        method: request.method(),
        url: redactSecrets(request.url()),
        type: request.resourceType(),
      };
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    });
    page.on('requestfailed', (request) => {
      const record = {
        time: new Date().toISOString(),
        method: request.method(),
        url: redactSecrets(request.url()),
        failure: request.failure()?.errorText ?? 'unknown',
      };
      fs.appendFileSync(file, `${JSON.stringify(record)}\n`, 'utf8');
    });
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function relativeTo(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}
