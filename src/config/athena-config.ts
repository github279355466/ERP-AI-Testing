import fs from 'node:fs';
import path from 'node:path';

export type BrowserMode = 'cdp' | 'playwright';

export interface AthenaConfig {
  environment: {
    name: string;
    baseUrl: string;
    tenantId: string;
    applicationCode: string;
    lowcodeHost: string;
  };
  browser: {
    mode: BrowserMode;
    cdpEndpoint: string;
    proxy: string;
    headless: boolean;
    storageState: string;
    userDataDir: string;
    viewport: { width: number; height: number };
    navigationTimeoutMs: number;
    readyTimeoutMs: number;
    actionTimeoutMs: number;
    retry: number;
  };
  paths: {
    knowledge: string;
    artifacts: string;
    logs: string;
    prd: string;
  };
  safety: {
    readOnly: boolean;
    allowWrite: boolean;
    forbiddenActionTexts: string[];
    allowFixedCoordinates: boolean;
  };
  projectRoot: string;
  configPath: string;
}

const DEFAULT_CONFIG_PATH = 'config/athena.config.json';

function asString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`配置字段缺失或类型错误: ${field}`);
  }
  return value;
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') {
    throw new Error(`配置字段必须是布尔值: ${field}`);
  }
  return value;
}

function asPositiveInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`配置字段必须是正数: ${field}`);
  }
  return Math.trunc(value);
}

function applyEnvOverrides(raw: Record<string, any>): Record<string, any> {
  const next = structuredClone(raw);
  next.browser = next.browser ?? {};
  next.environment = next.environment ?? {};
  next.paths = next.paths ?? {};

  if (process.env.ATHENA_BASE_URL) next.environment.baseUrl = process.env.ATHENA_BASE_URL;
  if (process.env.ATHENA_TENANT_ID) next.environment.tenantId = process.env.ATHENA_TENANT_ID;
  if (process.env.ATHENA_CDP_ENDPOINT) next.browser.cdpEndpoint = process.env.ATHENA_CDP_ENDPOINT;
  if (process.env.ATHENA_PROXY) next.browser.proxy = process.env.ATHENA_PROXY;
  if (process.env.ATHENA_BROWSER_MODE) next.browser.mode = process.env.ATHENA_BROWSER_MODE;
  if (process.env.ATHENA_STORAGE_STATE) next.browser.storageState = process.env.ATHENA_STORAGE_STATE;
  if (process.env.ATHENA_USER_DATA_DIR) next.browser.userDataDir = process.env.ATHENA_USER_DATA_DIR;
  if (process.env.ATHENA_PRD_DIR) next.paths.prd = process.env.ATHENA_PRD_DIR;
  return next;
}

export function parseConfig(raw: Record<string, any>, configPath = DEFAULT_CONFIG_PATH): AthenaConfig {
  const env = raw.environment ?? {};
  const browser = raw.browser ?? {};
  const paths = raw.paths ?? {};
  const safety = raw.safety ?? {};

  const mode = asString(browser.mode, 'browser.mode');
  if (mode !== 'cdp' && mode !== 'playwright') {
    throw new Error(`browser.mode 只支持 cdp 或 playwright，实际: ${mode}`);
  }

  const baseUrl = asString(env.baseUrl, 'environment.baseUrl');
  if (!/^https?:\/\//.test(baseUrl)) {
    throw new Error(`environment.baseUrl 必须是 http(s) 地址: ${baseUrl}`);
  }

  const cdpEndpoint = asString(browser.cdpEndpoint, 'browser.cdpEndpoint');
  if (!/^https?:\/\//.test(cdpEndpoint)) {
    throw new Error(`browser.cdpEndpoint 必须是 http(s) 地址: ${cdpEndpoint}`);
  }

  const forbidden = safety.forbiddenActionTexts;
  if (!Array.isArray(forbidden) || forbidden.length === 0) {
    throw new Error('safety.forbiddenActionTexts 必须是非空数组');
  }

  const absolute = path.resolve(configPath);
  const projectRoot = path.dirname(path.dirname(absolute));

  return {
    environment: {
      name: asString(env.name, 'environment.name'),
      baseUrl,
      tenantId: asString(env.tenantId, 'environment.tenantId'),
      applicationCode: asString(env.applicationCode, 'environment.applicationCode'),
      lowcodeHost: asString(env.lowcodeHost, 'environment.lowcodeHost'),
    },
    browser: {
      mode,
      cdpEndpoint,
      proxy: asString(browser.proxy, 'browser.proxy'),
      headless: asBoolean(browser.headless, 'browser.headless'),
      storageState: typeof browser.storageState === 'string' ? browser.storageState : '',
      userDataDir: typeof browser.userDataDir === 'string' ? browser.userDataDir : '',
      viewport: {
        width: asPositiveInt(browser.viewport?.width, 'browser.viewport.width'),
        height: asPositiveInt(browser.viewport?.height, 'browser.viewport.height'),
      },
      navigationTimeoutMs: asPositiveInt(browser.navigationTimeoutMs, 'browser.navigationTimeoutMs'),
      readyTimeoutMs: asPositiveInt(browser.readyTimeoutMs, 'browser.readyTimeoutMs'),
      actionTimeoutMs: asPositiveInt(browser.actionTimeoutMs, 'browser.actionTimeoutMs'),
      retry: asPositiveInt(browser.retry, 'browser.retry'),
    },
    paths: {
      knowledge: asString(paths.knowledge, 'paths.knowledge'),
      artifacts: asString(paths.artifacts, 'paths.artifacts'),
      logs: asString(paths.logs, 'paths.logs'),
      prd: typeof paths.prd === 'string' ? paths.prd : '',
    },
    safety: {
      readOnly: asBoolean(safety.readOnly, 'safety.readOnly'),
      allowWrite: asBoolean(safety.allowWrite ?? false, 'safety.allowWrite'),
      forbiddenActionTexts: forbidden.map((item: unknown) => asString(item, 'safety.forbiddenActionTexts[]')),
      allowFixedCoordinates: asBoolean(safety.allowFixedCoordinates, 'safety.allowFixedCoordinates'),
    },
    projectRoot,
    configPath: absolute,
  };
}

export function loadConfig(configPath = process.env.ATHENA_CONFIG || DEFAULT_CONFIG_PATH): AthenaConfig {
  const absolute = path.resolve(configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`配置文件不存在: ${absolute}`);
  }
  const raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, any>;
  return parseConfig(applyEnvOverrides(raw), absolute);
}

export function resolveProjectPath(config: AthenaConfig, relativePath: string): string {
  return path.resolve(config.projectRoot, relativePath);
}

/**
 * 解析独立浏览器 profile 目录（--user-data-dir）。
 * 相对路径以项目根为基准，保证浏览器数据不落在会话工作区里。
 */
export function resolveBrowserUserDataDir(config: AthenaConfig): string {
  if (!config.browser.userDataDir) {
    throw new Error('browser.userDataDir 未配置，无法确定浏览器 profile 目录');
  }
  return resolveProjectPath(config, config.browser.userDataDir);
}

export function resolvePrdDir(config: AthenaConfig): string {
  if (!config.paths.prd) {
    throw new Error('paths.prd 未配置，无法定位 PRD 目录');
  }
  return path.isAbsolute(config.paths.prd) ? config.paths.prd : path.resolve(config.projectRoot, config.paths.prd);
}
