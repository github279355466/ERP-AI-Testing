import { AthenaConfig } from '../config/athena-config';

export type ActionType =
  | 'open'
  | 'click'
  | 'popup'
  | 'close-tab'
  | 'assert'
  | 'snapshot'
  | 'screenshot'
  | 'read'
  | 'fill'
  | 'select'
  | 'save'
  | 'delete'
  | 'confirm'
  | 'filter'
  | 'new'
  | 'row-action'
  | 'pick-date'
  | 'audit'
  | 'unaudit'
  | 'post'
  | 'void'
  | 'status-change';

export interface ActionRequest {
  type: string;
  text?: string;
  selector?: string;
  url?: string;
}

export type PolicyDecision =
  | { allowed: true }
  | {
      allowed: false;
      code:
        | 'FORBIDDEN_ACTION'
        | 'UNKNOWN_ACTION'
        | 'WRITE_DISABLED'
        | 'HIGH_RISK_DISABLED'
        | 'UNVERIFIED_TARGET'
        | 'HOST_NOT_ALLOWED';
      reason: string;
    };

const READONLY_ACTIONS: readonly string[] = [
  'open',
  'click',
  'popup',
  'close-tab',
  'assert',
  'snapshot',
  'screenshot',
  'read',
];

const WRITE_ACTIONS: readonly string[] = [
  'fill',
  'select',
  'save',
  'confirm',
  'filter',
  'new',
  'row-action',
  'pick-date',
];

const HIGH_RISK_ACTIONS: readonly string[] = ['delete', 'audit', 'unaudit', 'post', 'void', 'status-change'];

function normalize(value: string | undefined): string {
  return (value ?? '').replace(/\s+/g, '');
}

export class SafetyPolicy {
  private readonly allowedHosts: Set<string>;

  constructor(
    private readonly config: AthenaConfig,
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {
    this.allowedHosts = new Set<string>([
      new URL(config.environment.baseUrl).host,
      config.environment.lowcodeHost,
    ]);
  }

  evaluate(action: ActionRequest): PolicyDecision {
    if (HIGH_RISK_ACTIONS.includes(action.type)) {
      if (!this.config.safety.allowWrite || this.config.safety.readOnly) {
        return {
          allowed: false,
          code: 'WRITE_DISABLED',
          reason: `写操作未启用: ${action.type}`,
        };
      }
      if (!this.highRiskAllowed(action.type)) {
        return {
          allowed: false,
          code: 'HIGH_RISK_DISABLED',
          reason: `高风险动作未显式授权: ${action.type}`,
        };
      }
      return { allowed: true };
    }

    if (WRITE_ACTIONS.includes(action.type)) {
      if (!this.config.safety.allowWrite || this.config.safety.readOnly) {
        return {
          allowed: false,
          code: 'WRITE_DISABLED',
          reason: `写操作未启用: ${action.type}`,
        };
      }
      return { allowed: true };
    }

    if (!READONLY_ACTIONS.includes(action.type)) {
      return {
        allowed: false,
        code: 'UNKNOWN_ACTION',
        reason: `动作类型不在白名单内: ${action.type}`,
      };
    }

    if (this.config.safety.readOnly && action.type === 'click') {
      const text = normalize(action.text);
      if (!text) {
        return {
          allowed: false,
          code: 'UNVERIFIED_TARGET',
          reason: '只读模式下点击目标缺少可判定文本，已拒绝',
        };
      }
      const hit = this.config.safety.forbiddenActionTexts.find((word) => text.includes(normalize(word)));
      if (hit) {
        return {
          allowed: false,
          code: 'FORBIDDEN_ACTION',
          reason: `只读模式下禁止点击包含「${hit}」的控件`,
        };
      }
    }

    if (this.config.safety.readOnly && action.type === 'open' && !this.isAllowedUrl(action.url)) {
      return {
        allowed: false,
        code: 'HOST_NOT_ALLOWED',
        reason: `只读模式下禁止打开门户/业务主机之外的地址: ${action.url ?? '(空)'}`,
      };
    }

    return { allowed: true };
  }

  assertAllowed(action: ActionRequest): void {
    const decision = this.evaluate(action);
    if (!decision.allowed) {
      throw new Error(`[${decision.code}] ${decision.reason}`);
    }
  }

  isHighRiskAction(type: string): boolean {
    return HIGH_RISK_ACTIONS.includes(type);
  }

  private highRiskAllowed(type: string): boolean {
    const master = envFlag(this.env.ALLOW_HIGH_RISK_ACTIONS, this.config.safety.allowHighRiskActions);
    if (!master) return false;

    switch (type) {
      case 'delete':
        return envFlag(this.env.ALLOW_DELETE, this.config.safety.allowDelete);
      case 'audit':
        return envFlag(this.env.ALLOW_AUDIT, this.config.safety.allowAudit);
      case 'unaudit':
        return envFlag(this.env.ALLOW_UNAUDIT, this.config.safety.allowUnAudit);
      case 'post':
        return envFlag(this.env.ALLOW_POSTING, this.config.safety.allowPosting);
      case 'void':
        return envFlag(this.env.ALLOW_STATUS_CHANGE, this.config.safety.allowStatusChange);
      case 'status-change':
        return envFlag(this.env.ALLOW_STATUS_CHANGE, this.config.safety.allowStatusChange);
      default:
        return false;
    }
  }

  private isAllowedUrl(raw: string | undefined): boolean {
    if (!raw) return false;
    try {
      return this.allowedHosts.has(new URL(raw).host);
    } catch {
      return false;
    }
  }
}

function envFlag(value: string | undefined, fallback: boolean): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return fallback;
}
