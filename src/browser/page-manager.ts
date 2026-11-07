import { BrowserContext, Page } from '@playwright/test';
import { AthenaConfig } from '../config/athena-config';
import { SELECTORS } from '../locator/selectors';
import { hostOf, isLowcodePage, isPortalPage, PageCriteria, pickPageByTitle } from './page-match';

export interface PageSummary {
  url: string;
  host: string;
  kind: 'portal' | 'business' | 'other';
}

export interface ReadySignals {
  formItems: number;
  gridRows: number;
  tabs: number;
  emptyState: boolean;
}

export interface ReadyState extends ReadySignals {
  ok: boolean;
  elapsedMs: number;
}

export class PageManager {
  constructor(
    private readonly context: BrowserContext,
    private readonly config: AthenaConfig,
  ) {}

  list(): Page[] {
    return this.context.pages();
  }

  summarize(): PageSummary[] {
    const portalHost = hostOf(this.config.environment.baseUrl);
    return this.list().map((page) => {
      const url = page.url();
      const kind = isLowcodePage(url, this.config.environment.lowcodeHost)
        ? 'business'
        : isPortalPage(url, portalHost)
          ? 'portal'
          : 'other';
      return { url, host: hostOf(url), kind };
    });
  }

  async find(criteria: PageCriteria): Promise<Page | undefined> {
    return pickPageByTitle(this.list(), criteria);
  }

  async requirePage(criteria: PageCriteria, label: string): Promise<Page> {
    const page = await this.find(criteria);
    if (!page) {
      throw new Error(`未找到${label}页面，当前窗口: ${this.list().map((item) => item.url()).join(' | ') || '(空)'}`);
    }
    return page;
  }

  async portal(): Promise<Page> {
    return this.requirePage({ urlIncludes: hostOf(this.config.environment.baseUrl), prefer: 'first' }, '门户');
  }

  async business(): Promise<Page> {
    return this.requirePage({ urlIncludes: this.config.environment.lowcodeHost, prefer: 'last' }, '业务');
  }

  async open(url: string): Promise<Page> {
    const page = await this.context.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: this.config.browser.navigationTimeoutMs });
    return page;
  }

  /**
   * 业务页可能停留在 detail 页签，导致后续用例拿不到列表。
   * 这里回到列表入口并清除详情态参数，属于页面状态复位，不写业务数据。
   */
  async ensureListState(page: Page, options: { forceReload?: boolean } = {}): Promise<boolean> {
    if (hostOf(page.url()) !== this.config.environment.lowcodeHost) return false;
    const url = new URL(page.url());
    const detailKeys = ['pageCode', 'pageName', 'pageQuery', 'rowValue', 'componentType', 'editStatus', 'targetTreeType'];
    const isDetail = url.pathname.endsWith('/detail') || detailKeys.some((key) => url.searchParams.has(key));
    if (isDetail) {
      url.pathname = '/list';
      detailKeys.forEach((key) => url.searchParams.delete(key));
      await page.goto(url.toString(), { waitUntil: 'domcontentloaded', timeout: this.config.browser.navigationTimeoutMs });
      await this.waitReady(page);
      await this.waitForGridRows(page, 1, 15000);
      return true;
    }

    const staleEmpty = await page.evaluate(() => {
      const text = document.body.innerText || '';
      const rows = document.querySelectorAll('.ag-center-cols-container .ag-row').length;
      return rows === 0 && /暂无数据/.test(text);
    });
    if (options.forceReload || staleEmpty) {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: this.config.browser.navigationTimeoutMs });
      await this.waitReady(page);
      await this.waitForGridRows(page, 1, 15000);
      return true;
    }
    return false;
  }

  /**
   * 关闭除首个页签外的所有业务页签（详情/编辑），遇到未保存守卫时选择「直接离开」。
   * 只读测试不存在待保存内容；该动作不写业务数据。
   */
  async resetTabs(page: Page): Promise<number> {
    if (hostOf(page.url()) !== this.config.environment.lowcodeHost) return 0;
    let closed = 0;
    for (let guard = 0; guard < 10; guard += 1) {
      const tabs = page.locator(SELECTORS.business.tabs);
      if ((await tabs.count()) <= 1) break;
      const remove = tabs.last().locator(SELECTORS.business.tabRemove);
      if ((await remove.count()) === 0) break;
      await remove.first().click();
      await page.waitForTimeout(400);
      const discard = page.getByRole('button', { name: '直接离开', exact: true });
      if ((await discard.count()) > 0) {
        await discard.first().click();
        await page.waitForTimeout(400);
      }
      closed += 1;
    }
    const activeTitle = await page.evaluate((selector) => {
      return (document.querySelector(selector)?.textContent ?? '').replace(/\s+/g, ' ').trim();
    }, SELECTORS.business.tabActive);
    // 重复点击已激活的「列表」页签会触发一次空查询，因此在非激活时才切换。
    if (!activeTitle.includes('列表')) {
      const listTab = page.locator(SELECTORS.business.tabs).filter({ hasText: '列表' }).first();
      if ((await listTab.count()) > 0) await listTab.click();
      await page.waitForTimeout(300);
    }
    return closed;
  }

  async waitReady(page: Page, timeoutMs = this.config.browser.readyTimeoutMs ?? 30000): Promise<ReadyState> {
    const started = Date.now();
    const selectorArgs = {
      item: SELECTORS.form.item,
      row: SELECTORS.grid.centerRows,
      tab: SELECTORS.business.tabs,
    };
    try {
      await page.waitForFunction(
        (args) => {
          const formItems = document.querySelectorAll(args.item).length;
          const gridRows = document.querySelectorAll(args.row).length;
          const tabs = document.querySelectorAll(args.tab).length;
          const text = document.body.innerText || '';
          const emptyState = /暂无数据|共\s*0\s*条/.test(text);
          return formItems > 0 || gridRows > 0 || tabs > 0 || emptyState;
        },
        selectorArgs,
        { timeout: timeoutMs, polling: 250 },
      );
    } catch {
      // 超时后仍返回最终信号，由调用方判定 BLOCKED。
    }
    const signals = await page.evaluate(
      (args) => {
        const text = document.body.innerText || '';
        return {
          formItems: document.querySelectorAll(args.item).length,
          gridRows: document.querySelectorAll(args.row).length,
          tabs: document.querySelectorAll(args.tab).length,
          emptyState: /暂无数据|共\s*0\s*条/.test(text),
        };
      },
      selectorArgs,
    );
    return {
      ok: signals.formItems > 0 || signals.gridRows > 0 || signals.tabs > 0 || signals.emptyState,
      elapsedMs: Date.now() - started,
      ...signals,
    };
  }

  /** 等待表格出现真实数据行（可见行），用于列表页加载判定。 */
  async waitForGridRows(page: Page, minRows = 1, timeoutMs = 20000): Promise<number> {
    const started = Date.now();
    let count = 0;
    while (Date.now() - started < timeoutMs) {
      count = await page.evaluate(() => {
        return document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length;
      });
      if (count >= minRows) return count;
      await page.waitForTimeout(300);
    }
    return count;
  }
}
