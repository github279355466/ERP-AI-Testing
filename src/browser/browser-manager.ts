import { AthenaConfig } from '../config/athena-config';
import { EnvironmentGuard } from '../environment/environment-guard';
import { connectCdp } from './cdp-adapter';
import { launchChromium } from './playwright-adapter';
import { BrowserSession } from './session';

export class BrowserManager {
  constructor(private readonly config: AthenaConfig) {}

  async connect(): Promise<BrowserSession> {
    new EnvironmentGuard(this.config).assertConnectionAllowed();
    return this.config.browser.mode === 'cdp' ? connectCdp(this.config) : launchChromium(this.config);
  }

  async disconnect(session: BrowserSession): Promise<void> {
    await session.disconnect();
  }
}
