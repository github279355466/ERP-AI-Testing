import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { loadConfig } from '../../src/config/athena-config';
import { loadNavigationFile, normalizeMenuLabel } from '../../src/navigation/navigation-manager';

const config = loadConfig('config/athena.config.json');

test('导航配置包含采购订单实际菜单路径', () => {
  const file = loadNavigationFile(config);
  expect(file.pages['purchase-order'].title).toBe('采购订单');
  expect(file.pages['purchase-order'].menuPath).toEqual(['采购管理', '请釆管理', '采购订单']);
  expect(['candidate', 'confirmed']).toContain(file.pages['purchase-order'].status);
  expect(file.pages['purchase-order'].menuAliases?.['请购管理']).toBe('请釆管理');
});

test('菜单标签归一化兼容 釆/采 与空白', () => {
  expect(normalizeMenuLabel('请釆管理')).toBe(normalizeMenuLabel('请采管理'));
  expect(normalizeMenuLabel(' 采购订单 ')).toBe('采购订单');
  expect(normalizeMenuLabel('采购管理（新）')).toBe('采购管理');
});

test('导航配置缺失时抛错', () => {
  expect(() => loadNavigationFile(config, 'config/not-exists.json')).toThrow(/导航配置不存在/);
});

test('导航配置 status 非法时抛错', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'athena-nav-'));
  const file = path.join(dir, 'nav.json');
  fs.writeFileSync(file, JSON.stringify({ version: '1', pages: { x: { title: 'X', menuPath: ['A'], status: 'bad' } } }), 'utf8');
  try {
    expect(() => loadNavigationFile(config, file)).toThrow(/status 非法/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
