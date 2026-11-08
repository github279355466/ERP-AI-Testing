import fs from 'node:fs';
import path from 'node:path';
import { assertValidConfigDocument } from './config-schema';
import { loadDotEnv } from './load-env';

export type BrowserMode = 'cdp' | 'playwright';
export type BrowserEngine = 'chromium' | 'chrome' | 'edge';
export type RuntimeEnvironmentType = 'development' | 'test' | 'staging' | 'production' | 'unknown';

export interface AthenaConfig {
  environment: {
    name: string;
    type: RuntimeEnvironmentType;
    baseUrl: string;
    tenantId: string;
    applicationCode: string;
    lowcodeHost: string;
    allowedOrigins: string[];
    blockedOrigins: string[];
  };
  browser: {
    mode: BrowserMode;
    engine: BrowserEngine;
    cdpEndpoint: string;
    proxy: string;
    headless: boolean;
    storageState: string;
    userDataDir: string;
    persistSession: boolean;
    trace: boolean;
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
    allowHighRiskActions: boolean;
    allowDelete: boolean;
    allowAudit: boolean;
    allowUnAudit: boolean;
    allowPosting: boolean;
    allowStatusChange: boolean;
    forbiddenActionTexts: string[];
    allowFixedCoordinates: boolean;
  };
  evidence: {
    captureScreenshotOnFailure: boolean;
    captureTrace: boolean;
    localOnly: boolean;
    retentionDays: number;
    redactSecrets: boolean;
  };
  knowledge: {
    expectedModelVersion: string;
    frozenModelPath: string;
  };
  run: {
    operator: string;
    testCaseId: string;
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

function asNonNegativeInt(value: unknown, field: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`配置字段必须是非负数: ${field}`);
  }
  return Math.trunc(value);
}

function asStringArray(value: unknown, field: string, fallback: string[] = []): string[] {
  if (value === undefined) return fallback;
  if (!Array.isArray(value)) throw new Error(`配置字段必须是字符串数组: ${field}`);
  return value.map((item) => asString(item, `${field}[]`));
}

function applyEnvOverrides(raw: Record<string, any>): Record<string, any> {
  const next = structuredClone(raw);
  next.browser = next.browser ?? {};
  next.environment = next.environment ?? {};
  next.paths = next.paths ?? {};
  next.safety = next.safety ?? {};
  next.evidence = next.evidence ?? {};
  next.knowledge = next.knowledge ?? {};
  next.run = next.run ?? {};

  if (process.env.ATHENA_BASE_URL) next.environment.baseUrl = process.env.ATHENA_BASE_URL;
  if (process.env.ATHENA_ENVIRONMENT_NAME) next.environment.name = process.env.ATHENA_ENVIRONMENT_NAME;
  if (process.env.ATHENA_ENVIRONMENT_TYPE) next.environment.type = process.env.ATHENA_ENVIRONMENT_TYPE;
  if (process.env.ATHENA_TENANT_ID) next.environment.tenantId = process.env.ATHENA_TENANT_ID;
  if (process.env.ATHENA_LOWCODE_HOST) next.environment.lowcodeHost = process.env.ATHENA_LOWCODE_HOST;
  if (process.env.ATHENA_ALLOWED_ORIGINS) {
    next.environment.allowedOrigins = splitList(process.env.ATHENA_ALLOWED_ORIGINS);
  }
  if (process.env.ATHENA_BLOCKED_ORIGINS) {
    next.environment.blockedOrigins = splitList(process.env.ATHENA_BLOCKED_ORIGINS);
  }
  if (process.env.ATHENA_CDP_ENDPOINT) next.browser.cdpEndpoint = process.env.ATHENA_CDP_ENDPOINT;
  if (process.env.ATHENA_PROXY) next.browser.proxy = process.env.ATHENA_PROXY;
  if (process.env.ATHENA_BROWSER_MODE) next.browser.mode = process.env.ATHENA_BROWSER_MODE;
  if (process.env.ATHENA_BROWSER_ENGINE) next.browser.engine = process.env.ATHENA_BROWSER_ENGINE;
  if (process.env.ATHENA_STORAGE_STATE) next.browser.storageState = process.env.ATHENA_STORAGE_STATE;
  if (process.env.ATHENA_USER_DATA_DIR) next.browser.userDataDir = process.env.ATHENA_USER_DATA_DIR;
  if (process.env.ATHENA_PERSIST_SESSION) next.browser.persistSession = process.env.ATHENA_PERSIST_SESSION === 'true';
  if (process.env.ATHENA_BROWSER_TRACE) next.browser.trace = process.env.ATHENA_BROWSER_TRACE === 'true';
  if (process.env.ATHENA_PRD_DIR) next.paths.prd = process.env.ATHENA_PRD_DIR;
  if (process.env.ATHENA_EXPECTED_MODEL_VERSION) {
    next.knowledge.expectedModelVersion = process.env.ATHENA_EXPECTED_MODEL_VERSION;
  }
  if (process.env.ATHENA_EVIDENCE_RETENTION_DAYS) {
    next.evidence.retentionDays = Number(process.env.ATHENA_EVIDENCE_RETENTION_DAYS);
  }
  if (process.env.ERP_OPERATOR) next.run.operator = process.env.ERP_OPERATOR;
  if (process.env.ERP_TEST_CASE_ID) next.run.testCaseId = process.env.ERP_TEST_CASE_ID;
  return next;
}

function splitList(value: string): string[] {
  return value
    .split(/[,;]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function parseConfig(raw: Record<string, any>, configPath = DEFAULT_CONFIG_PATH): AthenaConfig {
  const env = raw.environment ?? {};
  const browser = raw.browser ?? {};
  const paths = raw.paths ?? {};
  const safety = raw.safety ?? {};
  const evidence = raw.evidence ?? {};
  const knowledge = raw.knowledge ?? {};
  const run = raw.run ?? {};

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

  const engine = (browser.engine ?? 'chromium') as BrowserEngine;
  if (!['chromium', 'chrome', 'edge'].includes(engine)) {
    throw new Error(`browser.engine 只支持 chromium / chrome / edge，实际: ${engine}`);
  }

  const lowcodeHost = asString(env.lowcodeHost, 'environment.lowcodeHost');
  const allowedOrigins = asStringArray(env.allowedOrigins, 'environment.allowedOrigins', [baseUrl, lowcodeHost]);

  const absolute = path.resolve(configPath);
  const projectRoot = path.dirname(path.dirname(absolute));

  return {
    environment: {
      name: asString(env.name, 'environment.name'),
      type: (env.type ?? 'unknown') as RuntimeEnvironmentType,
      baseUrl,
      tenantId: asString(env.tenantId, 'environment.tenantId'),
      applicationCode: asString(env.applicationCode, 'environment.applicationCode'),
      lowcodeHost,
      allowedOrigins,
      blockedOrigins: asStringArray(env.blockedOrigins, 'environment.blockedOrigins', []),
    },
    browser: {
      mode,
      engine,
      cdpEndpoint,
      proxy: asString(browser.proxy, 'browser.proxy'),
      headless: asBoolean(browser.headless, 'browser.headless'),
      storageState: typeof browser.storageState === 'string' ? browser.storageState : '',
      userDataDir: typeof browser.userDataDir === 'string' ? browser.userDataDir : '',
      persistSession: browser.persistSession === undefined ? false : asBoolean(browser.persistSession, 'browser.persistSession'),
      trace: browser.trace === undefined ? true : asBoolean(browser.trace, 'browser.trace'),
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
      allowHighRiskActions: safety.allowHighRiskActions === undefined ? false : asBoolean(safety.allowHighRiskActions, 'safety.allowHighRiskActions'),
      allowDelete: safety.allowDelete === undefined ? false : asBoolean(safety.allowDelete, 'safety.allowDelete'),
      allowAudit: safety.allowAudit === undefined ? false : asBoolean(safety.allowAudit, 'safety.allowAudit'),
      allowUnAudit: safety.allowUnAudit === undefined ? false : asBoolean(safety.allowUnAudit, 'safety.allowUnAudit'),
      allowPosting: safety.allowPosting === undefined ? false : asBoolean(safety.allowPosting, 'safety.allowPosting'),
      allowStatusChange:
        safety.allowStatusChange === undefined ? false : asBoolean(safety.allowStatusChange, 'safety.allowStatusChange'),
      forbiddenActionTexts: forbidden.map((item: unknown) => asString(item, 'safety.forbiddenActionTexts[]')),
      allowFixedCoordinates: asBoolean(safety.allowFixedCoordinates, 'safety.allowFixedCoordinates'),
    },
    evidence: {
      captureScreenshotOnFailure:
        evidence.captureScreenshotOnFailure === undefined ? true : asBoolean(evidence.captureScreenshotOnFailure, 'evidence.captureScreenshotOnFailure'),
      captureTrace: evidence.captureTrace === undefined ? true : asBoolean(evidence.captureTrace, 'evidence.captureTrace'),
      localOnly: evidence.localOnly === undefined ? true : asBoolean(evidence.localOnly, 'evidence.localOnly'),
      retentionDays:
        evidence.retentionDays === undefined ? 14 : asNonNegativeInt(evidence.retentionDays, 'evidence.retentionDays'),
      redactSecrets: evidence.redactSecrets === undefined ? true : asBoolean(evidence.redactSecrets, 'evidence.redactSecrets'),
    },
    knowledge: {
      expectedModelVersion:
        typeof knowledge.expectedModelVersion === 'string' ? knowledge.expectedModelVersion : '',
      frozenModelPath:
        typeof knowledge.frozenModelPath === 'string' && knowledge.frozenModelPath
          ? knowledge.frozenModelPath
          : 'artifacts/knowledge',
    },
    run: {
      operator: typeof run.operator === 'string' ? run.operator : '',
      testCaseId: typeof run.testCaseId === 'string' ? run.testCaseId : '',
    },
    projectRoot,
    configPath: absolute,
  };
}

export function loadConfig(configPath = process.env.ATHENA_CONFIG || DEFAULT_CONFIG_PATH): AthenaConfig {
  const envResult = loadDotEnv(path.resolve(process.cwd(), '.env'));
  if (envResult.loadedKeys.length > 0) {
    // 只记录键名，不记录值。
    process.env.ATHENA_ENV_LOADED = envResult.loadedKeys.join(',');
  }

  const absolute = path.resolve(configPath);
  if (!fs.existsSync(absolute)) {
    throw new Error(`配置文件不存在: ${absolute}`);
  }
  const raw = JSON.parse(fs.readFileSync(absolute, 'utf8')) as Record<string, any>;
  assertValidConfigDocument(raw);
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
