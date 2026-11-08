import { Page } from '@playwright/test';
import { FieldState, FieldStateSnapshot, SaveOutcome } from './engine';

export async function captureFieldStates(page: Page, fields: string[]): Promise<FieldStateSnapshot> {
  const states = await page.evaluate((paths) => {
    const result: Record<string, unknown> = {};
    for (const path of paths) {
      const label = document.querySelector(`label[for="${path}"]`);
      const item = label?.closest('[class*="FormItem-module_form-item__"]') as HTMLElement | null;
      if (!item) {
        result[path] = { value: '', required: false, readonly: false, disabled: false, visible: false, label: '' };
        continue;
      }
      const input = item.querySelector('input, textarea') as HTMLInputElement | HTMLTextAreaElement | null;
      const labelText = (item.querySelector('[class*="form-item-label-text__"]')?.textContent || label?.textContent || '')
        .replace(/\*/g, '')
        .replace(/[:：\s]+$/, '')
        .replace(/\s+/g, ' ')
        .trim();
      const inputValue = input ? input.value : '';
      const itemText = (item.innerText || '')
        .replace(/\s+/g, ' ')
        .replace(labelText, '')
        .replace(/^[\s*:：]+/, '')
        .trim();
      const placeholder = /^(请选择|请输入|请录入|-|--|—)$/.test(itemText);
      const value = inputValue.trim() !== '' ? inputValue : placeholder ? '' : itemText;
      const required = Boolean(item.querySelector('[class*="form-item-label-required"]')) || labelText.includes('*') || /(^|\\s)(required|is-required)(\\s|$)/.test(item.className || '');
      const readonly = input ? input.readOnly || input.getAttribute('aria-readonly') === 'true' : false;
      const disabled = input ? input.disabled || input.getAttribute('aria-disabled') === 'true' || (item.className || '').includes('disabled') : (item.className || '').includes('disabled');
      const rect = item.getBoundingClientRect();
      result[path] = {
        value,
        required,
        readonly,
        disabled,
        visible: rect.width > 0 && rect.height > 0,
        label: labelText,
      } satisfies FieldState;
    }
    return result;
  }, fields);
  return { fields: states as Record<string, FieldState> };
}

export async function captureSaveOutcome(page: Page, buttonText = '保存'): Promise<SaveOutcome> {
  const button = page.getByRole('button', { name: buttonText, exact: true }).first();
  if ((await button.count()) === 0) return { attempted: false, blocked: false, message: 'SAVE_BUTTON_NOT_FOUND' };
  await button.click({ timeout: 15_000 }).catch(() => undefined);
  await page.waitForTimeout(2_500);
  const dialogs = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.rc-dialog-wrap'))
      .filter((node) => (node as HTMLElement).offsetWidth > 0 || (node as HTMLElement).offsetHeight > 0)
      .map((node) => ((node as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim()),
  );
  const bodyLines = await page.evaluate(() =>
    (document.body.innerText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /必填|不能为空|不能缺失|错误|警告|失败|操作成功|保存成功/.test(line) && line.length < 160),
  );
  const message = [...dialogs, ...bodyLines.slice(-6)].join(' | ');
  const blocked = /不能为空|不能缺失|必填|错误|警告|失败/.test(message) && !/操作成功|保存成功/.test(message);
  return { attempted: true, blocked, message: message.slice(0, 600) };
}
