import fs from 'node:fs';
import path from 'node:path';
import { Page } from '@playwright/test';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';
import { ContextManager } from '../browser/context-manager';
import { PageManager } from '../browser/page-manager';
import { EnvironmentGuard } from '../environment/environment-guard';
import { SessionManager } from '../session/session-manager';

export type NavigationStatus = 'candidate' | 'confirmed';

export interface PageNavigationEntry {
  title: string;
  menuPath: string[];
  menuAliases?: Record<string, string>;
  workItemCode?: string | null;
  status: NavigationStatus;
  ready?: 'list' | 'form' | 'any';
}

export interface NavigationFile {
  version: string;
  source?: string;
  businessQuery?: Record<string, string>;
  pages: Record<string, PageNavigationEntry>;
}

export interface OpenedPage {
  portal: Page;
  business: Page;
  entry: PageNavigationEntry;
  navigationMode: 'menu' | 'direct-session-token';
}

export class NavigationManager {
  private readonly guard: EnvironmentGuard;
  private readonly navigationFile: NavigationFile;

  constructor(
    private readonly config: AthenaConfig,
    private readonly context: ContextManager,
    private readonly pages: PageManager,
    private readonly session: SessionManager,
    navigationFile = 'config/phase2.navigation.json',
  ) {
    this.guard = new EnvironmentGuard(config);
    this.navigationFile = loadNavigationFile(config, navigationFile);
  }

  listPages(): Array<{ key: string; entry: PageNavigationEntry }> {
    return Object.entries(this.navigationFile.pages).map(([key, entry]) => ({ key, entry }));
  }

  getPage(pageKey: string): PageNavigationEntry {
    const entry = this.navigationFile.pages[pageKey];
    if (!entry) throw new Error(`导航配置中没有页面: ${pageKey}`);
    return entry;
  }

  async openPage(pageKey: string): Promise<OpenedPage> {
    const entry = this.getPage(pageKey);
    const existing = await this.findBusinessPage(entry.title);
    if (existing) {
      await existing.bringToFront();
      await this.pages.waitReady(existing);
      return { portal: await this.session.portal(), business: existing, entry, navigationMode: 'menu' };
    }

    const portal = await this.session.ensureAuthenticated();
    const observedWorkCode = await this.expandMenuPath(portal, entry);
    const business = await this.waitForBusinessPage(entry.title, 8_000);
    if (!business) {
      const workItemCode = observedWorkCode || entry.workItemCode;
      if (!workItemCode) {
        throw new Error(
          `点击菜单后未出现业务页面: ${entry.title}，且未观察到 workCode，当前页面=${this.context
            .pages()
            .map((page) => safeUrl(page.url()))
            .join(' | ')}`,
        );
      }
      const direct = await this.openBusinessDirect(portal, entry, workItemCode);
      return { portal, business: direct, entry, navigationMode: 'direct-session-token' };
    }
    await business.bringToFront();
    await business.waitForLoadState('domcontentloaded', {
      timeout: this.config.browser.navigationTimeoutMs,
    });
    this.guard.assertAfterNavigation(business.url());
    await this.pages.waitReady(business);
    await this.assertExpectedPage(business, entry);
    return { portal, business, entry, navigationMode: 'menu' };
  }

  async findBusinessPage(title: string): Promise<Page | null> {
    for (const page of this.context.pages()) {
      if (!page.url().includes(this.config.environment.lowcodeHost)) continue;
      const pageTitle = (await page.title().catch(() => '')).trim();
      if (normalize(pageTitle).includes(normalize(title))) return page;
    }
    return null;
  }

  async closeBusinessPage(title: string): Promise<boolean> {
    const page = await this.findBusinessPage(title);
    if (!page) return false;
    await page.close().catch(() => undefined);
    return true;
  }

  async waitForBusinessPage(title: string, timeoutMs = 30_000): Promise<Page | null> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const page = await this.findBusinessPage(title);
      if (page) return page;
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
    return null;
  }

  async assertExpectedPage(page: Page, entry: PageNavigationEntry): Promise<void> {
    this.guard.assertUrlAllowed(page.url(), 'business');
    const title = (await page.title().catch(() => '')).trim();
    if (!normalize(title).includes(normalize(entry.title))) {
      throw new Error(`业务页标题不匹配：期望包含「${entry.title}」，实际「${title}」`);
    }
    const ready = await this.pages.waitReady(page);
    if (!ready.ok) {
      throw new Error(`业务页未就绪：${entry.title}，信号=${JSON.stringify(ready)}`);
    }
  }

  private async expandMenuPath(portal: Page, entry: PageNavigationEntry): Promise<string | null> {
    let observedWorkCode: string | null = null;
    for (const rawLabel of entry.menuPath) {
      const label = entry.menuAliases?.[rawLabel] ?? rawLabel;
      const item = await findMenuItem(portal, label);
      if (!item) {
        throw new Error(`门户菜单中未找到「${label}」，完整路径=${entry.menuPath.join(' > ')}`);
      }
      const li = item.locator('xpath=ancestor::li[1]');
      const className = (await li.getAttribute('class')) ?? '';
      if (className.includes('ant-menu-submenu') && !className.includes('ant-menu-submenu-open')) {
        await li.locator('.ant-menu-submenu-title').first().click();
        await portal.waitForTimeout(400);
      }
      if (!className.includes('ant-menu-submenu')) {
        const workCodePromise = new Promise<string | null>((resolve) => {
          const timeout = setTimeout(() => {
            portal.off('request', handler);
            resolve(null);
          }, 8_000);
          const handler = (request: import('@playwright/test').Request) => {
            if (!request.url().includes('/appWork/click')) return;
            try {
              const code = new URL(request.url()).searchParams.get('workCode');
              if (code) {
                clearTimeout(timeout);
                portal.off('request', handler);
                resolve(code);
              }
            } catch {
              // 忽略非法 URL，继续等待。
            }
          };
          portal.on('request', handler);
        });
        const pagePromise = this.context.raw.waitForEvent('page', {
          timeout: Math.min(this.config.browser.navigationTimeoutMs, 15_000),
        }).catch(() => null);
        await item.click();
        observedWorkCode = await workCodePromise;
        const created = await pagePromise;
        if (created) {
          await created.waitForLoadState('domcontentloaded', {
            timeout: this.config.browser.navigationTimeoutMs,
          }).catch(() => undefined);
        }
        await portal.waitForTimeout(500);
        return observedWorkCode;
      }
    }
    return observedWorkCode;
  }

  private async openBusinessDirect(
    portal: Page,
    entry: PageNavigationEntry,
    workItemCode: string,
  ): Promise<Page> {
    const token = await portal.evaluate(() => {
      const raw = sessionStorage.getItem('DwUserInfo');
      if (!raw) return '';
      try {
        const parsed = JSON.parse(raw) as { token?: string; sid?: string };
        return parsed.token || parsed.sid || '';
      } catch {
        return '';
      }
    });
    if (!token) throw new Error('门户 sessionStorage 中未找到可用的 UI 会话 token');

    const url = new URL(`/list`, `https://${this.config.environment.lowcodeHost}`);
    for (const [key, value] of Object.entries(this.navigationFile.businessQuery ?? {})) {
      url.searchParams.set(key, value);
    }
    url.searchParams.set('token', token);
    url.searchParams.set('tenantId', this.config.environment.tenantId);
    url.searchParams.set('applicationCode', this.config.environment.applicationCode);
    url.searchParams.set('workItemCode', workItemCode);
    url.searchParams.set('tabName', entry.title);
    url.searchParams.set('routerKey', this.config.environment.tenantId);

    this.guard.assertUrlAllowed(url.toString(), 'direct-business');
    const page = await this.context.newPage();
    await page.goto(url.toString(), {
      waitUntil: 'domcontentloaded',
      timeout: this.config.browser.navigationTimeoutMs,
    });
    await page.bringToFront();
    this.guard.assertAfterNavigation(page.url());
    await this.pages.waitReady(page);
    await this.assertExpectedPage(page, entry);
    return page;
  }
}

export function loadNavigationFile(
  config: AthenaConfig,
  file = 'config/phase2.navigation.json',
): NavigationFile {
  const absolute = path.isAbsolute(file) ? file : resolveProjectPath(config, file);
  if (!fs.existsSync(absolute)) throw new Error(`导航配置不存在: ${absolute}`);
  const raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as NavigationFile;
  if (!raw || typeof raw !== 'object' || !raw.pages || typeof raw.pages !== 'object') {
    throw new Error(`导航配置格式错误: ${absolute}`);
  }
  for (const [key, entry] of Object.entries(raw.pages)) {
    if (!entry.title || !Array.isArray(entry.menuPath) || entry.menuPath.length === 0) {
      throw new Error(`导航配置 ${key} 缺少 title 或 menuPath`);
    }
    if (entry.status !== 'candidate' && entry.status !== 'confirmed') {
      throw new Error(`导航配置 ${key} status 非法: ${String(entry.status)}`);
    }
  }
  return raw;
}

export function normalizeMenuLabel(value: string): string {
  return value
    .replace(/釆/g, '采')
    .replace(/[（(].*?[）)]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

async function findMenuItem(portal: Page, label: string) {
  const items = portal.locator('.menu-list .menu-content[id]');
  const count = await items.count();
  const expected = normalizeMenuLabel(label);
  for (let index = 0; index < count; index += 1) {
    const item = items.nth(index);
    const text = (await item.innerText().catch(() => '')).trim();
    if (normalizeMenuLabel(text) === expected) return item;
  }
  return null;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, '').trim();
}

function safeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.searchParams.delete('token');
    return url.toString();
  } catch {
    return value;
  }
}
