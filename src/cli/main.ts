import fs from 'node:fs';
import path from 'node:path';
import {
  AthenaConfig,
  loadConfig,
  resolveBrowserUserDataDir,
  resolvePrdDir,
  resolveProjectPath,
} from '../config/athena-config';
import { connectCdp } from '../browser/cdp-adapter';
import { launchChromium } from '../browser/playwright-adapter';
import { BrowserSession } from '../browser/session';
import { PageManager } from '../browser/page-manager';
import { explorePage, toCandidateEntry } from '../discovery/page-explorer';
import { EvidenceManager, redactSecrets } from '../evidence/evidence-manager';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { buildPrdIndex, findPrdEntry, readPrdIndex, readPrdSection, writePrdIndex } from '../knowledge/prd-index';
import { ReadonlyCase, ReadonlyExecutor } from '../runner/readonly-executor';
import { SafetyPolicy } from '../runner/safety-policy';
import { WriteCase, WriteExecutor } from '../runner/write-executor';
import { ErpTabs } from '../controls/erp-tabs';
import { renderMarkdown } from '../reporting/markdown-reporter';
import { renderHtml } from '../reporting/html-reporter';
import { RunResult } from '../reporting/types';

interface Args {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = 'help', ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = rest[index + 1];
      if (next && !next.startsWith('--')) {
        args[key] = next;
        index += 1;
      } else {
        args[key] = true;
      }
    }
  }
  return { command, args };
}

async function connect(config: AthenaConfig): Promise<BrowserSession> {
  return config.browser.mode === 'cdp' ? connectCdp(config) : launchChromium(config);
}

async function doctor(config: AthenaConfig): Promise<number> {
  const checks: Record<string, { ok: boolean; detail: string }> = {};
  const report = async (name: string, fn: () => Promise<string>) => {
    try {
      checks[name] = { ok: true, detail: await fn() };
    } catch (error) {
      checks[name] = { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  };

  await report('config', async () => `mode=${config.browser.mode}, baseUrl=${config.environment.baseUrl}`);
  await report('cdp', async () => {
    const response = await fetch(`${config.browser.cdpEndpoint}/json/version`, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = (await response.json()) as { Browser?: string };
    return payload.Browser ?? 'connected';
  });
  await report('profile', async () => {
    const dir = resolveBrowserUserDataDir(config);
    return fs.existsSync(dir) ? dir : `${dir} (不存在，首次启动会自动创建)`;
  });
  await report('knowledge', async () => {

    const knowledge = KnowledgeBase.load(config);
    return `${knowledge.bundle.pages.length} pages, ${knowledge.bundle.rules.length} rules`;
  });
  await report('browser', async () => {
    const session = await connect(config);
    const manager = new PageManager(session.context, config);
    const pages = manager.summarize().map((page) => ({ ...page, url: redactSecrets(page.url) }));
    await session.disconnect();
    return pages.map((page) => `${page.kind}:${page.url.split('?')[0]}`).join(' | ') || '(无页面)';
  });

  const ok = Object.values(checks).every((item) => item.ok);
  console.log(JSON.stringify({ success: ok, checks }, null, 2));
  return ok ? 0 : 1;
}

async function explore(config: AthenaConfig, args: Args): Promise<number> {
  const session = await connect(config);
  try {
    const manager = new PageManager(session.context, config);
    const page = args.page
      ? await manager.requirePage({ urlIncludes: String(args.page), titleIncludes: String(args.page), prefer: 'last' }, '目标')
      : args.title
        ? await manager.requirePage({ titleIncludes: String(args.title), prefer: 'last' }, '目标')
      : await manager.business();
    const closedTabs = await manager.resetTabs(page);
    const reset = await manager.ensureListState(page, { forceReload: closedTabs > 0 });
    let ready = await manager.waitReady(page);
    await page.bringToFront();

    if (args.detail) {
      const opened = await page.evaluate(() => {
        const button = Array.from(document.querySelectorAll('button.custom-op-text-btn')).find(
          (item) => (item.textContent ?? '').trim() === '查看' && (item as HTMLElement).offsetWidth > 0,
        );
        if (!button) return false;
        (button as HTMLElement).click();
        return true;
      });
      if (!opened) throw new Error('未找到可见的「查看」按钮，无法打开详情');
      await page.waitForFunction(
        () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
        undefined,
        { timeout: config.browser.readyTimeoutMs },
      );
      ready = await manager.waitReady(page);
    }

    const evidence = new EvidenceManager(config);
    evidence.init();
    evidence.attachRequestLog(page);

    const snapshot = await explorePage(page);
    const screenshot = await evidence.screenshot(page, 'explore');
    const dom = await evidence.domSnapshot(page, 'explore');
    const snapshotFile = evidence.writeJson('snapshot', snapshot);

    const candidate = toCandidateEntry(snapshot, {
      id: String(args.id ?? 'explored-page'),
      menuPath: args.menuPath ? String(args.menuPath).split('/') : [],
      workItemCode: args.workItemCode ? String(args.workItemCode) : undefined,
      entity: args.entity ? String(args.entity) : undefined,
      type: args.type ? (String(args.type) as 'lowcode-list' | 'portal' | 'unknown') : undefined,
    });
    const candidateFile = evidence.writeJson('candidate-page', candidate);

    if (args.detail) {
      await new ErpTabs(page).closeActiveWithDiscard();
    }

    console.log(
      JSON.stringify(
        {
          success: ready.ok,
          page: { url: snapshot.url, title: snapshot.title, resetToList: reset },
          ready,
          counts: {
            fields: snapshot.fields.length,
            gridRows: snapshot.grid.rowCount,
            columns: snapshot.grid.headers.length,
            tabs: snapshot.tabs.length,
            buttons: snapshot.buttons.length,
            menuNodes: snapshot.menu?.length ?? 0,
          },
          files: { snapshot: snapshotFile, candidate: candidateFile, screenshot, dom },
          evidenceDir: evidence.root,
        },
        null,
        2,
      ),
    );
    return ready.ok ? 0 : 1;
  } finally {
    await session.disconnect();
  }
}

async function status(config: AthenaConfig, args: Args): Promise<number> {
  const session = await connect(config);
  try {
    const manager = new PageManager(session.context, config);
    const pages = manager.summarize().map((page) => ({ ...page, url: redactSecrets(page.url) }));
    const businessPages = pages.filter((item) => item.kind === 'business');
    let detail: Record<string, unknown> | null = null;
    if (businessPages.length > 0) {
      const page = args.title
        ? await manager.requirePage({ titleIncludes: String(args.title), prefer: 'last' }, '目标')
        : await manager.business();
      detail = await page.evaluate(() => ({
        path: location.pathname,
        workItemCode: new URL(location.href).searchParams.get('workItemCode'),
        tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => (tab.textContent ?? '').replace(/[×\s]+/g, ' ').trim()),
        rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
        formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
        footer: (document.body.innerText.match(/共\s*\d+\s*条/) ?? [''])[0],
      }));
    }
    console.log(JSON.stringify({ success: true, pages, business: detail }, null, 2));
    return 0;
  } finally {
    await session.disconnect();
  }
}

async function verify(config: AthenaConfig, args: Args): Promise<number> {
  const session = await connect(config);
  try {
    const manager = new PageManager(session.context, config);
    const page = args.page
      ? await manager.requirePage({ urlIncludes: String(args.page), titleIncludes: String(args.page), prefer: 'last' }, '目标')
      : args.title
        ? await manager.requirePage({ titleIncludes: String(args.title), prefer: 'last' }, '目标')
      : await manager.business();
    const closedTabs = await manager.resetTabs(page);
    await manager.ensureListState(page, { forceReload: closedTabs > 0 });
    await manager.waitReady(page);
    await page.bringToFront();

    const evidence = new EvidenceManager(config);
    evidence.init();
    evidence.attachRequestLog(page);
    const executor = new ReadonlyExecutor(page, config, evidence, new SafetyPolicy(config));

    let definition: ReadonlyCase;
    if (args.case) {
      definition = JSON.parse(fs.readFileSync(resolveProjectPath(config, String(args.case)), 'utf8')) as ReadonlyCase;
    } else {
      const pageId = String(args['page-id'] ?? 'invnt-param');
      const knowledge = KnowledgeBase.load(config);
      const pageInfo = knowledge.findPage(pageId);
      if (!pageInfo) throw new Error(`知识库中没有页面: ${pageId}`);
      definition = {
        id: `SMOKE-${pageInfo.id}`,
        name: `${pageInfo.name} 只读冒烟`,
        steps: [
          { action: 'assertCount', level: 'ui', name: '页面容器已渲染', selector: '.ant-tabs-tab, .ag-row, [class*="FormItem-module_form-item__"]', min: 1 },
          { action: 'screenshot', name: 'smoke' },
        ],
      };
    }

    const caseResult = await executor.runCase(definition);
    const run: RunResult = {
      runId: evidence.runId,
      environment: config.environment.name,
      tenant: config.environment.tenantId,
      startedAt: caseResult.startedAt,
      finishedAt: new Date().toISOString(),
      cases: [caseResult],
      notes: ['只读执行：未触发任何保存/删除动作'],
    };
    evidence.writeJson('results', run);
    const markdown = evidence.writeText('report.md', renderMarkdown(run));
    const html = evidence.writeText('report.html', renderHtml(run));

    console.log(
      JSON.stringify(
        {
          success: caseResult.status === 'passed',
          case: { id: caseResult.id, status: caseResult.status, assertions: caseResult.assertions.length },
          files: { results: 'results.json', markdown, html },
          evidenceDir: evidence.root,
        },
        null,
        2,
      ),
    );
    return caseResult.status === 'passed' ? 0 : 1;
  } finally {
    await session.disconnect();
  }
}

function report(config: AthenaConfig, args: Args): number {
  const resultsPath = resolveProjectPath(config, String(args.results ?? ''));
  const run = JSON.parse(fs.readFileSync(resultsPath, 'utf8')) as RunResult;
  const outDir = path.dirname(resultsPath);
  const mdPath = path.join(outDir, 'report.md');
  const htmlPath = path.join(outDir, 'report.html');
  fs.writeFileSync(mdPath, renderMarkdown(run), 'utf8');
  fs.writeFileSync(htmlPath, renderHtml(run), 'utf8');
  console.log(JSON.stringify({ success: true, markdown: mdPath, html: htmlPath }, null, 2));
  return 0;
}

async function verifyWrite(config: AthenaConfig, args: Args): Promise<number> {
  const session = await connect(config);
  try {
    const caseFiles = String(args.case ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (caseFiles.length === 0) {
      throw new Error('用法: athena verify:write --case <case1.json,case2.json> --config config/athena.write.config.json');
    }

    const evidence = new EvidenceManager(config);
    evidence.init();
    const manager = new PageManager(session.context, config);
    const cases: RunResult['cases'] = [];
    const startedAt = new Date().toISOString();
    const runToken = Date.now().toString(36).slice(-6).toUpperCase();

    for (const file of caseFiles) {
      const definition = JSON.parse(fs.readFileSync(resolveProjectPath(config, file), 'utf8')) as WriteCase;
      definition.vars = { run: runToken, ...(definition.vars ?? {}) };
      const page = await manager.requirePage({ titleIncludes: definition.workItem, prefer: 'last' }, definition.workItem);
      evidence.attachRequestLog(page);
      const executor = new WriteExecutor(page, config, evidence, new SafetyPolicy(config));
      cases.push(await executor.runCase(definition));
    }

    const run: RunResult = {
      runId: evidence.runId,
      environment: config.environment.name,
      tenant: config.environment.tenantId,
      startedAt,
      finishedAt: new Date().toISOString(),
      cases,
      notes: ['写入执行：用户明确授权增删改查；测试数据使用唯一前缀并在用例内清理'],
    };
    evidence.writeJson('results', run);
    const markdown = evidence.writeText('report.md', renderMarkdown(run));
    const html = evidence.writeText('report.html', renderHtml(run));

    console.log(
      JSON.stringify(
        {
          success: cases.every((item) => item.status !== 'failed'),
          cases: cases.map((item) => ({ id: item.id, status: item.status, assertions: item.assertions.length })),
          files: { results: 'results.json', markdown, html },
          evidenceDir: evidence.root,
        },
        null,
        2,
      ),
    );
    return cases.every((item) => item.status !== 'failed') ? 0 : 1;
  } finally {
    await session.disconnect();
  }
}

async function prdIndex(config: AthenaConfig, args: Args): Promise<number> {
  const rootDir = args.dir ? String(args.dir) : resolvePrdDir(config);
  const knowledgeDir = resolveProjectPath(config, config.paths.knowledge);
  const pageMap = JSON.parse(fs.readFileSync(path.join(knowledgeDir, 'athena-page-map.json'), 'utf8')) as {
    pages: Array<{ id: string; name: string }>;
  };

  const index = buildPrdIndex({
    rootDir,
    testPlanRoot: resolveProjectPath(config, 'athena-erp-test-plans/plans'),
    pageMap,
  });
  const output = path.join(knowledgeDir, 'athena-prd-map.json');
  writePrdIndex(output, index);

  const matched = index.entries.filter((entry) => entry.testPlanIds.length > 0).length;
  console.log(
    JSON.stringify(
      {
        success: true,
        sourceRoot: index.sourceRoot,
        output,
        entries: index.entries.length,
        matchedTestPlans: matched,
        unmatched: index.entries.filter((entry) => entry.testPlanIds.length === 0).map((entry) => entry.workItem),
      },
      null,
      2,
    ),
  );
  return 0;
}

function prdShow(config: AthenaConfig, args: Args): number {
  if (!args['work-item'] && !args['page-id'] && !args.plan) {
    throw new Error('用法: prd:show --work-item <作业> | --page-id <页面> | --plan <TP 编号>');
  }
  const file = path.join(resolveProjectPath(config, config.paths.knowledge), 'athena-prd-map.json');
  if (!fs.existsSync(file)) {
    throw new Error(`PRD 索引不存在，请先执行 npm run athena -- prd:index: ${file}`);
  }
  const index = readPrdIndex(file);
  const entry = findPrdEntry(index, {
    workItem: args['work-item'] ? String(args['work-item']) : undefined,
    pageId: args['page-id'] ? String(args['page-id']) : undefined,
    testPlanId: args.plan ? String(args.plan) : undefined,
  });
  if (!entry) throw new Error('没有匹配的 PRD 条目');
  console.log(JSON.stringify({ success: true, entry }, null, 2));
  return 0;
}

function prdSection(config: AthenaConfig, args: Args): number {
  const workItem = args['work-item'] ? String(args['work-item']) : '';
  const section = args.section ? String(args.section) : '';
  if (!workItem || !section) {
    throw new Error('用法: prd:section --work-item <作业> --section <标题片段>');
  }
  const file = path.join(resolveProjectPath(config, config.paths.knowledge), 'athena-prd-map.json');
  const index = readPrdIndex(file);
  const entry = findPrdEntry(index, { workItem });
  if (!entry) throw new Error(`PRD 索引中没有作业: ${workItem}`);

  const prdFile = path.join(index.sourceRoot, entry.relativePath);
  const content = fs.readFileSync(prdFile, 'utf8');
  const text = readPrdSection(content, section);
  if (!text) throw new Error(`PRD ${workItem} 中未找到章节: ${section}`);

  console.log(
    JSON.stringify(
      {
        success: true,
        workItem,
        prdVersion: entry.prdVersion,
        section,
        content: text,
      },
      null,
      2,
    ),
  );
  return 0;
}

async function main(): Promise<number> {
  const { command, args } = parseArgs(process.argv.slice(2));
  const config = loadConfig(args.config ? String(args.config) : undefined);
  switch (command) {
    case 'doctor':
      return doctor(config);
    case 'explore':
      return explore(config, args);
    case 'status':
      return status(config, args);
    case 'verify':
      return verify(config, args);
    case 'verify:write':
      return verifyWrite(config, args);
    case 'report':
      return report(config, args);
    case 'prd:index':
      return prdIndex(config, args);
    case 'prd:show':
      return prdShow(config, args);
    case 'prd:section':
      return prdSection(config, args);
    default:
      console.log('用法: athena <doctor|status|explore|verify|verify:write|report|prd:index|prd:show|prd:section> [--key value]');
      return command === 'help' ? 0 : 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  });
