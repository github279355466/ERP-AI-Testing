import { Locator } from '@playwright/test';
import { LocatorCandidate, ResolvedControl } from '../../locator/strategy';
import { AdapterContext } from './adapter-context';

export interface ClickResult {
  usedBoxFallback: boolean;
}

export class BaseAdapter {
  constructor(protected readonly ctx: AdapterContext) {}

  protected resolve(candidates: LocatorCandidate[]): Promise<ResolvedControl> {
    return this.ctx.resolver.resolve(candidates);
  }

  protected async ensureVisible(control: ResolvedControl, name: string): Promise<void> {
    if (!(await control.locator.isVisible().catch(() => false))) {
      throw new Error(`[CONTROL_NOT_VISIBLE] ${name} 不可见；定位=${control.strategy}`);
    }
  }

  protected async ensureEnabled(control: ResolvedControl, name: string): Promise<void> {
    const enabled = await control.locator.isEnabled().catch(() => false);
    const disabledAttr = await control.locator.getAttribute('disabled').catch(() => null);
    if (!enabled || disabledAttr !== null) {
      throw new Error(`[CONTROL_DISABLED] ${name} 不可用；定位=${control.strategy}`);
    }
  }

  protected async ensureEditable(control: ResolvedControl, name: string): Promise<void> {
    const readOnly = await control.locator.getAttribute('readonly').catch(() => null);
    const ariaReadonly = await control.locator.getAttribute('aria-readonly').catch(() => null);
    const className = (await control.locator.getAttribute('class').catch(() => '')) ?? '';
    if (readOnly !== null || ariaReadonly === 'true' || /disabled/.test(className)) {
      throw new Error(`[CONTROL_READONLY] ${name} 只读或禁用；定位=${control.strategy}`);
    }
  }

  protected ensurePolicy(type: string, text?: string): void {
    const decision = this.ctx.policy.evaluate({ type, text });
    if (!decision.allowed) {
      throw new Error(`[${decision.code}] ${decision.reason}`);
    }
  }

  protected async click(
    control: ResolvedControl,
    options: { actionType?: string; text?: string; boxFallback?: boolean } = {},
  ): Promise<ClickResult> {
    this.ensurePolicy(options.actionType ?? 'click', options.text);
    await this.ensureVisible(control, options.text ?? control.strategy);
    await this.ensureEnabled(control, options.text ?? control.strategy);
    try {
      await control.locator.click({ timeout: this.ctx.timeoutMs });
      return { usedBoxFallback: false };
    } catch (error) {
      if (!options.boxFallback) throw error;
      const box = await control.locator.boundingBox();
      if (!box) throw error;
      // 仅对不响应合成事件的自定义组件使用元素包围盒相对坐标。
      await this.ctx.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
      return { usedBoxFallback: true };
    }
  }

  protected async settle(ms = 300): Promise<void> {
    await this.ctx.page.waitForTimeout(ms);
  }

  protected async readText(control: Locator): Promise<string> {
    const inputValue = await control.inputValue().catch(() => null);
    if (inputValue !== null) return inputValue.trim();
    return ((await control.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
  }
}
