import { Locator, Page } from '@playwright/test';
import { classifyControl } from './control-classifier';
import { ErpControlKind } from './control-types';
import { fieldLabelSelector, SELECTORS } from '../locator/selectors';

export interface FormFieldInfo {
  fieldPath: string | null;
  label: string;
  required: boolean;
  kind: ErpControlKind;
  reason: string;
  disabled: boolean;
  editable: boolean;
  value: string;
}

interface RawFieldInfo {
  fieldPath: string | null;
  label: string;
  required: boolean;
  tag: string;
  cls: string;
  inputType?: string;
  readOnly: boolean;
  disabled: boolean;
  value: string;
}

export class ErpForm {
  constructor(private readonly page: Page) {}

  container(fieldPath: string): Locator {
    return this.page
      .locator(`${fieldLabelSelector(fieldPath)}:visible`)
      .first()
      .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]');
  }

  control(fieldPath: string): Locator {
    return this.container(fieldPath).locator('input, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]').first();
  }

  async describe(fieldPath: string): Promise<FormFieldInfo> {
    const raw = await this.page.evaluate((path) => {
      const labels = Array.from(document.querySelectorAll(`label[for="${path}"]`));
      const label = labels.find((candidate) => {
        const wrapper = candidate.closest('[class*="FormItem-module_form-item__"]');
        return Boolean(wrapper && (wrapper as HTMLElement).offsetWidth > 0);
      });
      if (!label) return null;
      const item = label.closest('[class*="FormItem-module_form-item__"]');
      if (!item) return null;
      const ctl = item.querySelector('input, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]');
      const cls = ctl ? String(ctl.className) : '';
      return {
        fieldPath: label.getAttribute('for'),
        label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || label.textContent || '').trim(),
        required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
        tag: ctl ? ctl.tagName.toLowerCase() : '',
        cls,
        inputType: ctl?.getAttribute('type') ?? undefined,
        readOnly: ctl ? ctl.hasAttribute('readonly') : false,
        disabled: ctl ? ctl.hasAttribute('disabled') || cls.includes('disabled') : false,
        value: ctl && ctl.tagName === 'INPUT' ? (ctl as HTMLInputElement).value : (ctl?.textContent || '').trim(),
      } satisfies RawFieldInfo;
    }, fieldPath);

    if (!raw) {
      throw new Error(`未找到字段: ${fieldPath}`);
    }
    const classification = classifyControl({
      tag: raw.tag,
      className: raw.cls,
      inputType: raw.inputType,
      readOnly: raw.readOnly,
      disabled: raw.disabled,
    });
    return {
      fieldPath: raw.fieldPath,
      label: raw.label,
      required: raw.required,
      kind: classification.kind,
      reason: classification.reason,
      disabled: raw.disabled,
      editable: isEditable(raw),
      value: raw.value,
    };
  }

  async listFields(): Promise<FormFieldInfo[]> {
    const raws = await this.page.evaluate((itemSelector) => {
      const items = Array.from(document.querySelectorAll(itemSelector)).filter(
        (element) => (element as HTMLElement).offsetWidth > 0,
      );
      return items.map((item) => {
        const label = item.querySelector('label[for]');
        const ctl = item.querySelector('input, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]');
        const cls = ctl ? String(ctl.className) : '';
        return {
          fieldPath: label?.getAttribute('for') ?? null,
          label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || label?.textContent || '').trim(),
          required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
          tag: ctl ? ctl.tagName.toLowerCase() : '',
          cls,
          inputType: ctl?.getAttribute('type') ?? undefined,
          readOnly: ctl ? ctl.hasAttribute('readonly') : false,
          disabled: ctl ? ctl.hasAttribute('disabled') || cls.includes('disabled') : false,
          value: ctl && ctl.tagName === 'INPUT' ? (ctl as HTMLInputElement).value : (ctl?.textContent || '').trim(),
        } satisfies RawFieldInfo;
      });
    }, SELECTORS.form.item);

    return raws.map((raw) => {
      const classification = classifyControl({
        tag: raw.tag,
        className: raw.cls,
        inputType: raw.inputType,
        readOnly: raw.readOnly,
        disabled: raw.disabled,
      });
      return { ...raw, kind: classification.kind, reason: classification.reason, editable: isEditable(raw) };
    });
  }

  async readValue(fieldPath: string): Promise<string> {
    const info = await this.describe(fieldPath);
    return info.value;
  }

  async readSwitch(fieldPath: string): Promise<{ checked: boolean; disabled: boolean; readable: boolean }> {
    const raw = await this.page.evaluate((path) => {
      const labels = Array.from(document.querySelectorAll(`label[for="${path}"]`));
      const label = labels.find((candidate) => {
        const wrapper = candidate.closest('[class*="FormItem-module_form-item__"]');
        return Boolean(wrapper && (wrapper as HTMLElement).offsetWidth > 0);
      });
      const item = label?.closest('[class*="FormItem-module_form-item__"]');
      const control = item?.querySelector('button[class*="Switch-module_switch"]');
      if (!control) return null;
      const cls = String(control.className);
      const aria = control.getAttribute('aria-checked');
      return {
        checked: cls.includes('Switch-module_checked__') || aria === 'true',
        disabled: control.hasAttribute('disabled') || cls.includes('Switch-module_disabled'),
      };
    }, fieldPath);

    if (!raw) {
      throw new Error(`未找到开关控件: ${fieldPath}`);
    }
    return { ...raw, readable: true };
  }
}

function isEditable(raw: RawFieldInfo): boolean {
  if (raw.disabled || raw.readOnly) return false;
  if (raw.tag === 'input' || raw.tag === 'textarea' || raw.tag === 'button') return true;
  return raw.cls.includes('Select-module_select') || raw.cls.includes('WindowSelect-module_windowSelect');
}
