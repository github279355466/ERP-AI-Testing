import { Locator, Page } from '@playwright/test';
import { SELECTORS } from '../locator/selectors';

export class ErpDropdown {
  constructor(private readonly page: Page) {}

  container(fieldPath: string): Locator {
    return this.page
      .locator(`label[for="${fieldPath}"]:visible`)
      .first()
      .locator('xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]')
      .locator(SELECTORS.select.root)
      .first();
  }

  async open(fieldPath: string): Promise<void> {
    const target = this.container(fieldPath);
    const box = await target.boundingBox();
    if (!box) throw new Error(`下拉框不可见: ${fieldPath}`);
    // 自定义组件忽略合成事件，使用真实鼠标点击元素内部。
    await this.page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await this.page.locator(SELECTORS.dropdown.root).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  async options(): Promise<string[]> {
    return this.page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .filter((element) => (element as HTMLElement).offsetWidth > 0)
        .map((element) => (element.textContent ?? '').trim())
        .filter(Boolean);
    }, `${SELECTORS.dropdown.root} ${SELECTORS.dropdown.option}`);
  }

  async selected(): Promise<string> {
    return this.page.evaluate((rootSelector) => {
      const selected = document.querySelector(`${rootSelector} .ath-select-item-option-selected`);
      if (selected) return (selected.textContent ?? '').trim();
      const content = document.querySelector(`${rootSelector} .ath-select-selection-item`);
      return (content?.textContent ?? '').trim();
    }, SELECTORS.dropdown.root);
  }

  async choose(text: string): Promise<void> {
    const option = this.page
      .locator(`${SELECTORS.dropdown.root} ${SELECTORS.dropdown.option}`)
      .filter({ hasText: text })
      .first();
    await option.click({ timeout: 10000 });
  }

  async close(): Promise<void> {
    await this.page.keyboard.press('Escape');
    await this.page.waitForTimeout(200);
  }

  async isOpen(): Promise<boolean> {
    return (await this.page.locator(SELECTORS.dropdown.root).count()) > 0;
  }
}
