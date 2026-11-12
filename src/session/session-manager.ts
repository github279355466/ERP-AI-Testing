import { Page } from '@playwright/test';
import { AthenaConfig } from '../config/athena-config';
import { ContextManager } from '../browser/context-manager';
import { PageManager } from '../browser/page-manager';
import { EnvironmentGuard } from '../environment/environment-guard';

export type SessionState = 'authenticated' | 'login_required' | 'session_expired' | 'unknown';
export type LoginStrategy = 'manual' | 'form' | 'storage-state';

export interface SessionDiagnosis {
  state: SessionState;
  reason: string;
  url: string;
  title: string;
  loginFormVisible: boolean;
  portalHeaderVisible: boolean;
}

export interface EnsureAuthenticatedOptions {
  strategy?: LoginStrategy;
  timeoutMs?: number;
}

export class SessionExpiredError extends Error {
  readonly code = 'SESSION_EXPIRED';

  constructor(message: string) {
    super(`[SESSION_EXPIRED] ${message}`);
    this.name = 'SessionExpiredError';
  }
}

export class LoginRequiredError extends Error {
  readonly code = 'LOGIN_REQUIRED';

  constructor(message: string) {
    super(`[LOGIN_REQUIRED] ${message}`);
    this.name = 'LoginRequiredError';
  }
}

export async function diagnosePageSession(
  page: Page,
  lowcodeHost: string,
): Promise<SessionDiagnosis> {
  const info = await page.evaluate(() => {
    const visible = (selector: string): boolean => {
      const element = document.querySelector(selector) as HTMLElement | null;
      return Boolean(element && element.offsetWidth > 0 && element.offsetHeight > 0);
    };
    return {
      url: location.href,
      title: document.title,
      loginFormVisible: visible('input[name="userId"]') && visible('input[name="password"]'),
      portalHeaderVisible: visible('#main-header') || visible('.sider') || visible('.menu-list'),
      bodyText: (document.body.innerText || '').slice(0, 500),
    };
  });

  const url = info.url.split('?')[0];
  const isLoginUrl = /\/login(\/|$)/.test(url);
  if (info.loginFormVisible) {
    return {
      state: isLoginUrl ? 'login_required' : 'session_expired',
      reason: isLoginUrl ? '登录页表单可见' : '页面出现登录表单，会话可能已失效',
      url: info.url,
      title: info.title,
      loginFormVisible: true,
      portalHeaderVisible: info.portalHeaderVisible,
    };
  }
  if (isLoginUrl) {
    return {
      state: 'login_required',
      reason: '当前 URL 为登录页',
      url: info.url,
      title: info.title,
      loginFormVisible: false,
      portalHeaderVisible: info.portalHeaderVisible,
    };
  }
  if (info.portalHeaderVisible) {
    return {
      state: 'authenticated',
      reason: '门户头部/侧边菜单可见',
      url: info.url,
      title: info.title,
      loginFormVisible: false,
      portalHeaderVisible: true,
    };
  }
  if (safeHost(info.url) === lowcodeHost) {
    return {
      state: 'authenticated',
      reason: '低代码业务页可见且未出现登录表单',
      url: info.url,
      title: info.title,
      loginFormVisible: false,
      portalHeaderVisible: false,
    };
  }
  return {
    state: 'unknown',
    reason: `无法判定登录态，body=${info.bodyText.replace(/\s+/g, ' ').slice(0, 120)}`,
    url: info.url,
    title: info.title,
    loginFormVisible: false,
    portalHeaderVisible: false,
  };
}

export class SessionManager {
  private readonly guard: EnvironmentGuard;

  constructor(
    private readonly config: AthenaConfig,
    private readonly context: ContextManager,
    private readonly pages: PageManager,
  ) {
    this.guard = new EnvironmentGuard(config);
  }

  async portal(): Promise<Page> {
    const host = safeHost(this.config.environment.baseUrl);
    const candidates = this.pages.list().filter((entry) => entry.url().includes(host));
    const authenticated = candidates.find((entry) => !entry.url().includes('/login'));
    if (authenticated) return authenticated;
    if (candidates[0]) return candidates[0];
    const created = await this.context.newPage();
    this.guard.assertUrlAllowed(this.config.environment.baseUrl);
    await created.goto(this.config.environment.baseUrl, {
      waitUntil: 'domcontentloaded',
      timeout: this.config.browser.navigationTimeoutMs,
    });
    this.guard.assertAfterNavigation(created.url(), this.config.environment.baseUrl);
    return created;
  }

  async diagnose(page?: Page): Promise<SessionDiagnosis> {
    const target = page ?? (await this.portal());
    return diagnosePageSession(target, this.config.environment.lowcodeHost);
  }

  async ensureAuthenticated(page?: Page, options: EnsureAuthenticatedOptions = {}): Promise<Page> {
    const target = page ?? (await this.portal());
    const strategy = options.strategy ?? ((process.env.ERP_LOGIN_STRATEGY as LoginStrategy) || 'manual');
    const timeoutMs = options.timeoutMs ?? 120_000;
    const diagnosis = await diagnosePageSession(target, this.config.environment.lowcodeHost);
    if (diagnosis.state === 'authenticated') return target;

    if (strategy === 'form') {
      const username = process.env.ERP_USERNAME || '';
      const password = process.env.ERP_PASSWORD || '';
      if (!username || !password) {
        throw new LoginRequiredError('form 登录策略缺少 ERP_USERNAME / ERP_PASSWORD');
      }
      await this.loginWithForm(target, username, password, timeoutMs);
      return target;
    }

    if (strategy === 'storage-state') {
      throw new SessionExpiredError('storageState 已失效，且未启用交互式重新登录');
    }

    const waited = await this.waitForAuthenticated(target, timeoutMs);
    if (!waited) {
      throw new SessionExpiredError(
        `等待人工登录超时（${timeoutMs}ms），当前状态=${diagnosis.state}，标题=${diagnosis.title}`,
      );
    }
    return target;
  }

  async waitForAuthenticated(page: Page, timeoutMs = 120_000): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const diagnosis = await diagnosePageSession(page, this.config.environment.lowcodeHost);
      if (diagnosis.state === 'authenticated') return true;
      await page.waitForTimeout(500);
    }
    return false;
  }

  async assertAuthenticated(page?: Page): Promise<void> {
    const diagnosis = await this.diagnose(page);
    if (diagnosis.state !== 'authenticated') {
      throw new SessionExpiredError(
        `当前状态=${diagnosis.state}，原因=${diagnosis.reason}，URL=${diagnosis.url.split('?')[0]}`,
      );
    }
  }

  async loginWithForm(page: Page, username: string, password: string, timeoutMs = 60_000): Promise<void> {
    const user = page.locator('input[name="userId"]').first();
    const pass = page.locator('input[name="password"]').first();
    if ((await user.count()) === 0 || (await pass.count()) === 0) {
      throw new LoginRequiredError('登录页未找到 userId/password 输入框');
    }
    await user.fill(username);
    await pass.fill(password);
    await page.locator('button.ant-btn-primary').first().click();
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const diagnosis = await diagnosePageSession(page, this.config.environment.lowcodeHost);
      if (diagnosis.state === 'authenticated') return;
      const errorText = await page
        .locator('.ant-form-item-explain-error, .ant-message-error, .ant-message-notice-content')
        .last()
        .innerText()
        .catch(() => '');
      if (errorText.trim()) {
        throw new LoginRequiredError(`登录失败：${errorText.replace(/\s+/g, ' ').trim().slice(0, 200)}`);
      }
      await page.waitForTimeout(500);
    }
    throw new LoginRequiredError(`登录提交后 ${timeoutMs}ms 内未进入门户`);
  }
}

function safeHost(value: string): string {
  try {
    return new URL(value).host;
  } catch {
    return '';
  }
}
