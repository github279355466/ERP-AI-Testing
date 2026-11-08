import fs from 'node:fs';
import path from 'node:path';
import { readStructured, validateData } from '../contracts/validator';
import { PlatformAssertion } from '../plan/compile';

export type ReusePolicy = 'never' | 'within_run' | 'approved_shared';

export interface RecipeEntity {
  id: string;
  type: string;
  key: string;
  create_order: number;
  reuse_policy: ReusePolicy;
}

export interface DataRecipe {
  schema_version: '1.0';
  id: string;
  module_id: string;
  title: string;
  entities: RecipeEntity[];
  create_order: string[];
  references: Array<{ from: string; to: string; field: string; required: boolean }>;
  uniqueness_strategy: { prefix: string; include_run_id: boolean; timestamp: boolean };
  reuse_policy: ReusePolicy;
  cleanup: { policy: 'keep' | 'delete_after_run' | 'mark_for_cleanup' | 'manual'; order: string[]; notes: string };
  assertions: PlatformAssertion[];
}

export interface RecipeStep {
  order: number;
  entity_id: string;
  type: string;
  key: string;
  unique_value: string;
  reuse_policy: ReusePolicy;
  depends_on: string[];
}

export interface RecipePlan {
  recipe_id: string;
  module_id: string;
  run_id: string;
  created_at: string;
  steps: RecipeStep[];
  cleanup: { policy: DataRecipe['cleanup']['policy']; order: string[]; notes: string };
}

export interface RecipeIssue {
  code: string;
  message: string;
}

export class RecipeError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'RecipeError';
  }
}

export function recipeDirectory(repoRoot: string, moduleId: string): string {
  return path.join(repoRoot, 'business-modules', moduleId, 'data-recipes');
}

export function loadRecipes(repoRoot: string, moduleId: string): { recipes: DataRecipe[]; issues: Array<{ file: string; issues: RecipeIssue[] }> } {
  const directory = recipeDirectory(repoRoot, moduleId);
  if (!fs.existsSync(directory)) return { recipes: [], issues: [] };
  const files = fs.readdirSync(directory).filter((file) => /\.ya?ml$/i.test(file)).sort();
  const recipes: DataRecipe[] = [];
  const issues: Array<{ file: string; issues: RecipeIssue[] }> = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const data = readStructured(target);
    const result = validateData('data-recipe', data, { target });
    if (!result.valid) {
      issues.push({ file, issues: result.issues.map((issue) => ({ code: 'RECIPE_SCHEMA_INVALID', message: `${issue.path} ${issue.message}` })) });
      continue;
    }
    const recipe = data as DataRecipe;
    if (recipe.module_id !== moduleId) {
      issues.push({ file, issues: [{ code: 'RECIPE_MODULE_MISMATCH', message: `module_id=${recipe.module_id} 与模块包 ${moduleId} 不一致` }] });
      continue;
    }
    const semantic = validateRecipe(recipe);
    if (semantic.length > 0) {
      issues.push({ file, issues: semantic });
      continue;
    }
    recipes.push(recipe);
  }
  return { recipes, issues };
}

export function validateRecipe(recipe: DataRecipe): RecipeIssue[] {
  const issues: RecipeIssue[] = [];
  const entityIds = new Set<string>();
  for (const entity of recipe.entities) {
    if (entityIds.has(entity.id)) issues.push({ code: 'RECIPE_ENTITY_DUPLICATED', message: `实体重复: ${entity.id}` });
    entityIds.add(entity.id);
  }
  const order = recipe.create_order;
  if (order.length !== recipe.entities.length) {
    issues.push({ code: 'RECIPE_ORDER_INCOMPLETE', message: `create_order 覆盖 ${order.length} 个实体，实际 ${recipe.entities.length} 个` });
  }
  const seen = new Set<string>();
  for (const id of order) {
    if (!entityIds.has(id)) issues.push({ code: 'RECIPE_ENTITY_UNKNOWN', message: `create_order 引用未声明实体: ${id}` });
    if (seen.has(id)) issues.push({ code: 'RECIPE_ORDER_DUPLICATED', message: `create_order 重复: ${id}` });
    seen.add(id);
  }
  for (const reference of recipe.references) {
    if (!entityIds.has(reference.from)) issues.push({ code: 'RECIPE_REFERENCE_INVALID', message: `引用 from 不存在: ${reference.from}` });
    if (!entityIds.has(reference.to)) issues.push({ code: 'RECIPE_REFERENCE_INVALID', message: `引用 to 不存在: ${reference.to}` });
  }
  const position = new Map(order.map((id, index) => [id, index]));
  for (const reference of recipe.references.filter((entry) => entry.required)) {
    const from = position.get(reference.from);
    const to = position.get(reference.to);
    if (from !== undefined && to !== undefined && to > from) {
      issues.push({ code: 'RECIPE_REFERENCE_ORDER', message: `${reference.from} 依赖 ${reference.to}，但创建顺序相反` });
    }
  }
  return issues;
}

function compactTimestamp(now: Date): string {
  const pad = (value: number): string => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export function uniqueValueFor(recipe: DataRecipe, entity: RecipeEntity, runId: string, now: Date): string {
  const parts = [recipe.uniqueness_strategy.prefix];
  if (recipe.uniqueness_strategy.include_run_id) parts.push(runId.replace(/[^A-Za-z0-9]/g, '').slice(-8));
  if (recipe.uniqueness_strategy.timestamp) parts.push(compactTimestamp(now));
  if (recipe.entities.length > 1) parts.push(entity.id);
  return parts.join('-');
}

export function planRecipe(recipe: DataRecipe, options: { runId: string; now?: Date }): RecipePlan {
  const issues = validateRecipe(recipe);
  if (issues.length > 0) throw new RecipeError(issues[0].code, issues.map((issue) => issue.message).join('; '));
  const now = options.now ?? new Date();
  const byId = new Map(recipe.entities.map((entity) => [entity.id, entity]));
  const steps = recipe.create_order.map((entityId, index) => {
    const entity = byId.get(entityId) as RecipeEntity;
    const dependsOn = recipe.references
      .filter((reference) => reference.from === entityId)
      .map((reference) => reference.to);
    return {
      order: index + 1,
      entity_id: entity.id,
      type: entity.type,
      key: entity.key,
      unique_value: uniqueValueFor(recipe, entity, options.runId, now),
      reuse_policy: entity.reuse_policy,
      depends_on: [...new Set(dependsOn)],
    };
  });
  return {
    recipe_id: recipe.id,
    module_id: recipe.module_id,
    run_id: options.runId,
    created_at: now.toISOString(),
    steps,
    cleanup: { policy: recipe.cleanup.policy, order: recipe.cleanup.order, notes: recipe.cleanup.notes },
  };
}
