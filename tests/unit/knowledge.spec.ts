import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { KnowledgeBase, validateKnowledge } from '../../src/knowledge/knowledge-base';

test('加载项目知识库', () => {
  const config = loadConfig('config/athena.config.json');
  const knowledge = KnowledgeBase.load(config);
  const page = knowledge.findPage('invnt-param');
  expect(page?.name).toBe('存货参数');
  expect(page?.entity).toBe('ops_unit_invnt_param');
  expect(knowledge.bundle.components.LOOKUP.verified).toBe(true);
  expect(knowledge.confirmedRules('invnt-param').length).toBeGreaterThan(0);
  expect(knowledge.bundle.prdIndex?.entries.length).toBe(19);
  expect(knowledge.findPrdForWorkItem('应付单')?.prdVersion).toBe('1.10');
  expect(knowledge.findPrdForWorkItem('应付单')?.entity).toBe('pay_doc');
  expect(knowledge.findPrdForPage('invnt-param')).toBeUndefined();
  expect(knowledge.findPrdForPage('acctg-perid-table')?.prdVersion).toBe('1.6');
  expect(knowledge.findPrdForPage('acctg-perid-info')?.prdVersion).toBe('1.4');
});

test('重复页面 id 被拒绝', () => {
  const errors = validateKnowledge({
    pageMap: { pages: [
      { id: 'a', name: 'A', status: 'confirmed', verifiedAt: '2026-11-06' },
      { id: 'a', name: 'A2', status: 'confirmed', verifiedAt: '2026-11-06' },
    ] },
    componentMap: { controls: { TEXT: { selector: 'input', verified: true } } },
    rules: { rules: [] },
  });
  expect(errors.join('\n')).toContain('重复');
});

test('confirmed 条目必须有 verifiedAt', () => {
  const errors = validateKnowledge({
    pageMap: { pages: [{ id: 'a', name: 'A', status: 'confirmed' }] },
    componentMap: { controls: { TEXT: { selector: 'input', verified: true } } },
    rules: { rules: [] },
  });
  expect(errors.join('\n')).toContain('verifiedAt');
});
