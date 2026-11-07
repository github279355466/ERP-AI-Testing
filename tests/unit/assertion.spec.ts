import { expect, test } from '@playwright/test';
import { AssertionEngine } from '../../src/assertion/assertion-engine';

test('字符串断言忽略多余空白', () => {
  const engine = new AssertionEngine();
  expect(engine.equals('ui', '标题', '  存货   参数 ', '存货 参数')).toBe(true);
  expect(engine.passed).toBe(true);
});

test('包含断言记录失败', () => {
  const engine = new AssertionEngine();
  expect(engine.contains('business', '提示', '保存成功', '失败')).toBe(false);
  expect(engine.passed).toBe(false);
  expect(engine.all()[0].actual).toBe('保存成功');
});

test('数值下限断言', () => {
  const engine = new AssertionEngine();
  expect(engine.gte('ui', '行数', 9, 1)).toBe(true);
  expect(engine.gte('ui', '行数', 0, 1)).toBe(false);
});

test('可见性断言处理异常', async () => {
  const engine = new AssertionEngine();
  const passed = await engine.visible('ui', '容器', { isVisible: async () => { throw new Error('boom'); } });
  expect(passed).toBe(false);
  expect(engine.all()[0].actual).toBe('不可见');
});
