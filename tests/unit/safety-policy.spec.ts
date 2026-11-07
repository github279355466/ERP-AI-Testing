import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { SafetyPolicy } from '../../src/runner/safety-policy';

const config = loadConfig('config/athena.config.json');
const policy = new SafetyPolicy(config);
const writeConfig = loadConfig('config/athena.write.config.json');
const writePolicy = new SafetyPolicy(writeConfig);

test('允许只读动作', () => {
  expect(policy.evaluate({ type: 'assert' }).allowed).toBe(true);
  expect(policy.evaluate({ type: 'snapshot' }).allowed).toBe(true);
  expect(policy.evaluate({ type: 'click', text: '查看' }).allowed).toBe(true);
});

test('拒绝保存类点击', () => {
  const decision = policy.evaluate({ type: 'click', text: '保存并新增' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('FORBIDDEN_ACTION');
});

test('拒绝删除类点击', () => {
  expect(policy.evaluate({ type: 'click', text: '删除' }).allowed).toBe(false);
  expect(policy.evaluate({ type: 'click', text: ' 保 存 ' }).allowed).toBe(false);
});

test('拒绝白名单外的动作', () => {
  const decision = policy.evaluate({ type: 'unknown-action' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('UNKNOWN_ACTION');
});

test('点击目标无文本时拒绝', () => {
  for (const text of [undefined, '', '   ']) {
    const decision = policy.evaluate({ type: 'click', text, selector: 'button.custom-op-text-btn' });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe('UNVERIFIED_TARGET');
  }
});

test('允许打开门户与低代码业务地址', () => {
  expect(policy.evaluate({ type: 'open', url: 'https://athena-test.digiwincloud.com.cn/login' }).allowed).toBe(true);
  expect(
    policy.evaluate({ type: 'open', url: 'https://lowcode-form-render-test.apps.digiwincloud.com.cn/list?workItemCode=X' })
      .allowed,
  ).toBe(true);
});

test('拒绝打开非业务主机地址', () => {
  const decision = policy.evaluate({ type: 'open', url: 'https://example.com/' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('HOST_NOT_ALLOWED');
  expect(policy.evaluate({ type: 'open' }).allowed).toBe(false);
  expect(policy.evaluate({ type: 'open', url: 'file:///C:/Windows/win.ini' }).allowed).toBe(false);
});

test('允许只读浮层读取与页签关闭', () => {
  expect(policy.evaluate({ type: 'popup' }).allowed).toBe(true);
  expect(policy.evaluate({ type: 'close-tab' }).allowed).toBe(true);
  expect(policy.evaluate({ type: 'read' }).allowed).toBe(true);
});

test('写入配置允许增删改查动作', () => {
  expect(writeConfig.safety.allowWrite).toBe(true);
  expect(writeConfig.safety.readOnly).toBe(false);
  for (const type of ['fill', 'select', 'save', 'delete', 'confirm', 'filter', 'new', 'row-action', 'pick-date']) {
    expect(writePolicy.evaluate({ type }).allowed).toBe(true);
  }
});

test('只读配置拒绝写入动作', () => {
  for (const type of ['fill', 'save', 'delete', 'confirm', 'filter', 'new', 'row-action']) {
    const decision = policy.evaluate({ type });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.code).toBe('WRITE_DISABLED');
  }
});

test('写入配置仍拒绝未知动作', () => {
  const decision = writePolicy.evaluate({ type: 'drop-database' });
  expect(decision.allowed).toBe(false);
  if (!decision.allowed) expect(decision.code).toBe('UNKNOWN_ACTION');
});
