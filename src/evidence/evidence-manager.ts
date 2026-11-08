import fs from 'node:fs';
import path from 'node:path';
import { BrowserContext, Page } from '@playwright/test';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';
import { ConsoleCapture, PageDiagnosticSnapshot } from '../logging/console-capture';
import { RunManifest, writeRunManifest } from './run-manifest';
import { TraceManager } from './trace-manager';

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
  readonly shots: string;
  readonly dom: string;
  readonly logs: string;
  readonly traces: string;
  readonly reports: string;
  private readonly diagnostics = new WeakMap<Page, ConsoleCapture>();
  private readonly traceManagers = new WeakMap<BrowserContext, TraceManager>();
  private manifest: RunManifest | null = null;

  constructor(
    private readonly config: AthenaConfig,
    readonly runId = createRunId(),
  ) {
    this.root = resolveProjectPath(config, path.join(config.paths.artifacts, runId));
    this.shots = path.join(this.root, 'shots');
    this.dom = path.join(this.root, 'dom');
    this.logs = path.join(this.root, 'logs');
    this.traces = path.join(this.root, 'traces');
    this.reports = path.join(this.root, 'reports');
  }

  init(): void {
    for (const dir of [this.root, this.shots, this.dom, this.logs, this.traces, this.reports]) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.log('run.start', { runId: this.runId, root: this.root });
  }

  async screenshot(page: Page, name: string, fullPage = false): Promise<string> {
    fs.mkdirSync(this.shots, { recursive: true });
    const file = path.join(this.shots, `${sanitize(name)}.png`);
    await page.screenshot({ path: file, fullPage });
    this.log('evidence.screenshot', { file: relativeTo(this.root, file) });
    return relativeTo(this.root, file);
  }

  async domSnapshot(page: Page, name: string): Promise<string> {
    fs.mkdirSync(this.dom, { recursive: true });
    const file = path.join(this.dom, `${sanitize(name)}.html`);
    const html = redactSecrets(await page.content());
    fs.writeFileSync(file, html, 'utf8');
    this.log('evidence.dom', { file: relativeTo(this.root, file) });
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
    fs.writeFileSync(file, redactSecrets(`${JSON.stringify(data, null, 2)}\n`), 'utf8');
    return relativeTo(this.root, file);
  }

  writeText(name: string, content: string): string {
    fs.mkdirSync(this.root, { recursive: true });
    const file = path.join(this.root, sanitize(name));
    fs.writeFileSync(file, redactSecrets(content), 'utf8');
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

  attachDiagnostics(page: Page): void {
    if (this.diagnostics.has(page)) return;
    const capture = new ConsoleCapture(page, this.logs, { log: (event, data) => this.log(event, data) });
    capture.attach();
    this.diagnostics.set(page, capture);
    this.attachRequestLog(page);
  }

  async startTrace(page: Page): Promise<boolean> {
    if (!this.config.evidence.captureTrace) return false;
    const manager = this.traceManager(page.context());
    const started = await manager.start();
    this.log('trace.start', { started });
    return started;
  }

  async stopTrace(page: Page, name = 'trace'): Promise<string | null> {
    const manager = this.traceManagers.get(page.context());
    if (!manager) return null;
    const file = await manager.stop(name);
    if (file) this.log('trace.stop', { file: relativeTo(this.root, file) });
    return file ? relativeTo(this.root, file) : null;
  }

  async captureFailure(
    page: Page,
    name: string,
    extra: Record<string, unknown> = {},
  ): Promise<{ files: string[]; snapshot: PageDiagnosticSnapshot | null }> {
    const files: string[] = [];
    let snapshot: PageDiagnosticSnapshot | null = null;
    try {
      snapshot = await this.diagnostics.get(page)?.snapshot() ?? {
        url: redactSecrets(page.url()),
        title: redactSecrets(await page.title().catch(() => '')),
        console: [],
        pageErrors: [],
      };
      const snapshotFile = this.writeJson(`${name}-diagnostics`, { ...snapshot, ...extra });
      files.push(snapshotFile);
    } catch {
      // 诊断快照失败不阻断原始错误处理。
    }

    if (this.config.evidence.captureScreenshotOnFailure) {
      await this.screenshot(page, `${name}-fail`).then((file) => files.push(file)).catch(() => undefined);
    }
    await this.domSnapshot(page, `${name}-fail`).then((file) => files.push(file)).catch(() => undefined);
    const trace = await this.stopTrace(page, `${name}-fail`).catch(() => null);
    if (trace) files.push(trace);

    this.log('failure.capture', { name, files, ...extra });
    return { files, snapshot };
  }

  writeManifest(manifest: RunManifest): string {
    this.manifest = manifest;
    const file = writeRunManifest(this.root, manifest);
    this.log('manifest.written', { file: relativeTo(this.root, file), outcome: manifest.outcome });
    return file;
  }

  updateManifest(patch: Partial<RunManifest>): RunManifest | null {
    if (!this.manifest) return null;
    this.manifest = { ...this.manifest, ...patch };
    this.writeManifest(this.manifest);
    return this.manifest;
  }

  get currentManifest(): RunManifest | null {
    return this.manifest;
  }

  /**
   * 清理过期 run 目录。只匹配框架自己的 runId 目录格式，不碰 phase2/ 等人工目录。
   */
  pruneExpiredRuns(now = Date.now()): string[] {
    const retentionDays = this.config.evidence.retentionDays;
    if (!Number.isFinite(retentionDays) || retentionDays <= 0) return [];
    const artifactsDir = resolveProjectPath(this.config, this.config.paths.artifacts);
    if (!fs.existsSync(artifactsDir)) return [];
    const cutoff = now - retentionDays * 24 * 60 * 60 * 1000;
    const removed: string[] = [];
    for (const entry of fs.readdirSync(artifactsDir, { withFileTypes: true })) {
      if (!entry.isDirectory() || !/^\d{8}-\d{6}-[a-z0-9]{4}$/.test(entry.name)) continue;
      const dir = path.join(artifactsDir, entry.name);
      const stat = fs.statSync(dir);
      if (stat.mtimeMs >= cutoff) continue;
      fs.rmSync(dir, { recursive: true, force: true });
      removed.push(entry.name);
    }
    if (removed.length > 0) this.log('evidence.prune', { removed });
    return removed;
  }

  private traceManager(context: BrowserContext): TraceManager {
    let manager = this.traceManagers.get(context);
    if (!manager) {
      manager = new TraceManager(context, this.traces);
      this.traceManagers.set(context, manager);
    }
    return manager;
  }
}

function sanitize(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

function relativeTo(root: string, file: string): string {
  return path.relative(root, file).split(path.sep).join('/');
}
