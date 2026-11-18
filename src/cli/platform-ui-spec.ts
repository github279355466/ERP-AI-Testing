import fs from 'node:fs';
import { Page } from '@playwright/test';
import { AthenaConfig } from '../config/athena-config';
import path from 'node:path';
import { BrowserManager } from '../browser/browser-manager';
import { ContextManager } from '../browser/context-manager';
import { PageManager } from '../browser/page-manager';
import { SessionManager } from '../session/session-manager';
import { loadConfig } from '../config/athena-config';
import { createRunId, EvidenceManager } from '../evidence/evidence-manager';
import { PageMappingRegistry } from '../platform/pages/mapping';
import { readStructured, validateData } from '../platform/contracts/validator';
import { buildSpec } from '../platform/ui-spec/capture';
import YAML from 'yaml';
import { checkPage, summarize } from '../platform/ui-spec/check';
import { detectRenderError, extractDetail, extractList, openCreateByUrl, openCreateFromList, openDetailFromList, probeLookupFields } from '../platform/ui-spec/extract';
import { renderRunReport, writeRunArtifacts, UiRunMeta } from '../platform/ui-spec/report';
import { DetailObservation, UiPageResult, UiSpec } from '../platform/ui-spec/types';

interface Args {
  [key: string]: string | boolean | undefined;
}

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = 'run', ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return { command, args };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Athena UI Spec Checker（只读）',
      '',
      '用法：',
      '  node dist/cli/platform-ui-spec.js run --module purchase,purchase-return-outbound',
      '  node dist/cli/platform-ui-spec.js run --module purchase --page purchase-return',
      '',
      '说明：只校验界面规范（字段排列、顺序、显示格式），不触发任何写操作。',
    ].join('\n') + '\n',
  );
}

function loadSpecs(root: string, moduleId: string): { specs: UiSpec[]; issues: string[] } {
  const directory = path.join(root, 'business-modules', moduleId, 'ui-specs');
  if (!fs.existsSync(directory)) return { specs: [], issues: [] };
  const files = fs.readdirSync(directory).filter((file) => /\.ya?ml$/i.test(file)).sort();
  const specs: UiSpec[] = [];
  const issues: string[] = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const data = readStructured(target);
    const validation = validateData('ui-spec', data, { target });
    if (!validation.valid) {
      issues.push(`${file}: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`);
      continue;
    }
    specs.push(data as UiSpec);
  }
  return { specs, issues };
}

async function openListPage(
  contextManager: ContextManager,
  config: AthenaConfig,
  sessionManager: SessionManager,
  pages: PageManager,
  mapping: { page_name: string; navigation: { work_item_code: string } },
): Promise<Page> {
  const portal = await sessionManager.ensureAuthenticated();
  const token = await portal.evaluate(() => {
    const raw = sessionStorage.getItem('DwUserInfo');
    if (!raw) return '';
    try {
      const parsed = JSON.parse(raw) as { token?: string; sid?: string };
      return parsed.token || parsed.sid || '';
    } catch {
      return '';
    }
  });
  if (!token) throw new Error('[SESSION_TOKEN_MISSING] 门户 sessionStorage 中未找到可用会话 token');
  const url = new URL('/list', `https://${config.environment.lowcodeHost}`);
  for (const [key, value] of Object.entries(config.environment.lowcodeQuery ?? {})) url.searchParams.set(key, value);
  url.searchParams.set('token', token);
  url.searchParams.set('tenantId', config.environment.tenantId);
  url.searchParams.set('applicationCode', config.environment.applicationCode);
  url.searchParams.set('workItemCode', mapping.navigation.work_item_code);
  url.searchParams.set('tabName', mapping.page_name);
  url.searchParams.set('routerKey', config.environment.tenantId);
  const page = await contextManager.newPage();
  await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: config.browser.navigationTimeoutMs });
  await pages.waitReady(page);
  await page
    .waitForFunction(() => document.querySelectorAll('.ag-header-cell').length > 0, undefined, { timeout: 25_000 })
    .catch(() => undefined);
  await page.waitForTimeout(1000);
  return page;
}

async function main(): Promise<number> {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  const moduleArg = typeof args.module === 'string' ? args.module : '';
  if (!moduleArg) {
    process.stderr.write('必须提供 --module <id>[,<id>]\n');
    return 1;
  }
  const moduleIds = moduleArg.split(',').map((item) => item.trim()).filter(Boolean);
  const pageFilter = typeof args.page === 'string' ? args.page.split(',').map((item) => item.trim()) : [];
  const configPath = typeof args.config === 'string' ? args.config : 'config/athena.config.json';
  const runId = typeof args['run-id'] === 'string' ? args['run-id'] : createRunId();
  const operator = process.env.ATHENA_OPERATOR ?? 'athena-agent';
  const root = process.cwd();
  const config = loadConfig(configPath);

  const specsByModule: Array<{ moduleId: string; specs: UiSpec[]; issues: string[] }> = [];
  for (const moduleId of moduleIds) {
    const loaded = loadSpecs(root, moduleId);
    specsByModule.push({ moduleId, ...loaded });
  }
  const specIssues = specsByModule.flatMap((entry) => entry.issues.map((issue) => `${entry.moduleId}/${issue}`));
  if (specIssues.length > 0) {
    process.stderr.write(`界面规范文件不符合契约：\n${specIssues.join('\n')}\n`);
    return 1;
  }

  const browser = new BrowserManager(config);
  const session = await browser.connect();
  const contextManager = new ContextManager(session.context);
  const pages = new PageManager(session.context, config);
  const sessionManager = new SessionManager(config, contextManager, pages);
  const evidence = new EvidenceManager(config, runId);
  evidence.init();

  const startedAt = new Date().toISOString();
  const results: UiPageResult[] = [];

  const captureMode = args.capture === true || typeof args.capture === 'string';
  const defaultSourceRef = {
    document_id: 'UI-SPEC-TEMPLATE',
    file_path: 'docs/UI规范/ERP-UI规范.md',
    source_type: 'UI_OBSERVED',
    excerpt: '界面规范基线：字段与列的排列、分组、显示格式、按钮排列',
  };

  for (const entry of specsByModule) {
    const mappings = PageMappingRegistry.load(root, entry.moduleId);
    const existing = new Map(entry.specs.map((spec) => [spec.page_key, spec]));
    const pageKeys = captureMode
      ? mappings.keys().filter((key) => {
          if (pageFilter.length > 0) return pageFilter.includes(key);
          const spec = existing.get(key);
          const file = path.join(root, 'business-modules', entry.moduleId, 'ui-specs', `${key}.yaml`);
          return spec !== undefined || args.force === true || !fs.existsSync(file);
        })
      : pageFilter.length > 0
        ? entry.specs.filter((spec) => pageFilter.includes(spec.page_key)).map((spec) => spec.page_key)
        : entry.specs.map((spec) => spec.page_key);

    for (const pageKey of pageKeys) {
      const mapping = mappings.require(pageKey);
      const seed = existing.get(pageKey);
      let activeSpec: UiSpec | null = seed ?? null;
      const result: UiPageResult = {
        module_id: entry.moduleId,
        page_key: pageKey,
        page_name: seed?.page_name ?? mapping.page_name,
        page_type: seed?.page_type ?? 'document',
        source_ref: seed?.source_ref ?? defaultSourceRef,
        findings: [],
        screenshots: [],
      };

      const resetTransient = (): void => {
        result.findings = [];
        result.list = undefined;
        result.detail = undefined;
        result.screenshots = [];
        result.error = undefined;
      };

      for (let attempt = 1; attempt <= 2; attempt += 1) {
        let business: Page | null = null;
        try {
          business = await openListPage(contextManager, config, sessionManager, pages, mapping);
          const renderError = await detectRenderError(business);
          if (renderError) {
            result.findings = [
              {
                rule: 'PAGE-RENDER',
                title: '页面渲染',
                expectation: '页面正常渲染列表',
                observed: renderError,
                status: 'fail',
                severity: 'P0',
                note: '页面自身报错，界面规范无法继续校验',
              },
            ];
            result.error = renderError;
            break;
          }
          result.list = await extractList(business);
          result.screenshots?.push(await evidence.screenshot(business, `${pageKey}-list`).catch(() => ''));

          const detailPage = await openDetailFromList(business);
          let detailObservation: DetailObservation | undefined;
          if (detailPage) {
            detailObservation = await extractDetail(detailPage);
            result.detail = detailObservation;
            result.screenshots?.push(await evidence.screenshot(detailPage, `${pageKey}-detail`).catch(() => ''));
            if (detailPage !== business) await contextManager.closePage(detailPage);
          }

          if (captureMode && detailObservation && (!activeSpec || args.force === true)) {
            const target = path.join(root, 'business-modules', entry.moduleId, 'ui-specs', `${pageKey}.yaml`);
            const captured = buildSpec({
              module_id: entry.moduleId,
              page_key: pageKey,
              page_name: result.page_name,
              source_ref: result.source_ref,
              list: result.list,
              detail: detailObservation,
            }) as unknown as UiSpec;
            fs.mkdirSync(path.dirname(target), { recursive: true });
            fs.writeFileSync(target, YAML.stringify(captured), 'utf8');
            evidence.log('ui-spec.capture', { page_key: pageKey, file: target });
            activeSpec = captured;
            result.page_type = captured.page_type;
          }

          const lookupConfig = activeSpec?.expectations.detail.lookup_input ?? {
            require_manual_entry: true,
            require_fuzzy_query: true,
            max_fields: 3,
          };
          if (detailObservation && (lookupConfig.require_manual_entry || lookupConfig.require_fuzzy_query)) {
            const targets = detailObservation.fields
              .filter((item) => item.isLookup && /（.+）|\(.+\)/.test(item.value))
              .filter((item) => !/(编号|单号)$/.test(item.label))
              .filter((item, index, all) => all.findIndex((candidate) => candidate.label === item.label) === index)
              .map((item) => {
                const outside = item.value.split(/（|\(/)[0].trim();
                const inside = /[（(]([^）)]+)[）)]/.exec(item.value)?.[1]?.trim() ?? '';
                const outsideIsCode = outside.length > 0 && !/[\u4e00-\u9fa5]/.test(outside);
                const fullCode = outsideIsCode ? outside : inside;
                const nameText = outsideIsCode ? inside : outside;
                const nameKeyword = nameText.length >= 5 ? nameText.slice(2, 5) : nameText.slice(0, 2);
                const codeKeyword = fullCode.slice(0, Math.min(4, fullCode.length));
                return { label: item.label, nameKeyword, codeKeyword };
              })
              .filter((target) => target.label && target.codeKeyword.length >= 2);

            if (targets.length > 0) {
              for (let attempt = 1; attempt <= 2; attempt += 1) {
                try {
                  if (detailPage === business) {
                    await pages.ensureListState(business, { forceReload: true });
                  }
                  const directOpened = await openCreateByUrl(business, mapping.navigation.work_item_code);
                  const createPage = directOpened ? business : await openCreateFromList(business);
                  evidence.log('ui-spec.lookup.create', {
                    page_key: pageKey,
                    attempt,
                    editStatus: /editStatus=([a-z]+)/.exec(createPage.url())?.[1] ?? '',
                    formItems: await createPage.locator('[class*="FormItem-module_form-item"]').count().catch(() => -1),
                  });
                  const probes = await probeLookupFields(createPage, targets, lookupConfig.max_fields);
                  detailObservation.lookupProbes = probes;
                  if (createPage !== business) await contextManager.closePage(createPage).catch(() => undefined);
                  break;
                } catch (error) {
                  evidence.log('ui-spec.lookup.error', {
                    page_key: pageKey,
                    attempt,
                    message: error instanceof Error ? error.message : String(error),
                  });
                  if (attempt >= 2) break;
                  await pages.ensureListState(business, { forceReload: true }).catch(() => false);
                }
              }
            }
          }

          if (activeSpec) {
            result.findings = checkPage(activeSpec, result.list, result.detail);
          }
          if (!detailPage) {
            result.findings.push({
              rule: 'D0-01',
              title: '详情入口',
              expectation: '列表行内提供「查看」入口并可打开详情',
              observed: '未找到「查看」入口，详情页规范未校验',
              status: 'unknown',
              severity: 'P1',
              note: '可能是页面未提供查看按钮，或按钮在「…」收纳菜单中',
            });
          }
          break;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          result.error = message;
          evidence.log('ui-spec.page.error', { page_key: pageKey, attempt, message });
          if (attempt >= 2) break;
          resetTransient();
        } finally {
          if (business) await contextManager.closePage(business);
        }
      }
      results.push(result);
    }
  }

  await browser.disconnect(session);

  const summary = summarize(results);
  const meta: UiRunMeta = {
    run_id: runId,
    module_ids: moduleIds,
    environment: { name: config.environment.name, tenant_id: config.environment.tenantId, base_url: config.environment.baseUrl },
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    operator,
  };
  const written = writeRunArtifacts(root, meta, results, summary);
  const reportDir = path.join(root, 'reports', 'ui-spec');
  fs.mkdirSync(reportDir, { recursive: true });
  const stamp = startedAt.slice(0, 10).replace(/-/g, '');
  const consolidated = typeof args.report === 'string' ? args.report : path.join(reportDir, `UI-SPEC-${stamp}-${runId}.md`);
  fs.mkdirSync(path.dirname(consolidated), { recursive: true });
  fs.writeFileSync(consolidated, renderRunReport(meta, results, summary), 'utf8');

  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'READ_ONLY_UI_SPEC',
        success: summary.failed === 0,
        run_id: runId,
        summary,
        pages: results.map((result) => ({
          page_key: result.page_key,
          page_name: result.page_name,
          failed: result.findings.filter((finding) => finding.status === 'fail').length,
          unknown: result.findings.filter((finding) => finding.status === 'unknown').length,
          error: result.error ?? null,
        })),
        files: { ...written, consolidated },
      },
      null,
      2,
    )}\n`,
  );
  return summary.failed === 0 ? 0 : 2;
}

main()
  .then((code) => {
    process.exit(code);
  })
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 2;
  });
