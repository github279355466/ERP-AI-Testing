import { Locator } from '@playwright/test';
import { LocatorCandidate, ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface DropdownOptions {
  overlaySelector: string;
  optionSelector: string;
  selectedSelector?: string;
}

export class DropdownAdapter extends BaseAdapter {
  async open(
    control: ResolvedControl,
    options: DropdownOptions,
    name = 'dropdown',
  ): Promise<{ usedBoxFallback: boolean }> {
    this.ensurePolicy('read');
    await this.ensureVisible(control, name);
    await this.ensureEnabled(control, name);
    const clicked = await this.click(control, { actionType: 'read', boxFallback: true });
    await this.ctx.page.locator(`${options.overlaySelector}:visible`).first().waitFor({
      state: 'visible',
      timeout: this.ctx.timeoutMs,
    });
    return { usedBoxFallback: clicked.usedBoxFallback };
  }

  async options(options: DropdownOptions): Promise<string[]> {
    const overlay = this.ctx.page.locator(`${options.overlaySelector}:visible`).last();
    const items = overlay.locator(options.optionSelector);
    const count = await items.count();
    const values: string[] = [];
    for (let index = 0; index < count; index += 1) {
      const item = items.nth(index);
      if (!(await item.isVisible().catch(() => false))) continue;
      const text = ((await item.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
      if (text) values.push(text);
    }
    return values;
  }

  async select(
    control: ResolvedControl,
    optionText: string,
    options: DropdownOptions,
    name = 'dropdown',
  ): Promise<string> {
    this.ensurePolicy('select');
    await this.open(control, options, name);
    const target = this.ctx.page
      .locator(`${options.overlaySelector}:visible ${options.optionSelector}`)
      .filter({ hasText: optionText })
      .first();
    if ((await target.count()) === 0) {
      throw new Error(`[DROPDOWN_OPTION_NOT_FOUND] ${name} 未找到选项「${optionText}」`);
    }
    await target.click({ timeout: this.ctx.timeoutMs });
    await this.settle(500);
    const actual = await this.read(control, options);
    if (!actual.includes(optionText)) {
      throw new Error(`[DROPDOWN_POSTCHECK_FAILED] ${name} 期望包含「${optionText}」，实际「${actual}」`);
    }
    return actual;
  }

  async read(control: ResolvedControl, options: DropdownOptions): Promise<string> {
    if (options.selectedSelector) {
      const selected = this.ctx.page.locator(options.selectedSelector).first();
      if ((await selected.count()) > 0) {
        return ((await selected.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
      }
    }
    return this.readText(control.locator);
  }

  async close(options: DropdownOptions): Promise<void> {
    await this.ctx.page.keyboard.press('Escape');
    await this.settle(200);
    await this.ctx.page.locator(`${options.overlaySelector}:visible`).first().waitFor({
      state: 'hidden',
      timeout: 3_000,
    }).catch(() => undefined);
  }

  async openByCandidates(
    candidates: LocatorCandidate[],
    options: DropdownOptions,
    name = 'dropdown',
  ): Promise<{ usedBoxFallback: boolean }> {
    const control = await this.resolve(candidates);
    return this.open(control, options, name);
  }

  async optionLocator(options: DropdownOptions, optionText: string): Promise<Locator> {
    return this.ctx.page
      .locator(`${options.overlaySelector}:visible ${options.optionSelector}`)
      .filter({ hasText: optionText })
      .first();
  }
}
