import fs from 'node:fs';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { validateModulePack } from '../../src/platform/contracts/validator';
import { loadModuleTestCases, requireTestCase } from '../../src/platform/execution/case-loader';
import { getModuleFlow } from '../../src/modules/registry';
import { PageMappingRegistry } from '../../src/platform/pages/mapping';
import { loadRecipes } from '../../src/platform/data/recipe';

const root = process.cwd();

test.describe('模块包接入', () => {
  for (const moduleId of ['purchase', 'base', 'ar', 'ap', 'foundation']) {
    test(`${moduleId} 模块包通过契约并能加载页面映射/用例`, () => {
      const pack = validateModulePack(`business-modules/${moduleId}`, { root });
      expect(pack.valid).toBe(true);
      const registry = PageMappingRegistry.load(root, moduleId);
      expect(registry.all().length).toBeGreaterThan(0);
      const cases = loadModuleTestCases(root, moduleId);
      expect(cases.issues).toEqual([]);
      expect(cases.cases.length).toBeGreaterThan(0);
    });
  }

  test('采购模块配方可加载且语义有效', () => {
    const recipes = loadRecipes(root, 'purchase');
    expect(recipes.issues).toEqual([]);
    expect(recipes.recipes.length).toBeGreaterThan(0);
  });

  test('用例可按 id 精确读取，未知 id 报错', () => {
    const testCase = requireTestCase(root, 'purchase', 'SMOKE-PURCHASE-ORDER-CREATE');
    expect(testCase.steps.map((step) => step.action)).toEqual(['navigate', 'invoke_flow']);
    expect(() => requireTestCase(root, 'purchase', 'NOT-EXIST')).toThrow(/CASE_NOT_FOUND/);
  });

  test('模块流程注册表可解析采购流程与内置只读流程', () => {
    expect(typeof getModuleFlow('purchase', 'purchase-order-create')).toBe('function');
    expect(typeof getModuleFlow('purchase', 'purchase-order-lifecycle')).toBe('function');
    expect(typeof getModuleFlow('base', 'platform:list-smoke')).toBe('function');
    expect(() => getModuleFlow('base', 'purchase-order-create')).toThrow(/FLOW_NOT_REGISTERED/);
  });

  test('invoke_flow 在动作注册表中为高风险且不可自动重试', () => {
    const registry = JSON.parse(fs.readFileSync(path.join(root, 'platform/contracts/action-registry.json'), 'utf8')) as {
      actions: Array<{ type: string; retry_safe: boolean; idempotent: boolean; requires_authorization: boolean }>;
    };
    const action = registry.actions.find((entry) => entry.type === 'invoke_flow');
    expect(action).toBeDefined();
    expect(action?.retry_safe).toBe(false);
    expect(action?.idempotent).toBe(false);
    expect(action?.requires_authorization).toBe(true);
  });
});
