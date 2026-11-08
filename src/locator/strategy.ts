import { Locator, Page } from '@playwright/test';

export type LocatorKind =
  | 'role'
  | 'label'
  | 'placeholder'
  | 'text'
  | 'testid'
  | 'css'
  | 'xpath';

export interface LocatorCandidate {
  kind: LocatorKind;
  value: string;
  role?: string;
  name?: string;
  exact?: boolean;
}

export interface LocatorAttempt {
  kind: LocatorKind;
  value: string;
  count: number;
  visible: boolean;
  matched: boolean;
  reason?: string;
}

export interface ResolvedControl {
  locator: Locator;
  strategy: string;
  attempts: LocatorAttempt[];
  usedFallback: boolean;
}

export interface ResolveOptions {
  requireVisible?: boolean;
  timeoutMs?: number;
}

export class LocatorResolver {
  constructor(
    private readonly page: Page,
    private readonly defaultTimeoutMs = 10_000,
  ) {}

  async resolve(candidates: LocatorCandidate[], options: ResolveOptions = {}): Promise<ResolvedControl> {
    if (candidates.length === 0) throw new Error('[LOCATOR_UNRESOLVED] 没有可用的定位候选');
    const attempts: LocatorAttempt[] = [];
    const requireVisible = options.requireVisible ?? true;
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      for (let index = 0; index < candidates.length; index += 1) {
        const candidate = candidates[index];
        const locator = this.build(candidate);
        const count = await locator.count().catch(() => 0);
        if (count === 0) {
          attempts.push({
            kind: candidate.kind,
            value: candidate.value,
            count,
            visible: false,
            matched: false,
            reason: '未匹配元素',
          });
          continue;
        }
        const first = locator.first();
        const visible = await first.isVisible().catch(() => false);
        if (requireVisible && !visible) {
          attempts.push({
            kind: candidate.kind,
            value: candidate.value,
            count,
            visible: false,
            matched: false,
            reason: '元素存在但不可见',
          });
          continue;
        }
        attempts.push({
          kind: candidate.kind,
          value: candidate.value,
          count,
          visible,
          matched: true,
        });
        return {
          locator: first,
          strategy: `${candidate.kind}:${candidate.value}`,
          attempts,
          usedFallback: index > 0,
        };
      }
      await this.page.waitForTimeout(250);
    }

    const detail = attempts
      .slice(-candidates.length)
      .map((attempt) => `${attempt.kind}:${attempt.value} count=${attempt.count} visible=${attempt.visible}`)
      .join('；');
    throw new Error(`[LOCATOR_UNRESOLVED] 无法定位控件；${detail}`);
  }

  static fromLocator(locator: Locator, strategy: string): ResolvedControl {
    return { locator, strategy, attempts: [], usedFallback: false };
  }

  private build(candidate: LocatorCandidate): Locator {
    switch (candidate.kind) {
      case 'role':
        return this.page.getByRole(candidate.value as Parameters<Page['getByRole']>[0], {
          name: candidate.name,
          exact: candidate.exact,
        });
      case 'label':
        return this.page.getByLabel(candidate.value, { exact: candidate.exact });
      case 'placeholder':
        return this.page.getByPlaceholder(candidate.value, { exact: candidate.exact });
      case 'text':
        return this.page.getByText(candidate.value, { exact: candidate.exact });
      case 'testid':
        return this.page.getByTestId(candidate.value);
      case 'css':
        return this.page.locator(candidate.value);
      case 'xpath':
        return this.page.locator(`xpath=${candidate.value}`);
      default:
        throw new Error(`未知定位类型: ${String(candidate.kind)}`);
    }
  }
}
