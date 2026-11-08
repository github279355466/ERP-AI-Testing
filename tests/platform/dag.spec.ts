import { describe, expect, test } from '@playwright/test';
import { analyzeDag, propagateFailure } from '../../src/platform/plan/dag';

describe('依赖 DAG', () => {
  test('拓扑排序保证依赖先执行', () => {
    const result = analyzeDag([
      { id: 'C', depends_on: ['B'] },
      { id: 'A', depends_on: [] },
      { id: 'B', depends_on: ['A'] },
    ]);
    expect(result.acyclic).toBe(true);
    expect(result.order).toEqual(['A', 'B', 'C']);
  });

  test('检测循环依赖', () => {
    const result = analyzeDag([
      { id: 'A', depends_on: ['C'] },
      { id: 'B', depends_on: ['A'] },
      { id: 'C', depends_on: ['B'] },
    ]);
    expect(result.acyclic).toBe(false);
    expect(result.cycles.length).toBeGreaterThan(0);
    expect(result.order).toEqual([]);
  });

  test('检测缺失依赖', () => {
    const result = analyzeDag([{ id: 'A', depends_on: ['MISSING'] }]);
    expect(result.acyclic).toBe(false);
    expect(result.missing).toEqual([{ node: 'A', dependency: 'MISSING' }]);
  });

  test('失败向下游传播为 blocked 或 skipped', () => {
    const nodes = [
      { id: 'A', depends_on: [] },
      { id: 'B', depends_on: ['A'] },
      { id: 'C', depends_on: ['B'] },
      { id: 'D', depends_on: [] },
    ];
    const results = [
      { id: 'A', status: 'failed' as const },
      { id: 'B', status: 'passed' as const },
      { id: 'C', status: 'passed' as const },
      { id: 'D', status: 'passed' as const },
    ];
    expect(propagateFailure(nodes, results, 'block_downstream')).toEqual([
      { id: 'A', status: 'failed' },
      { id: 'B', status: 'blocked' },
      { id: 'C', status: 'blocked' },
      { id: 'D', status: 'passed' },
    ]);
    expect(propagateFailure(nodes, results, 'skip_downstream')[2].status).toBe('skipped');
    expect(propagateFailure(nodes, results, 'continue')[1].status).toBe('passed');
  });
});
