import { ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface DateAdapterOptions {
  pickerCellSelector?: string;
}

export class DateAdapter extends BaseAdapter {
  async fill(
    control: ResolvedControl,
    value: string,
    options: DateAdapterOptions = {},
    name = 'date',
  ): Promise<string> {
    this.ensurePolicy('pick-date');
    await this.ensureVisible(control, name);
    await this.ensureEnabled(control, name);
    await this.ensureEditable(control, name);
    await control.locator.click({ timeout: this.ctx.timeoutMs });
    await this.settle(300);

    const pickerCell = options.pickerCellSelector
      ? this.ctx.page.locator(options.pickerCellSelector.replace('{value}', value)).first()
      : null;
    if (pickerCell && (await pickerCell.count()) > 0 && (await pickerCell.isVisible().catch(() => false))) {
      await pickerCell.click({ timeout: this.ctx.timeoutMs });
    } else {
      await control.locator.fill(value, { timeout: this.ctx.timeoutMs });
      await control.locator.press('Enter').catch(() => undefined);
    }
    await this.settle(500);
    const actual = await control.locator.inputValue().catch(() => '');
    if (actual !== value) {
      throw new Error(`[DATE_POSTCHECK_FAILED] ${name} 期望「${value}」，实际「${actual}」`);
    }
    return actual;
  }

  async read(control: ResolvedControl): Promise<string> {
    return control.locator.inputValue().catch(() => '');
  }
}
