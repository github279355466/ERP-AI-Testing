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
    for (let guard = 0; guard < 2; guard += 1) {
      if ((await this.page.locator('[class*="Drawer-module_mask-visible"]').count()) === 0) break;
      await this.page.keyboard.press('Escape').catch(() => undefined);
      await this.page.waitForTimeout(400);
    }
    for (let guard = 0; guard < 3; guard += 1) {
      const modal = this.page.locator('.rc-dialog-wrap:visible').last();
      if ((await modal.count()) === 0) break;
      await this.page.keyboard.press('Escape').catch(() => undefined);
      await this.page.waitForTimeout(300);
      if ((await this.page.locator('.rc-dialog-wrap:visible').count()) === 0) break;
      const cancel = modal.getByRole('button', { name: '取消', exact: true });
      if ((await cancel.count()) > 0) {
        await cancel.last().click().catch(() => undefined);
        await this.page.waitForTimeout(300);
      }
    }
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
