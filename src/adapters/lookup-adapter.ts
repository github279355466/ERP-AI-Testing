import { ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface LookupOptions {
  modalSelector: string;
  rowSelector: string;
  filterFieldSelector: string;
  filterValueSelector: string;
  filterButtonText: string;
  confirmText: string;
  cancelText: string;
  optionSelector?: string;
}

export interface LookupInfo {
  title: string;
  columns: string[];
  rowCount: number;
  selectionMode: 'single' | 'multi' | 'unknown';
}

export class LookupAdapter extends BaseAdapter {
  async open(
    trigger: ResolvedControl,
    options: LookupOptions,
    name = 'lookup',
  ): Promise<{ usedBoxFallback: boolean }> {
    this.ensurePolicy('popup');
    await this.ensureVisible(trigger, name);
    await trigger.locator.scrollIntoViewIfNeeded().catch(() => undefined);
    const box = await trigger.locator.boundingBox();
    if (!box) throw new Error(`[LOOKUP_TRIGGER_NOT_VISIBLE] ${name} 无包围盒；定位=${trigger.strategy}`);
    // WindowSelect 的打开图标在输入框右端，自定义组件不响应合成事件。
    await this.ctx.page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
    await this.settle(500);
    await this.ctx.page.locator(`${options.modalSelector}:visible`).last().waitFor({
      state: 'visible',
      timeout: this.ctx.timeoutMs,
    });
    await this.settle(500);
    return { usedBoxFallback: true };
  }

  async openFromCell(
    cell: ResolvedControl,
    options: LookupOptions,
    name = 'lookup-cell',
  ): Promise<void> {
    this.ensurePolicy('popup');
    await this.ensureVisible(cell, name);
    await cell.locator.dblclick({ timeout: this.ctx.timeoutMs });
    await this.ctx.page.locator(`${options.modalSelector}:visible`).last().waitFor({
      state: 'visible',
      timeout: this.ctx.timeoutMs,
    });
    await this.settle(500);
  }

  async filter(
    options: LookupOptions,
    field: string,
    value: string,
  ): Promise<void> {
    this.ensurePolicy('filter');
    const modal = this.modal(options);
    await modal.locator(options.filterFieldSelector).first().click({ timeout: this.ctx.timeoutMs });
    await this.settle(300);
    await this.ctx.page
      .locator(`${options.optionSelector ?? '.ath-select-item-option'}:visible`)
      .filter({ hasText: field })
      .first()
      .click({ timeout: this.ctx.timeoutMs });
    const input = modal.locator(options.filterValueSelector).first();
    await input.fill(value, { timeout: this.ctx.timeoutMs });
    await modal.getByRole('button', { name: options.filterButtonText, exact: true }).last().click({
      timeout: this.ctx.timeoutMs,
    });
    await this.settle(1_200);
  }

  async selectRow(options: LookupOptions, value: string): Promise<void> {
    this.ensurePolicy('select');
    const modal = this.modal(options);
    const row = modal.locator(options.rowSelector).filter({ hasText: value }).first();
    if ((await row.count()) === 0) {
      throw new Error(`[LOOKUP_ROW_NOT_FOUND] 未找到包含「${value}」的行`);
    }
    await row.click({ timeout: this.ctx.timeoutMs });
    await this.settle(400);
  }

  async confirm(options: LookupOptions): Promise<void> {
    this.ensurePolicy('confirm');
    const modal = this.modal(options);
    await modal.getByRole('button', { name: options.confirmText, exact: true }).last().click({
      timeout: this.ctx.timeoutMs,
    });
    await modal.waitFor({ state: 'hidden', timeout: this.ctx.timeoutMs }).catch(() => undefined);
    await this.settle(800);
  }

  async cancel(options: LookupOptions): Promise<void> {
    this.ensurePolicy('close-tab');
    const modal = this.modal(options);
    await modal.getByRole('button', { name: options.cancelText, exact: true }).last().click({
      timeout: this.ctx.timeoutMs,
    }).catch(() => undefined);
    await modal.waitFor({ state: 'hidden', timeout: this.ctx.timeoutMs }).catch(() => undefined);
  }

  async readInfo(options: LookupOptions): Promise<LookupInfo> {
    const modal = this.modal(options);
    return modal.evaluate((element, args) => {
      const rows = new Set(
        Array.from(element.querySelectorAll(args.rowSelector)).map((row) => row.getAttribute('row-index')),
      );
      const radios = element.querySelectorAll('input.digi-radio-input').length;
      const checkboxes = element.querySelectorAll('input.digi-checkbox-input').length;
      const text = element.textContent ?? '';
      return {
        title: text.split('\n')[0]?.trim() ?? '',
        columns: Array.from(element.querySelectorAll('.ag-header-cell'))
          .map((cell) => (cell.textContent ?? '').trim())
          .filter(Boolean),
        rowCount: rows.size,
        selectionMode: radios > 0 ? 'single' : checkboxes > 0 ? 'multi' : 'unknown',
      };
    }, { rowSelector: options.rowSelector });
  }

  async readBack(input: ResolvedControl): Promise<string> {
    return input.locator.inputValue().catch(() => this.readText(input.locator));
  }

  private modal(options: LookupOptions) {
    return this.ctx.page.locator(`${options.modalSelector}:visible`).last();
  }
}
