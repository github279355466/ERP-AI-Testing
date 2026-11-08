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
import { ContextManager } from '../browser/context-manager';
import { EnvironmentGuard } from '../environment/environment-guard';
import { createRunContext } from '../environment/run-context';
import { RunSession, startRunSession } from '../environment/run-session';
import { explorePage, toCandidateEntry } from '../discovery/page-explorer';
import { redactSecrets } from '../evidence/evidence-manager';
import {
  createRunManifest,
  readRunManifest,
  validateRunManifest,
} from '../evidence/run-manifest';
import { KnowledgeBase } from '../knowledge/knowledge-base';
import { computeKnowledgeModelVersion } from '../knowledge/model-version';
import { NavigationManager } from '../navigation/navigation-manager';
import { SessionManager } from '../session/session-manager';
import { FailureCollector } from '../diagnostics/failure-collector';
import { probePurchaseOrderControls } from '../diagnostics/control-probe';
import { createAdapters } from '../adapters';
import { reconPurchaseOrder } from '../diagnostics/page-recon';
import { mapPageModel } from '../knowledge/page-mapper';
import { PrdKnowledgeBase } from '../knowledge/prd-knowledge';
import { PurchaseOrderPage } from '../pages/purchase/purchase-order.page';
import { createPurchaseOrder } from '../pages/purchase/purchase-order.flow';
import { PurchaseArrivalPage } from '../pages/purchase/purchase-arrival.page';
import { createPurchaseArrival } from '../pages/purchase/purchase-arrival.flow';
import { PurchaseInboundPage } from '../pages/purchase/purchase-inbound.page';
import { createPurchaseInbound } from '../pages/purchase/purchase-inbound.flow';
import { PurchaseReturnPage } from '../pages/purchase/purchase-return.page';
import { createPurchaseReturn } from '../pages/purchase/purchase-return.flow';
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

interface ConnectedRun {
  session: BrowserSession;
  run: RunSession;
}

async function connectWithRun(config: AthenaConfig, testCaseId?: string): Promise<ConnectedRun> {
  const run = startRunSession(config, { testCaseId });
  try {
    const session = config.browser.mode === 'cdp' ? await connectCdp(config) : await launchChromium(config);
    return { session, run };
  } catch (error) {
    run.finish('blocked', {
      evidenceFiles: [],
    });
    run.evidence.log('connection.failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

async function doctor(config: AthenaConfig): Promise<number> {
  const checks: Record<string, { ok: boolean; detail: string }> = {};
  const guard = new EnvironmentGuard(config);
  const report = async (name: string, fn: () => Promise<string>) => {
    try {
      checks[name] = { ok: true, detail: await fn() };
    } catch (error) {
      checks[name] = { ok: false, detail: error instanceof Error ? error.message : String(error) };
    }
  };

  await report('config', async () => `mode=${config.browser.mode}, baseUrl=${config.environment.baseUrl}`);
  await report('gate', async () => {
    const decision = guard.evaluateConnection();
    if (!decision.allowed) throw new Error(`[${decision.code}] ${decision.reason}`);
    return `allowed, type=${config.environment.type}`;
  });
  await report('modelVersion', async () => {
    const info = computeKnowledgeModelVersion(resolveProjectPath(config, config.knowledge.frozenModelPath));
    const expected = config.knowledge.expectedModelVersion.trim();
    if (expected && expected !== info.modelVersion) {
      throw new Error(`版本不匹配：期望 ${expected}，实际 ${info.modelVersion}`);
    }
    return `${info.modelVersion}, generated_at=${info.generatedAt ?? 'UNKNOWN'}`;
  });
  await report('cdp', async () => {
    if (!guard.evaluateConnection().allowed) return 'skipped: gate blocked';
    if (!process.argv.includes('--connect')) return 'skipped: pass --connect to probe CDP';
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
    if (!guard.evaluateConnection().allowed) return 'skipped: gate blocked';
    if (!process.argv.includes('--connect')) return 'skipped: pass --connect to probe browser';
    const { session, run } = await connectWithRun(config, 'P2.0-DOCTOR-BROWSER');
    const manager = new PageManager(session.context, config);
    const pages = manager.summarize().map((page) => ({ ...page, url: redactSecrets(page.url) }));
    await session.disconnect();
    run.finish('passed');
    return pages.map((page) => `${page.kind}:${page.url.split('?')[0]}`).join(' | ') || '(无页面)';
  });
  await report('manifest', async () => {
    const run = createRunContext(config, { testCaseId: 'P2.0-DOCTOR', computeModelVersion: false });
    const manifest = createRunManifest({
      runId: run.runId,
      startedAt: run.startedAt,
      environmentName: run.environmentName,
      environmentType: run.environmentType as 'test',
      baseURL: run.baseUrl,
      testCaseId: run.testCaseId,
      knowledgeModelVersion: run.knowledgeModelVersion,
      codeCommit: run.codeCommit,
      operator: run.operator,
    });
    const validation = validateRunManifest(manifest);
    if (!validation.valid) throw new Error(validation.issues.join('；'));
    return `valid, runId=${manifest.runId}`;
  });

  const ok = Object.values(checks).every((item) => item.ok);
  console.log(JSON.stringify({ success: ok, checks }, null, 2));
  return ok ? 0 : 1;
}

function manifestCheck(args: Args): number {
  const file = args.file ? String(args.file) : '';
  if (!file) throw new Error('用法: manifest:check --file <manifest.json>');
  const manifest = readRunManifest(path.resolve(file));
  const validation = validateRunManifest(manifest);
  console.log(JSON.stringify({ success: validation.valid, schemaPath: validation.schemaPath, issues: validation.issues }, null, 2));
  return validation.valid ? 0 : 1;
}

async function sessionCheck(config: AthenaConfig): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.1-SESSION-CHECK');
  let finished = false;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const manager = new SessionManager(config, contexts, pages);
    const authenticatedPage = await manager.ensureAuthenticated(undefined, {
      strategy: (process.env.ERP_LOGIN_STRATEGY as 'manual' | 'form' | 'storage-state') || 'manual',
    });
    const diagnosis = await manager.diagnose(authenticatedPage);
    const passed = diagnosis.state === 'authenticated';
    console.log(
      JSON.stringify(
        {
          success: passed,
          state: diagnosis.state,
          reason: diagnosis.reason,
          title: diagnosis.title,
          url: redactSecrets(diagnosis.url),
          loginFormVisible: diagnosis.loginFormVisible,
          portalHeaderVisible: diagnosis.portalHeaderVisible,
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    run.finish(passed ? 'passed' : 'blocked');
    finished = true;
    return passed ? 0 : 1;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function navigate(config: AthenaConfig, args: Args): Promise<number> {
  const pageKey = String(args.page ?? 'purchase-order');
  const { session, run } = await connectWithRun(config, `P2.1-NAV-${pageKey}`);
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);

    const portal = await sessions.ensureAuthenticated();
    if (args.fresh) {
      const entry = navigation.getPage(pageKey);
      const closed = await navigation.closeBusinessPage(entry.title);
      run.evidence.log('navigation.fresh', { pageKey, closed });
    }
    const opened = await navigation.openPage(pageKey);
    activePage = opened.business;
    await run.attach(opened.business);
    const ready = await pages.waitReady(opened.business);
    let listReady = null;
    if (opened.entry.ready === 'list') {
      listReady = await pages.waitForListReady(opened.business, 30_000);
      if (!listReady.ok) {
        run.evidence.log('navigation.listReload', { pageKey, reason: 'list not ready' });
        await opened.business.reload({
          waitUntil: 'domcontentloaded',
          timeout: config.browser.navigationTimeoutMs,
        });
        await pages.waitReady(opened.business);
        listReady = await pages.waitForListReady(opened.business, 30_000);
      }
    }
    const passed = listReady ? listReady.ok : ready.ok;
    const detail = await opened.business.evaluate(() => {
      const url = new URL(location.href);
      url.searchParams.delete('token');
      return {
        url: url.toString(),
        title: document.title,
        workItemCode: new URL(location.href).searchParams.get('workItemCode'),
        tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) =>
          (tab.textContent ?? '').replace(/[×\s]+/g, ' ').trim(),
        ),
        rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
        formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
        buttons: Array.from(document.querySelectorAll('button'))
          .filter((button) => (button as HTMLElement).offsetWidth > 0)
          .map((button) => (button.textContent ?? '').replace(/\s+/g, ' ').trim())
          .filter(Boolean)
          .slice(0, 30),
      };
    });
    const screenshot = await run.evidence.screenshot(opened.business, `nav-${pageKey}`);
    const dom = await run.evidence.domSnapshot(opened.business, `nav-${pageKey}`);
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(opened.business);
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          pageKey,
          navigationStatus: opened.entry.status,
          navigationMode: opened.navigationMode,
          menuPath: opened.entry.menuPath,
          portal: redactSecrets(portal.url()),
          business: detail,
          ready: { ...ready, listReady },
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
          manifest: 'manifest.json',
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, `nav-${pageKey}`, error);
      failure.files.forEach((file) => run.addEvidence(file));
      run.evidence.log('navigation.failed', { pageKey, error: failure.message });
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function controlProbe(config: AthenaConfig): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.2-REAL-CONTROLS');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-order');
    activePage = opened.business;
    await run.attach(activePage);
    const closedTabs = await pages.resetTabs(activePage);
    await pages.ensureListState(activePage, { forceReload: closedTabs > 0 });
    await pages.waitForListReady(activePage, 30_000);

    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const add = await adapters.profile.button('新增');
    await adapters.button.click(add, { text: '新增', actionType: 'new' });
    await activePage.waitForFunction(
      () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
      undefined,
      { timeout: config.browser.readyTimeoutMs },
    );

    const result = await probePurchaseOrderControls(activePage, adapters, `P2.2-${run.run.runId}`);
    const screenshot = await run.evidence.screenshot(activePage, 'real-controls');
    const dom = await run.evidence.domSnapshot(activePage, 'real-controls');
    const json = run.evidence.writeJson('real-control-probe', result);
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    run.addEvidence(json);

    await new ErpTabs(activePage).closeActiveWithDiscard();
    await run.stopTrace(activePage);
    const passed =
      result.formItems > 0 &&
      result.checks.inputFillClear.passed &&
      result.checks.lookupOpenCancel.passed &&
      result.checks.saveButton.visible &&
      result.checks.grids.length > 0;
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          title: result.title,
          tabs: result.tabs,
          formItems: result.formItems,
          checks: result.checks,
          files: { screenshot, dom, json },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'real-controls', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function discoverPurchaseOrder(config: AthenaConfig): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.3-DISCOVER-PURCHASE-ORDER');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-order');
    activePage = opened.business;
    await run.attach(activePage);
    const closedTabs = await pages.resetTabs(activePage);
    await pages.ensureListState(activePage, { forceReload: closedTabs > 0 });
    await pages.waitForListReady(activePage, 30_000);

    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const recon = await reconPurchaseOrder(activePage, adapters, {
      navigationPath: opened.entry.menuPath,
      marker: `P2.3-${run.run.runId}`,
    });
    const screenshot = await run.evidence.screenshot(activePage, 'purchase-order-recon');
    const dom = await run.evidence.domSnapshot(activePage, 'purchase-order-recon');
    recon.evidence = [screenshot, dom];
    run.addEvidence(screenshot);
    run.addEvidence(dom);

    const outDir = resolveProjectPath(config, 'artifacts/phase2/03-page-mapping');
    fs.mkdirSync(outDir, { recursive: true });
    const reconFile = path.join(outDir, 'purchase-order.recon.json');
    fs.writeFileSync(reconFile, `${JSON.stringify(recon, null, 2)}\n`, 'utf8');
    run.addEvidence(run.evidence.writeJson('purchase-order.recon', recon));

    await new ErpTabs(activePage).closeActiveWithDiscard();
    await run.stopTrace(activePage);
    run.finish('passed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: true,
          pageKey: recon.pageKey,
          title: recon.actualPageName,
          observedFields: recon.detail.fields.length,
          listHeaders: recon.list.headers.length,
          listRows: recon.list.rows,
          detailTabs: recon.detail.tabs,
          saveButton: recon.detail.saveButton,
          lookup: recon.detail.lookup,
          file: reconFile,
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return 0;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'purchase-order-recon', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

function mapPurchaseOrder(config: AthenaConfig): number {
  const outDir = resolveProjectPath(config, 'artifacts/phase2/03-page-mapping');
  const reconFile = path.join(outDir, 'purchase-order.recon.json');
  if (!fs.existsSync(reconFile)) {
    throw new Error(`页面侦察文件不存在: ${reconFile}。请先执行 phase2:discover。`);
  }
  const recon = JSON.parse(fs.readFileSync(reconFile, 'utf8')) as import('../diagnostics/page-recon').PageRecon;
  const knowledgeDir = resolveProjectPath(config, config.knowledge.frozenModelPath);
  const knowledge = PrdKnowledgeBase.load({ knowledgeDir });
  const entity = knowledge.findEntity('采购订单');
  if (!entity) throw new Error('Phase 1 知识模型中没有采购订单实体');
  const expectedFields = knowledge.fieldsOfEntity(entity.id);
  const modelVersion = computeKnowledgeModelVersion(knowledgeDir).modelVersion;
  const result = mapPageModel({ recon, expectedFields, knowledgeModelVersion: modelVersion });

  const mappingFile = path.join(outDir, 'purchase-order.mapping.json');
  const diffFile = path.join(outDir, 'PURCHASE-ORDER-DIFF.md');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(mappingFile, `${JSON.stringify(result.mapping, null, 2)}\n`, 'utf8');
  fs.writeFileSync(diffFile, `${result.markdown}\n`, 'utf8');

  console.log(
    JSON.stringify(
      {
        success: result.summary.keyRate >= 0.95,
        summary: result.summary,
        files: { mapping: mappingFile, diff: diffFile },
      },
      null,
      2,
    ),
  );
  return result.summary.keyRate >= 0.95 ? 0 : 1;
}

async function createPurchaseOrderCommand(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.4-CREATE-PURCHASE-ORDER');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-order');
    activePage = opened.business;
    await run.attach(activePage);
    const p = new PageManager(session.context, config);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const po = new PurchaseOrderPage(activePage, config, adapters, p);
    await po.resetToList();

    const marker = `ATN-P2-${run.run.runId}`;
    const result = await createPurchaseOrder(activePage, po, {
      opsUnit: String(args['ops-unit'] ?? 'QN001'),
      supplier: String(args.supplier ?? 'SUPP-1001'),
      bizType: String(args['biz-type'] ?? 'Digi_PO0501'),
      docDate: args['doc-date'] ? String(args['doc-date']) : undefined,
      project: args.project ? String(args.project) : undefined,
      remark: marker,
      line: {
        itemNo: String(args.item ?? '01-2-00012'),
        qty: String(args.qty ?? '5'),
        price: String(args.price ?? '10'),
      },
    });
    let submitToast = '';
    let auditResult: { toast: string; row: Record<string, string> | null } | null = null;
    if (args.submit || args.audit) {
      await po.openExisting(result.documentNo);
      if (args.submit) submitToast = await po.submitCurrent();
      await po.closeDetail();
      await po.resetToList();
      if (args.audit) auditResult = await po.audit(result.documentNo);
    }
    const screenshot = await run.evidence.screenshot(activePage, 'purchase-order-created');
    const dom = await run.evidence.domSnapshot(activePage, 'purchase-order-created');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    run.addCreatedDocument(result.documentNo);
    await run.stopTrace(activePage);

    const passed = result.assertions.every((item) => item.passed);
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          marker,
          documentNo: result.documentNo,
          toast: result.toast,
          submitToast,
          audit: auditResult,
          header: result.header,
          line: result.line,
          listRow: result.listRow,
          assertions: result.assertions,
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'purchase-order-create', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function createPurchaseArrivalCommand(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.4-CREATE-PURCHASE-ARRIVAL');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-arrival');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const arrival = new PurchaseArrivalPage(activePage, config, adapters, pages);
    await arrival.resetToList();

    const result = await createPurchaseArrival(activePage, arrival, {
      opsUnit: String(args['ops-unit'] ?? 'QN002'),
      supplier: String(args.supplier ?? 'GN-JD-001'),
      bizType: String(args['biz-type'] ?? 'PO0602'),
      invoiceType: args['invoice-type'] ? String(args['invoice-type']) : '增值税专用发票',
      docDate: args['doc-date'] ? String(args['doc-date']) : undefined,
      sourceDocNo: String(args.source ?? ''),
      expectedItemNo: String(args.item ?? '01-2-00011'),
      expectedQty: String(args.qty ?? '2'),
    });
    const screenshot = await run.evidence.screenshot(activePage, 'purchase-arrival-created');
    const dom = await run.evidence.domSnapshot(activePage, 'purchase-arrival-created');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    run.addCreatedDocument(result.documentNo);
    await run.stopTrace(activePage);

    const passed = result.assertions.every((item) => item.passed);
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          documentNo: result.documentNo,
          toast: result.toast,
          validation: result.validation,
          takeOrder: result.takeOrder,
          header: result.header,
          listRow: result.listRow,
          detailHeader: result.detailHeader,
          detailLines: result.detailLines,
          assertions: result.assertions,
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'purchase-arrival-create', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function submitAuditCommand(config: AthenaConfig, args: Args): Promise<number> {
  const pageKey = String(args.page ?? 'purchase-order');
  const docNo = String(args.doc ?? '');
  if (!docNo) throw new Error('用法: submit-audit --doc <单据号> [--page purchase-order]');
  const { session, run } = await connectWithRun(config, `P2.4-SUBMIT-AUDIT-${pageKey}`);
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage(pageKey);
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const po = new PurchaseOrderPage(activePage, config, adapters, pages);
    await po.resetToList();

    await po.openExisting(docNo);
    const submitToast = await po.submitCurrent();
    await po.closeDetail();
    await po.filterByDocumentNo(docNo);
    const beforeAudit = await po.readListRow(docNo);
    const audit = await po.audit(docNo);

    const screenshot = await run.evidence.screenshot(activePage, 'submit-audit');
    const dom = await run.evidence.domSnapshot(activePage, 'submit-audit');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(activePage);

    const submitted = /成功/.test(submitToast);
    const audited = Boolean(audit.row) && (/成功/.test(audit.toast) || /已审核/.test(audit.row?.manage_status ?? ''));
    const passed = submitted && audited;
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          pageKey,
          docNo,
          submitToast,
          audit,
          beforeAudit,
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'submit-audit', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function submitAuditArrivalCommand(config: AthenaConfig, args: Args): Promise<number> {
  const docNo = String(args.doc ?? '');
  if (!docNo) throw new Error('用法: submit-audit-arrival --doc <到货单号>');
  const { session, run } = await connectWithRun(config, 'P2.4-SUBMIT-AUDIT-ARRIVAL');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-arrival');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const arrival = new PurchaseArrivalPage(activePage, config, adapters, pages);
    await arrival.resetToList();

    await arrival.openExisting(docNo);
    const submitToast = await arrival.submitCurrent();
    await arrival.closeDetail();
    await arrival.resetToList();
    await arrival.filterByDocumentNo(docNo);
    const beforeAudit = await arrival.readListRow(docNo);
    const audit = await arrival.audit(docNo);

    const screenshot = await run.evidence.screenshot(activePage, 'arrival-submit-audit');
    const dom = await run.evidence.domSnapshot(activePage, 'arrival-submit-audit');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(activePage);

    const submitted = /成功/.test(submitToast);
    const audited = Boolean(audit.row) && (/成功/.test(audit.toast) || /已审核/.test(audit.row?.manage_status ?? ''));
    const passed = submitted && audited;
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        { success: passed, docNo, submitToast, audit, beforeAudit, files: { screenshot, dom }, evidenceDir: run.evidence.root },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'arrival-submit-audit', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function createPurchaseInboundCommand(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.4-CREATE-PURCHASE-INBOUND');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-inbound');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const inbound = new PurchaseInboundPage(activePage, config, adapters, pages);
    await inbound.resetToList();

    const result = await createPurchaseInbound(activePage, inbound, {
      opsUnit: String(args['ops-unit'] ?? 'QN002'),
      supplier: String(args.supplier ?? 'GN-JD-001'),
      bizType: String(args['biz-type'] ?? 'IM0301'),
      docDate: args['doc-date'] ? String(args['doc-date']) : undefined,
      sourceDocNo: String(args.source ?? ''),
      expectedItemNo: String(args.item ?? '01-2-00011'),
      expectedQty: String(args.qty ?? '2'),
      warehouse: args.warehouse ? String(args.warehouse) : '00CP',
      storageLocation: args.stsp ? String(args.stsp) : undefined,
    });
    const screenshot = await run.evidence.screenshot(activePage, 'purchase-inbound-created');
    const dom = await run.evidence.domSnapshot(activePage, 'purchase-inbound-created');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    run.addCreatedDocument(result.documentNo);
    await run.stopTrace(activePage);

    const passed = result.assertions.every((item) => item.passed);
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          documentNo: result.documentNo,
          toast: result.toast,
          validation: result.validation,
          takeOrder: result.takeOrder,
          header: result.header,
          listRow: result.listRow,
          detailHeader: result.detailHeader,
          detailLines: result.detailLines,
          assertions: result.assertions,
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'purchase-inbound-create', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function submitAuditInboundCommand(config: AthenaConfig, args: Args): Promise<number> {
  const docNo = String(args.doc ?? '');
  if (!docNo) throw new Error('用法: submit-audit-inbound --doc <采购入库单号>');
  const { session, run } = await connectWithRun(config, 'P2.4-SUBMIT-AUDIT-INBOUND');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-inbound');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const inbound = new PurchaseInboundPage(activePage, config, adapters, pages);
    await inbound.resetToList();

    await inbound.openExisting(docNo);
    const submitToast = await inbound.submitCurrent();
    await inbound.closeDetail();
    await inbound.resetToList();
    await inbound.filterByDocumentNo(docNo);
    const beforeAudit = await inbound.readListRow(docNo);
    const audit = await inbound.audit(docNo);

    const screenshot = await run.evidence.screenshot(activePage, 'inbound-submit-audit');
    const dom = await run.evidence.domSnapshot(activePage, 'inbound-submit-audit');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(activePage);

    const submitted = /成功/.test(submitToast);
    const audited = Boolean(audit.row) && (/成功/.test(audit.toast) || /已审核/.test(audit.row?.manage_status ?? ''));
    const passed = submitted && audited;
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        { success: passed, docNo, submitToast, audit, beforeAudit, files: { screenshot, dom }, evidenceDir: run.evidence.root },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'inbound-submit-audit', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function createPurchaseReturnCommand(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.4-CREATE-PURCHASE-RETURN');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-return');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const ret = new PurchaseReturnPage(activePage, config, adapters, pages);
    await ret.resetToList();

    const stamp = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const defaultDocNo = `P2RTN-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`;
    const result = await createPurchaseReturn(activePage, ret, {
      opsUnit: String(args['ops-unit'] ?? 'QN002'),
      supplier: String(args.supplier ?? 'GN-JD-001'),
      bizType: String(args['biz-type'] ?? 'PO1102'),
      docNo: String(args['doc-no'] ?? defaultDocNo),
      purchaser: String(args.purchaser ?? '00968'),
      project: String(args.project ?? '001'),
      invoiceType: args['invoice-type'] ? String(args['invoice-type']) : undefined,
      docDate: args['doc-date'] ? String(args['doc-date']) : undefined,
      sourceDocNo: args.source ? String(args.source) : undefined,
      itemNo: String(args.item ?? '01-2-00011'),
      qty: String(args.qty ?? '2'),
      warehouse: args.warehouse ? String(args.warehouse) : '00CP',
    });
    const createdNo = result.detailHeader.documentNo || result.header.docNo || String(args['doc-no'] ?? '');
    if (createdNo) run.addCreatedDocument(createdNo);
    const screenshot = await run.evidence.screenshot(activePage, 'purchase-return-created');
    const dom = await run.evidence.domSnapshot(activePage, 'purchase-return-created');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(activePage);

    const passed = result.assertions.every((item) => item.passed);
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(
      JSON.stringify(
        {
          success: passed,
          documentNo: result.detailHeader.documentNo || result.header.docNo || String(args['doc-no'] ?? ''),
          marker: defaultDocNo,
          toast: result.toast,
          validation: result.validation,
          takeOrder: result.takeOrder,
          takeOrderError: result.takeOrderError,
          header: result.header,
          listRow: result.listRow,
          detailHeader: result.detailHeader,
          detailLines: result.detailLines,
          assertions: result.assertions,
          files: { screenshot, dom },
          evidenceDir: run.evidence.root,
        },
        null,
        2,
      ),
    );
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'purchase-return-create', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function submitAuditReturnCommand(config: AthenaConfig, args: Args): Promise<number> {
  const docNo = String(args.doc ?? '');
  if (!docNo) throw new Error('用法: submit-audit-return --doc <采购退货单号>');
  const { session, run } = await connectWithRun(config, 'P2.4-SUBMIT-AUDIT-RETURN');
  let finished = false;
  let activePage: import('@playwright/test').Page | null = null;
  try {
    const pages = new PageManager(session.context, config);
    const contexts = new ContextManager(session.context);
    const sessions = new SessionManager(config, contexts, pages);
    const navigation = new NavigationManager(config, contexts, pages, sessions);
    await sessions.ensureAuthenticated();
    const opened = await navigation.openPage('purchase-return');
    activePage = opened.business;
    await run.attach(activePage);
    const adapters = createAdapters(activePage, new SafetyPolicy(config), config.browser.actionTimeoutMs);
    const ret = new PurchaseReturnPage(activePage, config, adapters, pages);
    await ret.resetToList();

    await ret.openExisting(docNo);
    const hasSubmit = (await activePage.locator('button:visible', { hasText: '提交' }).count()) > 0;
    const submitToast = hasSubmit ? await ret.submitCurrent() : 'SKIPPED(no submit button)';
    await ret.closeDetail();
    await ret.resetToList();
    await ret.filterByDocumentNo(docNo);
    const beforeAudit = await ret.readListRow(docNo);
    const audit = await ret.audit(docNo);

    const screenshot = await run.evidence.screenshot(activePage, 'return-submit-audit');
    const dom = await run.evidence.domSnapshot(activePage, 'return-submit-audit');
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    await run.stopTrace(activePage);

    const submitted = submitToast.startsWith('SKIPPED') || /成功/.test(submitToast);
    const audited = Boolean(audit.row) && (/成功/.test(audit.toast) || /已审核/.test(audit.row?.manage_status ?? ''));
    const passed = submitted && audited;
    run.finish(passed ? 'passed' : 'failed');
    finished = true;
    console.log(JSON.stringify({ success: passed, docNo, submitToast, audit, beforeAudit, files: { screenshot, dom }, evidenceDir: run.evidence.root }, null, 2));
    return passed ? 0 : 1;
  } catch (error) {
    if (activePage) {
      const failure = await new FailureCollector(run.evidence).capture(activePage, 'return-submit-audit', error);
      failure.files.forEach((file) => run.addEvidence(file));
    }
    throw error;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function explore(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run } = await connectWithRun(config, 'P2.0-EXPLORE');
  let finished = false;
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

    await run.attach(page);
    const evidence = run.evidence;

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
    run.addEvidence(screenshot);
    run.addEvidence(dom);
    run.addEvidence(snapshotFile);
    run.addEvidence(candidateFile);

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
    await run.stopTrace(page);
    run.finish(ready.ok ? 'passed' : 'failed');
    finished = true;
    return ready.ok ? 0 : 1;
  } finally {
    if (!finished) run.finish('blocked');
    await session.disconnect();
  }
}

async function status(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run: runSession } = await connectWithRun(config, 'P2.0-STATUS');
  let finished = false;
  try {
    const manager = new PageManager(session.context, config);
    const pages = manager.summarize().map((page) => ({ ...page, url: redactSecrets(page.url) }));
    const businessPages = pages.filter((item) => item.kind === 'business');
    let detail: Record<string, unknown> | null = null;
    if (businessPages.length > 0) {
      const page = args.title
        ? await manager.requirePage({ titleIncludes: String(args.title), prefer: 'last' }, '目标')
        : await manager.business();
      await runSession.attach(page);
      detail = await page.evaluate(() => ({
        path: location.pathname,
        workItemCode: new URL(location.href).searchParams.get('workItemCode'),
        tabs: Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) => (tab.textContent ?? '').replace(/[×\s]+/g, ' ').trim()),
        rows: document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
        formItems: document.querySelectorAll('[class*="FormItem-module_form-item__"]').length,
        footer: (document.body.innerText.match(/共\s*\d+\s*条/) ?? [''])[0],
      }));
      await runSession.stopTrace(page);
    }
    console.log(JSON.stringify({ success: true, pages, business: detail }, null, 2));
    runSession.finish('passed');
    finished = true;
    return 0;
  } finally {
    if (!finished) runSession.finish('blocked');
    await session.disconnect();
  }
}

async function verify(config: AthenaConfig, args: Args): Promise<number> {
  const { session, run: runSession } = await connectWithRun(config, 'P2.0-VERIFY');
  let finished = false;
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

    await runSession.attach(page);
    const evidence = runSession.evidence;
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
    const result: RunResult = {
      runId: evidence.runId,
      environment: config.environment.name,
      tenant: config.environment.tenantId,
      startedAt: caseResult.startedAt,
      finishedAt: new Date().toISOString(),
      cases: [caseResult],
      notes: ['只读执行：未触发任何保存/删除动作'],
    };
    const resultsFile = evidence.writeJson('results', result);
    const markdown = evidence.writeText('report.md', renderMarkdown(result));
    const html = evidence.writeText('report.html', renderHtml(result));
    runSession.addEvidence(resultsFile);
    runSession.addEvidence(markdown);
    runSession.addEvidence(html);

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
    await runSession.stopTrace(page);
    runSession.finish(caseResult.status === 'passed' ? 'passed' : 'failed');
    finished = true;
    return caseResult.status === 'passed' ? 0 : 1;
  } finally {
    if (!finished) runSession.finish('blocked');
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
  const { session, run: runSession } = await connectWithRun(config, 'P2.0-VERIFY-WRITE');
  let finished = false;
  try {
    const caseFiles = String(args.case ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    if (caseFiles.length === 0) {
      throw new Error('用法: athena verify:write --case <case1.json,case2.json> --config config/athena.write.config.json');
    }

    const evidence = runSession.evidence;
    const manager = new PageManager(session.context, config);
    const cases: RunResult['cases'] = [];
    const startedAt = new Date().toISOString();
    const runToken = Date.now().toString(36).slice(-6).toUpperCase();
    let lastPage: import('@playwright/test').Page | null = null;

    for (const file of caseFiles) {
      const definition = JSON.parse(fs.readFileSync(resolveProjectPath(config, file), 'utf8')) as WriteCase;
      definition.vars = { run: runToken, ...(definition.vars ?? {}) };
      const page = await manager.requirePage({ titleIncludes: definition.workItem, prefer: 'last' }, definition.workItem);
      await runSession.attach(page);
      lastPage = page;
      const executor = new WriteExecutor(page, config, evidence, new SafetyPolicy(config));
      cases.push(await executor.runCase(definition));
    }

    const result: RunResult = {
      runId: evidence.runId,
      environment: config.environment.name,
      tenant: config.environment.tenantId,
      startedAt,
      finishedAt: new Date().toISOString(),
      cases,
      notes: ['写入执行：用户明确授权增删改查；测试数据使用唯一前缀并在用例内清理'],
    };
    const resultsFile = evidence.writeJson('results', result);
    const markdown = evidence.writeText('report.md', renderMarkdown(result));
    const html = evidence.writeText('report.html', renderHtml(result));
    runSession.addEvidence(resultsFile);
    runSession.addEvidence(markdown);
    runSession.addEvidence(html);

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
    if (lastPage) await runSession.stopTrace(lastPage);
    const success = cases.every((item) => item.status !== 'failed');
    runSession.finish(success ? 'passed' : 'failed');
    finished = true;
    return success ? 0 : 1;
  } finally {
    if (!finished) runSession.finish('blocked');
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
    case 'manifest:check':
      return manifestCheck(args);
    case 'session:check':
      return sessionCheck(config);
    case 'nav':
      return navigate(config, args);
    case 'controls':
      return controlProbe(config);
    case 'discover':
      return discoverPurchaseOrder(config);
    case 'map':
      return mapPurchaseOrder(config);
    case 'create-po':
      return createPurchaseOrderCommand(config, args);
    case 'create-arrival':
      return createPurchaseArrivalCommand(config, args);
    case 'create-inbound':
      return createPurchaseInboundCommand(config, args);
    case 'create-return':
      return createPurchaseReturnCommand(config, args);
    case 'submit-audit-return':
      return submitAuditReturnCommand(config, args);
    case 'submit-audit-inbound':
      return submitAuditInboundCommand(config, args);
    case 'submit-audit-arrival':
      return submitAuditArrivalCommand(config, args);
    case 'submit-audit':
      return submitAuditCommand(config, args);
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
      console.log('用法: athena <doctor|manifest:check|session:check|nav|controls|discover|map|create-po|create-arrival|create-inbound|submit-audit-arrival|submit-audit-inbound|submit-audit|status|explore|verify|verify:write|report|prd:index|prd:show|prd:section> [--key value]');
      return command === 'help' ? 0 : 1;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(JSON.stringify({ success: false, error: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  });
