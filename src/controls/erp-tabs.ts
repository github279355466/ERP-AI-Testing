import { Page } from '@playwright/test';
import { SELECTORS } from '../locator/selectors';

export interface CloseTabResult {
  closed: boolean;
  guardShown: boolean;
}

export class ErpTabs {
  constructor(private readonly page: Page) {}

  async list(): Promise<string[]> {
    return this.page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .map((tab) => (tab.textContent ?? '').replace(/\s+/g, ' ').replace('×', '').trim())
        .filter(Boolean);
    }, SELECTORS.business.tabs);
  }

  async active(): Promise<string> {
    return this.page.evaluate((selector) => {
      const active = document.querySelector(selector);
      return (active?.textContent ?? '').replace(/\s+/g, ' ').replace('×', '').trim();
    }, SELECTORS.business.tabActive);
  }

  async open(title: string): Promise<void> {
    await this.page.locator(SELECTORS.business.tabs).filter({ hasText: title }).first().click();
    await this.page.waitForTimeout(300);
  }

  /**
   * 关闭当前页签。若出现未保存守卫，选择「直接离开」丢弃未保存内容。
   * 只读测试不应产生脏数据；该动作不写入 ERP。
   */
  async closeActiveWithDiscard(): Promise<CloseTabResult> {
    const activeTab = this.page.locator(`${SELECTORS.business.tabActive} ${SELECTORS.business.tabRemove}`).first();
    if ((await activeTab.count()) === 0) {
      return { closed: false, guardShown: false };
    }
    await activeTab.click();
    await this.page.waitForTimeout(500);
    const discard = this.page.getByRole('button', { name: '直接离开', exact: true });
    const guardShown = (await discard.count()) > 0;
    if (guardShown) {
      await discard.first().click();
      await this.page.waitForTimeout(500);
    }
    return { closed: true, guardShown };
  }
}
