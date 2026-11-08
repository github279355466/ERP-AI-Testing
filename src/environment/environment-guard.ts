import { AthenaConfig } from '../config/athena-config';

export type EnvironmentType = 'development' | 'test' | 'staging' | 'production';

export type GuardCode =
  | 'AUTHORIZATION_MISSING'
  | 'ENVIRONMENT_TYPE_UNKNOWN'
  | 'PRODUCTION_ENVIRONMENT'
  | 'PRODUCTION_HOST'
  | 'BLOCKED_HOST'
  | 'HOST_NOT_ALLOWED'
  | 'INVALID_URL'
  | 'REDIRECT_OUTSIDE_ALLOWLIST';

export type GuardDecision =
  | { allowed: true }
  | { allowed: false; code: GuardCode; reason: string };

const PRODUCTION_HOST_PATTERN = /(^|[.-])(prod|production|prd|live)([.-]|$)/i;

export class EnvironmentGuard {
  private readonly allowedHosts: Set<string>;
  private readonly blockedHosts: Set<string>;

  constructor(
    private readonly config: AthenaConfig,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.allowedHosts = new Set(config.environment.allowedOrigins.map(toHost).filter(Boolean));
    this.blockedHosts = new Set(config.environment.blockedOrigins.map(toHost).filter(Boolean));
  }

  evaluateConnection(): GuardDecision {
    if (this.env.ALLOW_ERP_UI_TEST !== 'true') {
      return {
        allowed: false,
        code: 'AUTHORIZATION_MISSING',
        reason: '未显式设置 ALLOW_ERP_UI_TEST=true，拒绝连接 ERP',
      };
    }

    const type = this.config.environment.type;
    if (type === 'production') {
      return {
        allowed: false,
        code: 'PRODUCTION_ENVIRONMENT',
        reason: 'environment.type=production，Phase 2 禁止连接生产环境',
      };
    }
    if (!['development', 'test', 'staging'].includes(type)) {
      return {
        allowed: false,
        code: 'ENVIRONMENT_TYPE_UNKNOWN',
        reason: `environment.type 非法或未配置: ${String(type)}`,
      };
    }

    for (const host of [hostOf(this.config.environment.baseUrl), this.config.environment.lowcodeHost]) {
      const decision = this.evaluateHost(host);
      if (!decision.allowed) return decision;
    }
    return { allowed: true };
  }

  assertConnectionAllowed(): void {
    const decision = this.evaluateConnection();
    if (!decision.allowed) throw new Error(`[${decision.code}] ${decision.reason}`);
  }

  evaluateUrl(rawUrl: string, phase = 'navigation'): GuardDecision {
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { allowed: false, code: 'INVALID_URL', reason: `${phase} URL 非法: ${rawUrl || '(空)'}` };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { allowed: false, code: 'INVALID_URL', reason: `${phase} 只允许 http(s): ${parsed.protocol}` };
    }
    return this.evaluateHost(parsed.host);
  }

  assertUrlAllowed(rawUrl: string, phase = 'navigation'): void {
    const decision = this.evaluateUrl(rawUrl, phase);
    if (!decision.allowed) throw new Error(`[${decision.code}] ${decision.reason}`);
  }

  assertAfterNavigation(actualUrl: string, expectedUrl?: string): void {
    const decision = this.evaluateUrl(actualUrl, 'redirect');
    if (!decision.allowed) {
      throw new Error(`[REDIRECT_OUTSIDE_ALLOWLIST] 导航落点不在白名单: ${actualUrl}`);
    }
    if (expectedUrl) {
      const expected = this.evaluateUrl(expectedUrl, 'expected');
      if (!expected.allowed) {
        throw new Error(`[HOST_NOT_ALLOWED] 期望地址不在白名单: ${expectedUrl}`);
      }
      const actualHost = hostOf(actualUrl);
      const expectedHost = hostOf(expectedUrl);
      if (actualHost !== expectedHost) {
        throw new Error(`[REDIRECT_OUTSIDE_ALLOWLIST] 跨主机重定向: ${expectedHost} -> ${actualHost}`);
      }
    }
  }

  banner(): {
    environmentName: string;
    environmentType: string;
    baseUrl: string;
    tenantId: string;
    allowErpUiTest: boolean;
  } {
    return {
      environmentName: this.config.environment.name,
      environmentType: this.config.environment.type,
      baseUrl: sanitizeUrl(this.config.environment.baseUrl),
      tenantId: this.config.environment.tenantId,
      allowErpUiTest: this.env.ALLOW_ERP_UI_TEST === 'true',
    };
  }

  private evaluateHost(host: string): GuardDecision {
    if (!host) {
      return { allowed: false, code: 'INVALID_URL', reason: '目标 host 为空' };
    }
    if (PRODUCTION_HOST_PATTERN.test(host)) {
      return { allowed: false, code: 'PRODUCTION_HOST', reason: `目标 host 命中生产特征: ${host}` };
    }
    if (this.blockedHosts.has(host.toLowerCase())) {
      return { allowed: false, code: 'BLOCKED_HOST', reason: `目标 host 在 blockedOrigins 中: ${host}` };
    }
    if (!this.allowedHosts.has(host.toLowerCase())) {
      return { allowed: false, code: 'HOST_NOT_ALLOWED', reason: `目标 host 不在 allowedOrigins 中: ${host}` };
    }
    return { allowed: true };
  }
}

function toHost(value: string): string {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return value.trim().toLowerCase();
  }
}

function hostOf(value: string): string {
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return '';
  }
}

function sanitizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.username = '';
    url.password = '';
    for (const key of ['token', 'access_token', 'password', 'cookie']) {
      if (url.searchParams.has(key)) url.searchParams.set(key, '<redacted>');
    }
    return url.toString();
  } catch {
    return value;
  }
}
