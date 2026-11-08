import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { SafetyPolicy } from '../../src/runner/safety-policy';

test('默认只读配置关闭全部高风险动作', () => {
  const policy = new SafetyPolicy(loadConfig('config/athena.config.json'), {});
  for (const type of ['delete', 'audit', 'unaudit', 'post', 'void', 'status-change']) {
    const decision = policy.evaluate({ type });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe('WRITE_DISABLED');
  }
});

test('写入配置显式允许审核/撤审/删除', () => {
  const policy = new SafetyPolicy(loadConfig('config/athena.write.config.json'), {});
  for (const type of ['delete', 'audit', 'unaudit', 'status-change']) {
    expect(policy.evaluate({ type }).allowed).toBe(true);
  }
  expect(policy.evaluate({ type: 'post' }).allowed).toBe(false);
});

test('环境变量可将高风险动作强制关闭', () => {
  const policy = new SafetyPolicy(loadConfig('config/athena.write.config.json'), {
    ALLOW_HIGH_RISK_ACTIONS: 'true',
    ALLOW_AUDIT: 'false',
  });
  const decision = policy.evaluate({ type: 'audit' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('HIGH_RISK_DISABLED');
});

test('主开关关闭时即使单项为 true 也拒绝', () => {
  const policy = new SafetyPolicy(loadConfig('config/athena.write.config.json'), {
    ALLOW_HIGH_RISK_ACTIONS: 'false',
    ALLOW_DELETE: 'true',
  });
  const decision = policy.evaluate({ type: 'delete' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('HIGH_RISK_DISABLED');
});

test('识别高风险动作类型', () => {
  const policy = new SafetyPolicy(loadConfig('config/athena.write.config.json'), {});
  expect(policy.isHighRiskAction('audit')).toBe(true);
  expect(policy.isHighRiskAction('save')).toBe(false);
});
