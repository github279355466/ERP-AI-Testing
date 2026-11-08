import { ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface InputFillResult {
  expected: string;
  actual: string;
  strategy: string;
}

export class InputAdapter extends BaseAdapter {
  async fill(control: ResolvedControl, value: string, name = 'input'): Promise<InputFillResult> {
    this.ensurePolicy('fill');
    await this.ensureVisible(control, name);
    await this.ensureEnabled(control, name);
    await this.ensureEditable(control, name);
    await control.locator.click({ timeout: this.ctx.timeoutMs });
    await control.locator.fill('', { timeout: this.ctx.timeoutMs });
    await control.locator.fill(value, { timeout: this.ctx.timeoutMs });
    await control.locator.press('Tab').catch(() => undefined);
    await this.settle(400);
    const actual = await control.locator.inputValue().catch(() => '');
    if (actual !== value) {
      throw new Error(`[INPUT_POSTCHECK_FAILED] ${name} 期望「${value}」，实际「${actual}」`);
    }
    return { expected: value, actual, strategy: control.strategy };
  }

  async clear(control: ResolvedControl, name = 'input'): Promise<void> {
    this.ensurePolicy('fill');
    await this.ensureVisible(control, name);
    await this.ensureEnabled(control, name);
    await this.ensureEditable(control, name);
    await control.locator.fill('', { timeout: this.ctx.timeoutMs });
    await this.settle(200);
  }

  async read(control: ResolvedControl): Promise<string> {
    return control.locator.inputValue().catch(() => '');
  }

  async isReadOnly(control: ResolvedControl): Promise<boolean> {
    const readOnly = await control.locator.getAttribute('readonly').catch(() => null);
    const ariaReadonly = await control.locator.getAttribute('aria-readonly').catch(() => null);
    return readOnly !== null || ariaReadonly === 'true';
  }

  async isDisabled(control: ResolvedControl): Promise<boolean> {
    return !(await control.locator.isEnabled().catch(() => false));
  }
}
