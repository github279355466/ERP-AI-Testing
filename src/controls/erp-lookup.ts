import { Locator, Page } from '@playwright/test';
import { SELECTORS } from '../locator/selectors';

export interface LookupInfo {
  title: string;
  columns: string[];
  rowCount: number;
  hasFilterRow: boolean;
  selectionMode: 'single' | 'multi' | 'unknown';
}

/**
 * 基础资料选择器（WindowSelect）。
 * 只读阶段只允许打开、读取、取消，不提供确认选择的方法。
 */
export class ErpLookup {
  constructor(private readonly page: Page) {}

  trigger(fieldPath: string): Locator {
    return this.page
      .locator(`label[for="${fieldPath}"]:visible`)
      .first()
      .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]')
      .locator(SELECTORS.lookup.root)
      .first();
  }

  async open(fieldPath: string): Promise<void> {
    const trigger = this.trigger(fieldPath);
    const box = await trigger.boundingBox();
    if (!box) throw new Error(`选择器不可见: ${fieldPath}`);
    // 图标位于输入框右端，使用元素包围盒计算，不使用页面绝对坐标。
    await this.page.mouse.click(box.x + box.width - 16, box.y + box.height / 2);
    await this.dialog().waitFor({ state: 'visible', timeout: 15000 });
  }

  dialog(): Locator {
    return this.page.locator(SELECTORS.modal.root).last();
  }

  async info(): Promise<LookupInfo> {
    const dialog = this.dialog();
    const text = (await dialog.innerText()).trim();
    const columns = await dialog.evaluate((element) => {
      return Array.from(element.querySelectorAll('.ag-header-cell'))
        .map((cell) => (cell.textContent ?? '').trim())
        .filter(Boolean);
    });
    const rowCount = await dialog.evaluate((element) => {
      const indexes = new Set(
        Array.from(element.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).map((row) =>
          row.getAttribute('row-index'),
        ),
      );
      return indexes.size;
    });
    const hasFilterRow = await dialog.evaluate((element) => Boolean(element.querySelector('[class*="ConditionArea"]')));
    const radios = await dialog.locator('input.digi-radio-input').count();
    const checkboxes = await dialog.locator('input.digi-checkbox-input').count();
    return {
      title: text.split('\n')[0]?.trim() ?? '',
      columns,
      rowCount,
      hasFilterRow,
      selectionMode: radios > 0 ? 'single' : checkboxes > 0 ? 'multi' : 'unknown',
    };
  }

  async close(): Promise<void> {
    const dialog = this.dialog();
    const cancel = dialog.getByRole('button', { name: '取消', exact: true });
    if ((await cancel.count()) > 0) {
      await cancel.first().click();
    } else if ((await dialog.locator(SELECTORS.modal.close).count()) > 0) {
      await dialog.locator(SELECTORS.modal.close).first().click();
    } else {
      await this.page.keyboard.press('Escape');
    }
    await dialog.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => undefined);
  }
}
