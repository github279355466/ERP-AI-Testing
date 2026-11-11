import { expect, test } from '@playwright/test';
import { validateData } from '../../src/platform/contracts/validator';
import { loadPageMappings, PageMappingRegistry } from '../../src/platform/pages/mapping';
import { DataRecipe, loadRecipes, planRecipe, validateRecipe } from '../../src/platform/data/recipe';
import { executeRecipePlan, RecipeReuseStore } from '../../src/platform/data/executor';
import { errorCodeOf } from '../../src/platform/evidence/diagnostics';

const root = process.cwd();

test.describe('页面映射', () => {
  test('采购模块页面映射通过契约且可按字段检索', () => {
    const result = loadPageMappings(root, 'purchase');
    expect(result.issues).toEqual([]);
    expect(result.mappings.map((mapping) => mapping.page_key)).toEqual([
      'purchase-arrival',
      'purchase-inbound',
      'purchase-order',
      'purchase-return-outbound',
      'purchase-return',
    ]);
    const registry = new PageMappingRegistry(result.mappings);
    const field = registry.field('purchase-order', 'po.supp_no');
    expect(field.control_type).toBe('LOOKUP');
    expect(field.locator.strategy).toBe('label');
    expect(() => registry.field('purchase-order', 'po.not_exist')).toThrow(/PAGE_FIELD_NOT_MAPPED/);
  });

  test('缺少必填字段的映射被契约拒绝', () => {
    const result = validateData('page-mapping', {
      schema_version: '1.0',
      module_id: 'purchase',
      page_key: 'bad-page',
      page_name: '坏页面',
    });
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  test('模块核心不包含采购选择器', () => {
    const result = loadPageMappings(root, 'purchase');
    for (const mapping of result.mappings) {
      for (const field of mapping.fields) {
        expect(mapping.module_id).toBe('purchase');
        expect(field.source_ref.file_path.length).toBeGreaterThan(0);
      }
    }
  });
});

function recipe(overrides: Partial<DataRecipe> = {}): DataRecipe {
  return {
    schema_version: '1.0',
    id: 'RECIPE-TEST',
    module_id: 'purchase',
    title: '测试配方',
    entities: [
      { id: 'purchase-order', type: 'purchase_order', key: 'po.rmk', create_order: 1, reuse_policy: 'within_run' },
      { id: 'purchase-arrival', type: 'purchase_arrival', key: 'pur_arr_doc.rmk', create_order: 2, reuse_policy: 'within_run' },
    ],
    create_order: ['purchase-order', 'purchase-arrival'],
    references: [{ from: 'purchase-arrival', to: 'purchase-order', field: 'source_doc_no', required: true }],
    uniqueness_strategy: { prefix: 'TEST', include_run_id: true, timestamp: true },
    reuse_policy: 'within_run',
    cleanup: { policy: 'keep', order: [], notes: '' },
    assertions: [
      {
        type: 'document_no',
        target: '单号',
        expected: '非空',
        level: 'business',
        source_ref: { document_id: 'SRC-TEST', file_path: 'tests/platform/runtime.spec.ts', source_type: 'PENDING' },
      },
    ],
    ...overrides,
  };
}

test.describe('数据配方', () => {
  test('采购模块配方通过 schema 与语义校验', () => {
    const result = loadRecipes(root, 'purchase');
    expect(result.issues).toEqual([]);
    expect(result.recipes.map((entry) => entry.id)).toContain('RECIPE-PURCHASE-ORDER-BASIC');
  });

  test('按创建顺序生成步骤与唯一值', () => {
    const plan = planRecipe(recipe(), { runId: 'RUN-20261108-ABCD', now: new Date('2026-11-08T10:20:30') });
    expect(plan.steps.map((step) => step.entity_id)).toEqual(['purchase-order', 'purchase-arrival']);
    expect(plan.steps[1].depends_on).toEqual(['purchase-order']);
    expect(plan.steps[0].unique_value).toContain('TEST');
    expect(plan.steps[0].unique_value).toContain('20261108102030');
    expect(plan.steps[0].unique_value).not.toBe(plan.steps[1].unique_value);
  });

  test('引用方向与创建顺序冲突时拒绝', () => {
    const invalid = recipe({ create_order: ['purchase-arrival', 'purchase-order'] });
    const issues = validateRecipe(invalid);
    expect(issues.map((issue) => issue.code)).toContain('RECIPE_REFERENCE_ORDER');
  });

  test('未授权写操作时拒绝执行', async () => {
    const plan = planRecipe(recipe(), { runId: 'RUN-1', now: new Date('2026-11-08T10:00:00') });
    await expect(
      executeRecipePlan(plan, { creator: { create: async () => ({}) }, allowWrite: false }),
    ).rejects.toThrow(/RECIPE_WRITE_NOT_AUTHORIZED/);
  });

  test('授权后按顺序创建并记录审计，重复运行可复用', async () => {
    const plan = planRecipe(recipe(), { runId: 'RUN-2', now: new Date('2026-11-08T10:00:00') });
    const store = new RecipeReuseStore();
    const created: string[] = [];
    const first = await executeRecipePlan(plan, {
      creator: { create: async (step) => { created.push(step.entity_id); return { record_ref: `REF-${step.entity_id}` }; } },
      allowWrite: true,
      reuseStore: store,
    });
    expect(created).toEqual(['purchase-order', 'purchase-arrival']);
    expect(first.created).toHaveLength(2);
    expect(first.audit.filter((entry) => entry.action === 'create')).toHaveLength(2);

    const second = await executeRecipePlan(plan, { creator: { create: async () => ({}) }, allowWrite: true, reuseStore: store });
    expect(second.reused).toEqual(['purchase-order', 'purchase-arrival']);
    expect(second.created).toEqual([]);
  });
});

test('失败诊断使用稳定错误码', () => {
  expect(errorCodeOf(new Error('[LOCATOR_UNRESOLVED] 无法定位控件'))).toBe('LOCATOR_UNRESOLVED');
  expect(errorCodeOf(new Error('普通错误'))).toBe('UNCLASSIFIED_ERROR');
});
