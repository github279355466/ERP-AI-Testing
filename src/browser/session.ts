import { Browser, BrowserContext } from '@playwright/test';

export interface BrowserSession {
  mode: 'cdp' | 'playwright';
  context: BrowserContext;
  browser?: Browser;
  disconnect(): Promise<void>;
}
