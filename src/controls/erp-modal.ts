import { Locator, Page } from '@playwright/test';
import { SELECTORS } from '../locator/selectors';

export interface ModalInfo {
  title: string;
  buttons: string[];
  text: string;
}

export class ErpModal {
  constructor(private readonly page: Page) {}

  async current(): Promise<Locator | null> {
    const modals = this.page.locator(SELECTORS.modal.root);
    const count = await modals.count();
    if (count === 0) return null;
    const last = modals.nth(count - 1);
    return (await last.isVisible()) ? last : null;
  }

  async read(): Promise<ModalInfo | null> {
    const modal = await this.current();
    if (!modal) return null;
    const text = (await modal.innerText()).trim();
    const buttons = await modal.evaluate((element) => {
      return Array.from(element.querySelectorAll('button'))
        .filter((button) => (button as HTMLElement).offsetWidth > 0)
        .map((button) => (button.textContent ?? '').trim())
        .filter(Boolean);
    });
    return { title: text.split('\n')[0]?.trim() ?? '', buttons, text };
  }

  async close(): Promise<void> {
    const modal = await this.current();
    if (!modal) return;
    const cancel = modal.getByRole('button', { name: '取消', exact: true });
    if ((await cancel.count()) > 0) {
      await cancel.first().click();
    } else {
      await modal.locator(SELECTORS.modal.close).first().click();
    }
  }
}
