import { LocatorCandidate, ResolvedControl } from '../locator/strategy';
import { BaseAdapter, ClickResult } from './base/base-adapter';

export class ButtonAdapter extends BaseAdapter {
  async click(
    control: ResolvedControl,
    options: { text?: string; actionType?: string } = {},
  ): Promise<ClickResult> {
    return super.click(control, {
      actionType: options.actionType ?? 'click',
      text: options.text,
      boxFallback: false,
    });
  }

  async clickByText(
    candidates: LocatorCandidate[],
    text: string,
    actionType = 'click',
  ): Promise<ClickResult> {
    const control = await this.resolve(candidates);
    return this.click(control, { actionType, text });
  }

  async isVisible(control: ResolvedControl): Promise<boolean> {
    return control.locator.isVisible().catch(() => false);
  }

  async isEnabled(control: ResolvedControl): Promise<boolean> {
    return control.locator.isEnabled().catch(() => false);
  }
}
