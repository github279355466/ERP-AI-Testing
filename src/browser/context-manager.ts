import { BrowserContext, Page } from '@playwright/test';

export class ContextManager {
  constructor(private readonly context: BrowserContext) {}

  pages(): Page[] {
    return this.context.pages();
  }

  newPage(): Promise<Page> {
    return this.context.newPage();
  }

  async closePage(page: Page): Promise<void> {
    await page.close().catch(() => undefined);
  }

  async waitForNewPage(timeoutMs: number, hostIncludes?: string): Promise<Page | null> {
    const before = new Set(this.context.pages());
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const created = this.context.pages().find(
        (page) => !before.has(page) && (!hostIncludes || page.url().includes(hostIncludes)),
      );
      if (created) return created;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return null;
  }

  get raw(): BrowserContext {
    return this.context;
  }
}
