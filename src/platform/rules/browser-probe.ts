import { Page } from '@playwright/test';
import { FieldState, FieldStateSnapshot, SaveOutcome, UniqueOutcome } from './engine';

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
      const checkbox = item.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
      const itemText = (item.innerText || '')
        .replace(/\s+/g, ' ')
        .replace(labelText, '')
        .replace(/^[\s*:：]+/, '')
        .trim();
      const placeholder = /^(请选择|请输入|请录入|-|--|—)$/.test(itemText);
      const value = checkbox ? (checkbox.checked ? 'true' : 'false') : inputValue.trim() !== '' ? inputValue : placeholder ? '' : itemText;
      const required = Boolean(item.querySelector('[class*="form-item-label-required"]')) || labelText.includes('*') || /(^|\\s)(required|is-required)(\\s|$)/.test(item.className || '');
      const isSelect = Boolean(item.querySelector('.ath-select'));
      const readonly = isSelect ? false : input ? input.readOnly || input.getAttribute('aria-readonly') === 'true' : false;
      const disabled = input ? input.disabled || input.getAttribute('aria-disabled') === 'true' || (item.className || '').includes('disabled') : (item.className || '').includes('disabled');
      const maxLength = input && 'maxLength' in input ? Number(input.maxLength) : undefined;
      const errorNode = item.querySelector('[class*="explain"], [class*="form-item-status"]');
      const errorMessage = ((errorNode as HTMLElement | null)?.innerText || '').replace(/\s+/g, ' ').trim();
      const rect = item.getBoundingClientRect();
      result[path] = {
        value,
        required,
        readonly,
        disabled,
        visible: rect.width > 0 && rect.height > 0,
        label: labelText,
        maxLength,
        errorMessage,
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
  await page.waitForTimeout(3_000);
  const snapshot = await page.evaluate(() => {
    const dialogs = Array.from(document.querySelectorAll('.rc-dialog-wrap'))
      .filter((node) => (node as HTMLElement).offsetWidth > 0 || (node as HTMLElement).offsetHeight > 0)
      .map((node) => ((node as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim());
    const drawer = Array.from(document.querySelectorAll('[class*="Drawer-module_drawer-content"]')).find(
      (node) => (node as HTMLElement).offsetWidth > 0,
    );
    const drawerText = ((drawer as HTMLElement | undefined)?.innerText || '').replace(/\s+/g, ' ').trim();
    const badge = Array.from(document.querySelectorAll('a[aria-label="打开错误列表"]'))
      .filter((node) => (node as HTMLElement).offsetWidth > 0)
      .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
      .join(' ');
    const bodyLines = (document.body.innerText || '')
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => /必填|不能为空|不能缺失|错误|警告|失败|操作成功|保存成功/.test(line) && line.length < 160);
    const saveButton = Array.from(document.querySelectorAll('button')).find(
      (node) => (node.textContent || '').trim() === '保存',
    ) as HTMLButtonElement | undefined;
    return { dialogs, drawerText, badge, bodyLines, saveDisabled: Boolean(saveButton?.disabled) };
  });
  const message = [...snapshot.dialogs, snapshot.drawerText, snapshot.badge, ...snapshot.bodyLines.slice(-6)]
    .filter(Boolean)
    .join(' | ');
  const hasErrorBadge = /错误\s*[1-9]/.test(snapshot.badge);
  const hasErrorText = /不能为空|不能缺失|必填|错误|失败/.test(`${snapshot.drawerText} ${snapshot.dialogs.join(' ')}`);
  const hasSuccess = /操作成功|保存成功/.test(message);
  const blocked = hasErrorBadge || hasErrorText || (snapshot.saveDisabled && !hasSuccess);
  return { attempted: true, blocked, message: message.slice(0, 600) };
}

/**
 * 唯一性探测：把已有编码填入字段，观察保存按钮是否禁用及悬浮错误提示。
 * 只改表单值，不保存；调用方负责取消/丢弃表单。
 */
export async function probeUniqueField(page: Page, fieldPath: string, duplicateValue: string): Promise<UniqueOutcome> {
  if (!duplicateValue.trim()) return { attempted: false, blocked: false, message: 'DUPLICATE_VALUE_EMPTY' };
  const root = page.locator(`[id="${fieldPath}"]:visible`).last();
  if ((await root.count()) === 0) return { attempted: false, blocked: false, message: 'FIELD_NOT_RENDERED' };
  const input = root.locator('input.digi-input, input').first();
  if ((await input.count()) === 0) return { attempted: false, blocked: false, message: 'INPUT_NOT_FOUND' };

  await input.click().catch(() => undefined);
  await input.fill('').catch(() => undefined);
  await input.type(duplicateValue, { delay: 30 }).catch(async () => {
    await input.evaluate((node, value) => {
      const element = node as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
      setter?.call(element, value);
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
    }, duplicateValue);
  });
  await input.press('Tab').catch(() => undefined);
  await page.waitForTimeout(1_800);

  const saveDisabled = await page
    .getByRole('button', { name: '保存', exact: true })
    .last()
    .isDisabled()
    .catch(() => false);
  let message = '';
  let badgePresent = false;
  const badge = page.locator('a[aria-label="打开错误列表"]:visible').last();
  const badgeText = (await badge.count()) > 0 ? ((await badge.innerText().catch(() => '')) || '').trim() : '';
  if (/错误\s*[1-9]/.test(badgeText)) {
    badgePresent = true;
    await badge.click().catch(() => undefined);
    await page
      .locator('[class*="drawer"]:visible, [class*="Drawer"]:visible')
      .last()
      .waitFor({ state: 'visible', timeout: 5_000 })
      .catch(() => undefined);
    await page.waitForTimeout(600);
    message = await page.evaluate(() => {
      const visible = (node: Element): boolean => {
        const element = node as HTMLElement;
        return element.offsetWidth > 0 || element.offsetHeight > 0;
      };
      const matches = (node: Element): boolean => /drawer|validator|error-list|errorList/i.test(node.className || '');
      const candidates = Array.from(document.querySelectorAll('div,section,aside'))
        .filter((node) => matches(node) && visible(node))
        .map((node) => (node as HTMLElement).innerText.replace(/\s+/g, ' ').trim())
        .filter((text) => text.length > 0);
      const specific = candidates.find((text) => /重复|已存在|不可重复/.test(text));
      return (specific || candidates.sort((a, b) => b.length - a.length)[0] || '').slice(0, 300);
    });
    await page.locator('.validator-drawer-close-btn:visible').last().click({ timeout: 2_000 }).catch(() => undefined);
    await page.waitForTimeout(500);
  } else {
    await input.hover().catch(() => undefined);
    await page.waitForTimeout(900);
    message = await page.evaluate(() => {
      const nodes = Array.from(document.querySelectorAll('.dg-tooltip-content'))
        .filter((node) => (node as HTMLElement).offsetWidth > 0 || (node as HTMLElement).offsetHeight > 0)
        .map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      return nodes[nodes.length - 1] ?? '';
    });
  }
  if (/^错误列表\s*\(\d+\)/.test(message)) message = '';
  return {
    attempted: true,
    blocked: saveDisabled || badgePresent || /已存在|不可重复|重复/.test(message),
    message: message.slice(0, 300),
  };
}
