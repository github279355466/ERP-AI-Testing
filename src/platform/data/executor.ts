import fs from 'node:fs';
import path from 'node:path';
import { redactSecrets } from '../../evidence/evidence-manager';
import { RecipePlan, RecipeStep } from './recipe';

export interface RecipeCreator {
  create(step: RecipeStep, plan: RecipePlan): Promise<{ record_ref?: string }>;
}

export interface RecipeAuditEntry {
  ts: string;
  run_id: string;
  recipe_id: string;
  entity_id: string;
  action: 'create' | 'reuse' | 'fail' | 'cleanup_planned';
  unique_value: string;
  status: 'ok' | 'failed' | 'planned';
  record_ref?: string;
  error_code?: string;
  message?: string;
}

export interface RecipeRunResult {
  recipe_id: string;
  run_id: string;
  created: string[];
  reused: string[];
  failed?: { entity_id: string; error_code: string; message: string };
  cleanup: { policy: RecipePlan['cleanup']['policy']; steps: Array<{ entity_id: string; unique_value: string; requires_authorization: boolean }> };
  audit: RecipeAuditEntry[];
}

export class RecipeWriteError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'RecipeWriteError';
  }
}

export class RecipeReuseStore {
  private readonly keys = new Set<string>();

  has(key: string): boolean {
    return this.keys.has(key);
  }

  add(key: string): void {
    this.keys.add(key);
  }

  static key(runId: string, recipeId: string, entityId: string, uniqueValue: string): string {
    return `${runId}:${recipeId}:${entityId}:${uniqueValue}`;
  }
}

export class JsonlRecipeAudit {
  constructor(private readonly filePath: string) {}

  record(entry: RecipeAuditEntry): void {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    fs.appendFileSync(this.filePath, `${redactSecrets(JSON.stringify(entry))}\n`, 'utf8');
  }
}

export function defaultAuditPath(repoRoot: string, runId: string): string {
  return path.join(repoRoot, 'artifacts', runId, 'data', 'audit.jsonl');
}

export async function executeRecipePlan(
  plan: RecipePlan,
  options: {
    creator: RecipeCreator;
    allowWrite: boolean;
    reuseStore?: RecipeReuseStore;
    audit?: JsonlRecipeAudit;
  },
): Promise<RecipeRunResult> {
  if (!options.allowWrite) {
    throw new RecipeWriteError('RECIPE_WRITE_NOT_AUTHORIZED', `配方 ${plan.recipe_id} 需要创建业务数据，本次运行未授权写操作`);
  }
  const store = options.reuseStore ?? new RecipeReuseStore();
  const auditEntries: RecipeAuditEntry[] = [];
  const created: string[] = [];
  const reused: string[] = [];
  let failed: RecipeRunResult['failed'];

  for (const step of plan.steps) {
    const key = RecipeReuseStore.key(plan.run_id, plan.recipe_id, step.entity_id, step.unique_value);
    const canReuse = step.reuse_policy !== 'never' && store.has(key);
    if (canReuse) {
      reused.push(step.entity_id);
      const entry: RecipeAuditEntry = {
        ts: new Date().toISOString(),
        run_id: plan.run_id,
        recipe_id: plan.recipe_id,
        entity_id: step.entity_id,
        action: 'reuse',
        unique_value: step.unique_value,
        status: 'ok',
      };
      auditEntries.push(entry);
      options.audit?.record(entry);
      continue;
    }
    try {
      const outcome = await options.creator.create(step, plan);
      store.add(key);
      created.push(step.entity_id);
      const entry: RecipeAuditEntry = {
        ts: new Date().toISOString(),
        run_id: plan.run_id,
        recipe_id: plan.recipe_id,
        entity_id: step.entity_id,
        action: 'create',
        unique_value: step.unique_value,
        status: 'ok',
        ...(outcome.record_ref ? { record_ref: outcome.record_ref } : {}),
      };
      auditEntries.push(entry);
      options.audit?.record(entry);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const errorCode = /^\[([A-Z_]+)\]/.exec(message)?.[1] ?? 'RECIPE_CREATE_FAILED';
      failed = { entity_id: step.entity_id, error_code: errorCode, message };
      const entry: RecipeAuditEntry = {
        ts: new Date().toISOString(),
        run_id: plan.run_id,
        recipe_id: plan.recipe_id,
        entity_id: step.entity_id,
        action: 'fail',
        unique_value: step.unique_value,
        status: 'failed',
        error_code: errorCode,
        message,
      };
      auditEntries.push(entry);
      options.audit?.record(entry);
      break;
    }
  }

  const cleanupSteps = plan.cleanup.policy === 'keep'
    ? []
    : [...plan.steps].reverse().map((step) => ({
        entity_id: step.entity_id,
        unique_value: step.unique_value,
        requires_authorization: true,
      }));
  if (cleanupSteps.length > 0) {
    const entry: RecipeAuditEntry = {
      ts: new Date().toISOString(),
      run_id: plan.run_id,
      recipe_id: plan.recipe_id,
      entity_id: '*',
      action: 'cleanup_planned',
      unique_value: '',
      status: 'planned',
      message: `cleanup policy=${plan.cleanup.policy}，需在获得授权后执行`,
    };
    auditEntries.push(entry);
    options.audit?.record(entry);
  }

  return { recipe_id: plan.recipe_id, run_id: plan.run_id, created, reused, ...(failed ? { failed } : {}), cleanup: { policy: plan.cleanup.policy, steps: cleanupSteps }, audit: auditEntries };
}

export function writeRecipePlan(repoRoot: string, runId: string, moduleId: string, plan: RecipePlan): string {
  const file = path.join(repoRoot, 'artifacts', runId, 'plans', `${moduleId}-${plan.recipe_id}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(plan, null, 2)}\n`, 'utf8');
  return file;
}
