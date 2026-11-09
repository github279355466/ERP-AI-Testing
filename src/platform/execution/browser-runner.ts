import { Page } from '@playwright/test';
import { createAdapters } from '../../adapters';
import { PageManager } from '../../browser/page-manager';
import { ContextManager } from '../../browser/context-manager';
import { AthenaConfig } from '../../config/athena-config';
import { EvidenceManager } from '../../evidence/evidence-manager';
import { NavigationFile, NavigationManager } from '../../navigation/navigation-manager';
import { SafetyPolicy } from '../../runner/safety-policy';
import { SessionManager } from '../../session/session-manager';
import { getModuleFlow } from '../../modules/registry';
import { ModuleFlowResult } from '../../modules/types';
import { PlatformTestCase } from '../plan/compile';
import { PageActionExecutor } from '../pages/actions';
import { PageMappingRegistry } from '../pages/mapping';
import { captureFailureEvidence } from '../evidence/diagnostics';
import { CaseRunOutput, CaseRunner, ReportAssertion, ReportStep, classifyFailure } from './scheduler';

const WRITE_ACTIONS = new Set(['fill', 'select_master_data', 'select_option', 'save', 'submit', 'approve', 'unapprove', 'delete', 'upload', 'invoke_flow']);
const READ_ONLY_FLOWS = new Set(['platform:list-smoke', 'foundation-field-rules']);

export interface BrowserRunnerDeps {
  moduleId: string;
  config: AthenaConfig;
  pages: PageManager;
  context: ContextManager;
  session: SessionManager;
  mappings: PageMappingRegistry;
  evidence: EvidenceManager;
  allowWrite: boolean;
  runId: string;
  operator: string;
}

export class BrowserCaseRunner implements CaseRunner {
  private readonly navigation: NavigationManager;
  private currentPage: Page | null = null;
  private currentPageKey: string | null = null;

  constructor(private readonly deps: BrowserRunnerDeps) {
    this.navigation = new NavigationManager(deps.config, deps.context, deps.pages, deps.session, buildNavigationFile(deps.mappings));
  }

  async run(testCase: PlatformTestCase, context: { signal: AbortSignal }): Promise<CaseRunOutput> {
    const requiresWrite = testCase.steps.some((step) =>
      step.action === 'invoke_flow' ? !READ_ONLY_FLOWS.has(step.target) : WRITE_ACTIONS.has(step.action),
    );
    if (requiresWrite && !this.deps.allowWrite) {
      return {
        status: 'blocked',
        steps: [],
        assertions: [],
        evidence: [],
        failure_category: 'manual',
        error_code: 'AUTH_WRITE_NOT_GRANTED',
        error_message: `用例 ${testCase.id} 包含写操作，未传入 --allow-write`,
      };
    }
    const steps: ReportStep[] = [];
    const assertions: ReportAssertion[] = [];
    const evidence: string[] = [];
    const documents: Array<{ document_type: string; identifier: string }> = [];
    let failure: { code: string; message: string } | null = null;

    for (const step of testCase.steps) {
      if (context.signal.aborted) {
        return { status: 'cancelled', steps, assertions, evidence, failure_category: 'none', error_code: 'CANCELLED' };
      }
      try {
        if (step.action === 'navigate') {
          const opened = await this.navigation.openPage(step.target);
          this.currentPage = opened.business;
          this.currentPageKey = step.target;
          await this.currentPage.bringToFront();
          await this.deps.pages.resetTabs(this.currentPage).catch(() => 0);
          await this.deps.pages.ensureListState(this.currentPage, { forceReload: true });
          await this.deps.pages.waitReady(this.currentPage);
          evidence.push(await this.deps.evidence.screenshot(this.currentPage, `nav-${step.target}`));
          steps.push({ action: step.action, status: 'passed', detail: step.target });
          continue;
        }
        const page = this.currentPage;
        if (!page) throw new Error('[PAGE_NOT_OPENED] 尚未导航到业务页面');

        if (step.action === 'invoke_flow') {
          const flow = getModuleFlow(this.deps.moduleId, step.target);
          const params = step.value ? (JSON.parse(substituteRunTokens(step.value, this.deps.runId)) as Record<string, string>) : {};
          const result = await flow({
            page,
            config: this.deps.config,
            adapters: createAdapters(page, new SafetyPolicy(this.deps.config)),
            pages: this.deps.pages,
            params,
            sourceRef: testCase.source_refs[0],
          });
          assertions.push(...toReportAssertions(result, testCase));
          documents.push(...(result.documents ?? []));
          evidence.push(await this.deps.evidence.screenshot(page, `flow-${step.target}`));
          const flowFailed = result.assertions.some((entry) => !entry.passed);
          steps.push({ action: step.action, status: flowFailed ? 'failed' : 'passed', detail: result.notes ?? step.target });
          if (flowFailed) {
            failure = { code: 'ASSERT_VALUE_FAILED', message: `流程 ${step.target} 存在未通过断言` };
            break;
          }
          continue;
        }

        if (step.action === 'capture_evidence') {
          evidence.push(await this.deps.evidence.screenshot(page, `evidence-${steps.length}`));
          steps.push({ action: step.action, status: 'passed', detail: step.target });
          continue;
        }

        const [pageKey, fieldName] = step.target.split('.', 2);
        if (!pageKey || !fieldName) throw new Error(`[STEP_TARGET_INVALID] 动作 ${step.action} 的 target 需为 <page-key>.<field>: ${step.target}`);
        const mapping = this.deps.mappings.require(pageKey);
        const executor = new PageActionExecutor(page, mapping, createAdapters(page, new SafetyPolicy(this.deps.config)), {
          allowWrite: this.deps.allowWrite,
        });
        if (step.action === 'fill') await executor.fill(fieldName, step.value ?? '');
        else if (step.action === 'select_master_data') await executor.selectMasterData(fieldName, step.value ?? '');
        else if (step.action === 'select_option') await executor.selectOption(fieldName, step.value ?? '');
        else if (step.action === 'assert_visible') await executor.assertVisible(fieldName);
        else if (step.action === 'assert_value') await executor.assertValue(fieldName, step.value ?? '');
        else if (step.action === 'save') await executor.save(step.value || '保存');
        else throw new Error(`[STEP_ACTION_UNSUPPORTED] 浏览器执行器暂不支持动作 ${step.action}`);
        steps.push({ action: step.action, status: 'passed', detail: step.target });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const code = /^\[([A-Z0-9_]+)\]/.exec(message)?.[1] ?? 'STEP_FAILED';
        steps.push({ action: step.action, status: 'failed', detail: message });
        failure = { code, message };
        if (this.currentPage) {
          const captured = await captureFailureEvidence(this.currentPage, {
            runId: this.deps.runId,
            caseId: testCase.id,
            stepId: `${steps.length}-${step.action}`,
            error,
            repoRoot: process.cwd(),
          });
          evidence.push(captured.directory);
        }
        break;
      }
    }

    if (failure) {
      return {
        status: 'failed',
        steps,
        assertions,
        evidence,
        failure_category: classifyFailure(failure.code),
        error_code: failure.code,
        error_message: failure.message,
        created_documents: documents,
      };
    }
    const assertionFailed = assertions.length > 0 && assertions.some((entry) => !entry.passed);
    return {
      status: assertionFailed ? 'failed' : 'passed',
      steps,
      assertions,
      evidence,
      ...(assertionFailed ? { failure_category: 'assertion' as const, error_code: 'ASSERT_VALUE_FAILED' } : {}),
      created_documents: documents,
    };
  }
}

function buildNavigationFile(mappings: PageMappingRegistry): NavigationFile {
  const pages: NavigationFile['pages'] = {};
  for (const mapping of mappings.all()) {
    pages[mapping.page_key] = {
      title: mapping.page_name,
      menuPath: mapping.navigation.menu_path,
      workItemCode: mapping.navigation.work_item_code,
      status: mapping.status === 'confirmed' ? 'confirmed' : 'candidate',
      ready: 'list',
    };
  }
  return { version: '1.0', source: 'MODULE_PAGE_MAPPINGS', pages };
}

function substituteRunTokens(value: string, runId: string): string {
  const now = new Date();
  const pad = (input: number): string => String(input).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return value.split('${RUN_ID}').join(runId).split('${RUN_TIMESTAMP}').join(stamp);
}

function toReportAssertions(result: ModuleFlowResult, testCase: PlatformTestCase): ReportAssertion[] {
  return result.assertions.map((entry) => ({
    name: entry.name,
    level: entry.level,
    expected: entry.expected,
    actual: entry.actual,
    passed: entry.passed,
    source_ref: entry.source_ref ?? testCase.source_refs[0],
  }));
}
