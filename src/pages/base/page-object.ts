import { Page } from '@playwright/test';
import { AdapterSet } from '../../adapters';
import { AthenaConfig } from '../../config/athena-config';
import { PageManager } from '../../browser/page-manager';

export class BasePageObject {
  constructor(
    protected readonly page: Page,
    protected readonly config: AthenaConfig,
    protected readonly adapters: AdapterSet,
    protected readonly pages: PageManager,
  ) {}

  async waitListReady(timeoutMs = 30_000): Promise<void> {
    const state = await this.pages.waitForListReady(this.page, timeoutMs);
    if (!state.ok) {
      throw new Error(`[LIST_NOT_READY] 表头=${state.headers} 行数=${state.rows} 空态=${state.emptyState}`);
    }
  }

  async resetToList(): Promise<void> {
    const closed = await this.pages.resetTabs(this.page);
    await this.pages.ensureListState(this.page, { forceReload: closed > 0 });
    await this.waitListReady();
  }
}
