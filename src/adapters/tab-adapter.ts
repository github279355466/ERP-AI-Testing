import { ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface TabOptions {
  tabSelector: string;
  activeSelector: string;
  removeSelector?: string;
}

export class TabAdapter extends BaseAdapter {
  async list(options: TabOptions): Promise<string[]> {
    return this.ctx.page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .map((tab) => (tab.textContent ?? '').replace(/\s+/g, ' ').replace('×', '').trim())
        .filter(Boolean);
    }, options.tabSelector);
  }

  async active(options: TabOptions): Promise<string> {
    return this.ctx.page.evaluate((selector) => {
      const active = document.querySelector(selector);
      return (active?.textContent ?? '').replace(/\s+/g, ' ').replace('×', '').trim();
    }, options.activeSelector);
  }

  async activate(title: string, options: TabOptions): Promise<string> {
    this.ensurePolicy('read');
    const tab = this.ctx.page.locator(options.tabSelector).filter({ hasText: title }).first();
    if ((await tab.count()) === 0) throw new Error(`[TAB_NOT_FOUND] 未找到页签「${title}」`);
    await tab.click({ timeout: this.ctx.timeoutMs });
    await this.settle(400);
    const active = await this.active(options);
    if (!active.includes(title)) {
      throw new Error(`[TAB_POSTCHECK_FAILED] 期望页签「${title}」激活，实际「${active}」`);
    }
    return active;
  }

  async close(title: string, options: TabOptions): Promise<boolean> {
    this.ensurePolicy('close-tab');
    const tab = this.ctx.page.locator(options.tabSelector).filter({ hasText: title }).first();
    if ((await tab.count()) === 0) return false;
    const remove = options.removeSelector ? tab.locator(options.removeSelector).first() : null;
    if (remove && (await remove.count()) > 0) {
      await remove.click({ timeout: this.ctx.timeoutMs });
    } else {
      await tab.click({ timeout: this.ctx.timeoutMs });
    }
    await this.settle(400);
    return true;
  }

  async assertActive(title: string, options: TabOptions): Promise<void> {
    const active = await this.active(options);
    if (!active.includes(title)) {
      throw new Error(`[TAB_ACTIVE_MISMATCH] 期望「${title}」，实际「${active}」`);
    }
  }

  async fromControl(control: ResolvedControl, options: TabOptions): Promise<string[]> {
    await control.locator.click({ timeout: this.ctx.timeoutMs }).catch(() => undefined);
    return this.list(options);
  }
}
