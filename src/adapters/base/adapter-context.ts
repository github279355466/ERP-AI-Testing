import { Page } from '@playwright/test';
import { LocatorResolver } from '../../locator/strategy';
import { SafetyPolicy } from '../../runner/safety-policy';

export interface AdapterContext {
  page: Page;
  resolver: LocatorResolver;
  policy: SafetyPolicy;
  timeoutMs: number;
}
