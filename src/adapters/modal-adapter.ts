import { Locator } from '@playwright/test';
import { BaseAdapter } from './base/base-adapter';

export interface ModalOptions {
  rootSelector: string;
  dialogSelector?: string;
  confirmText: string;
  cancelText: string;
  closeSelector?: string;
}

export interface ModalInfo {
  title: string;
  text: string;
  buttons: string[];
}

export class ModalAdapter extends BaseAdapter {
  async wait(options: ModalOptions): Promise<void> {
    await this.ctx.page.locator(`${options.rootSelector}:visible`).last().waitFor({
      state: 'visible',
      timeout: this.ctx.timeoutMs,
    });
  }

  async read(options: ModalOptions): Promise<ModalInfo | null> {
    const modal = await this.current(options);
    if (!modal) return null;
    const text = (await modal.innerText()).trim();
    const buttons = await modal.evaluate((element) => {
      return Array.from(element.querySelectorAll('button'))
        .filter((button) => (button as HTMLElement).offsetWidth > 0)
        .map((button) => (button.textContent ?? '').trim())
        .filter(Boolean);
    });
    return { title: text.split('\n')[0]?.trim() ?? '', text, buttons };
  }

  async confirm(options: ModalOptions): Promise<void> {
    this.ensurePolicy('confirm');
    const modal = await this.requireCurrent(options);
    await modal.getByRole('button', { name: options.confirmText, exact: true }).last().click({
      timeout: this.ctx.timeoutMs,
    });
    await modal.waitFor({ state: 'hidden', timeout: this.ctx.timeoutMs }).catch(() => undefined);
    await this.settle(500);
  }

  async cancel(options: ModalOptions): Promise<void> {
    this.ensurePolicy('close-tab');
    const modal = await this.current(options);
    if (!modal) return;
    await modal.getByRole('button', { name: options.cancelText, exact: true }).last().click({
      timeout: this.ctx.timeoutMs,
    }).catch(() => undefined);
    await modal.waitFor({ state: 'hidden', timeout: this.ctx.timeoutMs }).catch(() => undefined);
  }

  async close(options: ModalOptions): Promise<void> {
    this.ensurePolicy('close-tab');
    const modal = await this.current(options);
    if (!modal) return;
    if (options.closeSelector && (await modal.locator(options.closeSelector).count()) > 0) {
      await modal.locator(options.closeSelector).first().click({ timeout: this.ctx.timeoutMs });
    } else {
      await this.ctx.page.keyboard.press('Escape');
    }
    await modal.waitFor({ state: 'hidden', timeout: this.ctx.timeoutMs }).catch(() => undefined);
  }

  async current(options: ModalOptions): Promise<Locator | null> {
    const modals = this.ctx.page.locator(`${options.rootSelector}:visible`);
    const count = await modals.count();
    if (count === 0) return null;
    return modals.nth(count - 1);
  }

  private async requireCurrent(options: ModalOptions): Promise<Locator> {
    const modal = await this.current(options);
    if (!modal) throw new Error(`[MODAL_NOT_FOUND] 未找到可见弹窗: ${options.rootSelector}`);
    return modal;
  }
}
