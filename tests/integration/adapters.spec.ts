import { expect, test } from '@playwright/test';
import { createAdapters } from '../../src/adapters';
import { loadConfig } from '../../src/config/athena-config';
import { SafetyPolicy } from '../../src/runner/safety-policy';

const config = loadConfig('config/athena.write.config.json');
const policy = new SafetyPolicy(config, {});

const FIXTURE = `<!doctype html>
<html><head><meta charset="utf-8"><style>
.hidden{display:none}
.test-modal{border:1px solid #333;padding:8px}
.test-row{display:block}
.ant-tree-switcher{display:inline-block;width:16px;height:16px}
</style></head><body>
<label for="demo.input">名称</label>
<div class="FormItem-module_form-item__"><input id="demo.input" data-testid="input" value=""></div>
<input data-testid="readonly" readonly value="RO">
<input data-testid="disabled" disabled value="DIS">
<button data-testid="button" onclick="window.__clicks=(window.__clicks||0)+1">保存</button>
<button data-testid="disabled-button" disabled>禁用</button>
<div data-testid="dropdown">请选择</div>
<div class="test-dropdown hidden"><div class="test-option">选项A</div><div class="test-option">选项B</div></div>
<input data-testid="date" value="">
<button data-testid="open-modal">打开弹窗</button>
<div class="test-modal hidden">
  <div>确认操作</div>
  <button data-testid="modal-ok">确认</button>
  <button data-testid="modal-cancel">取消</button>
</div>
<div class="test-tabs">
  <div class="test-tab active">列表<button class="test-remove">x</button></div>
  <div class="test-tab">详情</div>
</div>
<div class="test-grid">
  <div class="test-header" col-id="a">A</div>
  <div class="test-header" col-id="b">B</div>
  <div class="test-row" row-index="0"><div class="test-cell" col-id="a">1</div><div class="test-cell" col-id="b">2</div><button>删除</button></div>
  <div class="test-row" row-index="1"><div class="test-cell" col-id="a">3</div><div class="test-cell" col-id="b">4</div><button>删除</button></div>
</div>
<button data-testid="add-row">新增行</button>
<button data-testid="lookup-trigger">选择供应商</button>
<div class="test-lookup hidden">
  <div>选择供应商</div>
  <div data-testid="lookup-field">供应商编号</div>
  <div class="test-option">供应商编号</div>
  <input data-testid="lookup-value" placeholder="请输入值">
  <button>筛选</button>
  <div class="ag-header-cell" col-id="supp_no">供应商编号</div>
  <div class="test-row" row-index="0">SUP-001</div>
  <div class="test-row" row-index="1">SUP-002</div>
  <input class="digi-radio-input" type="radio">
  <button>确认</button>
  <button>取消</button>
</div>
<div class="ant-tree">
  <div class="ant-tree-treenode">Root<span class="ant-tree-switcher"></span><div class="child hidden">Child</div></div>
</div>
<script>
document.querySelector('[data-testid="dropdown"]').addEventListener('click', () => {
  document.querySelector('.test-dropdown').classList.remove('hidden');
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') document.querySelector('.test-dropdown').classList.add('hidden');
});
document.querySelectorAll('.test-option').forEach((option) => option.addEventListener('click', () => {
  const text = option.textContent;
  if (document.querySelector('[data-testid="dropdown"]')) {
    document.querySelector('[data-testid="dropdown"]').textContent = text;
    document.querySelector('.test-dropdown').classList.add('hidden');
  }
}));
document.querySelectorAll('.test-cell').forEach((cell) => cell.addEventListener('dblclick', () => {
  const input = document.createElement('input');
  input.value = cell.textContent;
  cell.textContent = '';
  cell.appendChild(input);
  input.focus();
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') cell.textContent = input.value;
  });
}));
document.querySelector('[data-testid="add-row"]').addEventListener('click', () => {
  const grid = document.querySelector('.test-grid');
  const index = grid.querySelectorAll('.test-row').length;
  const row = document.createElement('div');
  row.className = 'test-row';
  row.setAttribute('row-index', String(index));
  row.innerHTML = '<div class="test-cell" col-id="a">5</div><div class="test-cell" col-id="b">6</div><button>删除</button>';
  grid.appendChild(row);
});
document.querySelectorAll('.test-grid .test-row button').forEach((button) => button.addEventListener('click', () => {
  button.closest('.test-row').remove();
}));
document.querySelector('[data-testid="open-modal"]').addEventListener('click', () => document.querySelector('.test-modal').classList.remove('hidden'));
document.querySelector('[data-testid="modal-ok"]').addEventListener('click', () => document.querySelector('.test-modal').classList.add('hidden'));
document.querySelector('[data-testid="modal-cancel"]').addEventListener('click', () => document.querySelector('.test-modal').classList.add('hidden'));
document.querySelectorAll('.test-tab').forEach((tab) => tab.addEventListener('click', () => {
  document.querySelectorAll('.test-tab').forEach((item) => item.classList.remove('active'));
  tab.classList.add('active');
}));
document.querySelector('.test-remove').addEventListener('click', (event) => {
  event.stopPropagation();
  event.target.closest('.test-tab').remove();
});
document.querySelector('[data-testid="lookup-trigger"]').addEventListener('click', () => document.querySelector('.test-lookup').classList.remove('hidden'));
document.querySelector('.test-lookup button:last-child').addEventListener('click', () => document.querySelector('.test-lookup').classList.add('hidden'));
document.querySelector('.test-lookup button:nth-last-child(2)').addEventListener('click', () => {
  document.querySelector('[data-testid="input"]').value = 'SUP-001';
  document.querySelector('.test-lookup').classList.add('hidden');
});
document.querySelector('.ant-tree-switcher').addEventListener('click', (event) => {
  const node = event.target.closest('.ant-tree-treenode');
  node.classList.add('ant-tree-treenode-switcher-open');
  node.querySelector('.child').classList.remove('hidden');
});
document.querySelector('.ant-tree-treenode').addEventListener('click', (event) => {
  if (event.target.classList.contains('ant-tree-switcher')) return;
  event.currentTarget.setAttribute('data-selected', 'true');
});
</script></body></html>`;

test.beforeEach(async ({ page }) => {
  await page.setContent(FIXTURE);
});

function adapters(page: import('@playwright/test').Page) {
  return createAdapters(page, policy, 4_000);
}

test.describe('InputAdapter', () => {
  test('填写并回读', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'input' }]);
    const result = await a.input.fill(control, '测试值');
    expect(result.actual).toBe('测试值');
    expect(await a.input.read(control)).toBe('测试值');
  });

  test('清空输入', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'input' }]);
    await a.input.fill(control, 'abc');
    await a.input.clear(control);
    expect(await a.input.read(control)).toBe('');
  });

  test('识别只读与禁用', async ({ page }) => {
    const a = adapters(page);
    const readonly = await a.context.resolver.resolve([{ kind: 'testid', value: 'readonly' }]);
    const disabled = await a.context.resolver.resolve([{ kind: 'testid', value: 'disabled' }]);
    expect(await a.input.isReadOnly(readonly)).toBe(true);
    expect(await a.input.isDisabled(disabled)).toBe(true);
  });
});

test.describe('ButtonAdapter', () => {
  test('点击按钮', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'button' }]);
    await a.button.click(control, { text: '保存', actionType: 'click' });
    expect(await page.evaluate(() => (window as any).__clicks)).toBe(1);
  });

  test('禁用按钮不可点击', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'disabled-button' }]);
    await expect(a.button.click(control, { text: '禁用' })).rejects.toThrow(/CONTROL_DISABLED/);
  });

  test('可见性检查', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'button' }]);
    expect(await a.button.isVisible(control)).toBe(true);
    expect(await a.button.isEnabled(control)).toBe(true);
  });
});

test.describe('DropdownAdapter', () => {
  const options = { overlaySelector: '.test-dropdown', optionSelector: '.test-option' };

  test('展开并读取选项', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'dropdown' }]);
    await a.dropdown.open(control, options);
    expect(await a.dropdown.options(options)).toEqual(['选项A', '选项B']);
  });

  test('选择选项并回读', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'dropdown' }]);
    const actual = await a.dropdown.select(control, '选项B', options);
    expect(actual).toContain('选项B');
  });

  test('关闭下拉', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'dropdown' }]);
    await a.dropdown.open(control, options);
    await a.dropdown.close(options);
    expect(await page.locator('.test-dropdown').isVisible()).toBe(false);
  });
});

test.describe('DateAdapter', () => {
  test('填写并回读日期', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'date' }]);
    expect(await a.date.fill(control, '2026-11-08')).toBe('2026-11-08');
    expect(await a.date.read(control)).toBe('2026-11-08');
  });

  test('日期后置校验失败可检出', async ({ page }) => {
    const a = adapters(page);
    const control = await a.context.resolver.resolve([{ kind: 'testid', value: 'date' }]);
    await page.evaluate(() => {
      const input = document.querySelector('[data-testid="date"]') as HTMLInputElement;
      input.addEventListener('input', () => { input.value = ''; });
    });
    await expect(a.date.fill(control, '2026-11-08')).rejects.toThrow(/DATE_POSTCHECK_FAILED/);
  });
});

test.describe('ModalAdapter', () => {
  const options = { rootSelector: '.test-modal', confirmText: '确认', cancelText: '取消' };

  test('打开并读取弹窗', async ({ page }) => {
    const a = adapters(page);
    await page.click('[data-testid="open-modal"]');
    await a.modal.wait(options);
    const info = await a.modal.read(options);
    expect(info?.buttons).toContain('确认');
  });

  test('确认弹窗', async ({ page }) => {
    const a = adapters(page);
    await page.click('[data-testid="open-modal"]');
    await a.modal.confirm(options);
    expect(await page.locator('.test-modal').isVisible()).toBe(false);
  });

  test('取消弹窗', async ({ page }) => {
    const a = adapters(page);
    await page.click('[data-testid="open-modal"]');
    await a.modal.cancel(options);
    expect(await page.locator('.test-modal').isVisible()).toBe(false);
  });
});

test.describe('TabAdapter', () => {
  const options = { tabSelector: '.test-tab', activeSelector: '.test-tab.active', removeSelector: '.test-remove' };

  test('读取页签', async ({ page }) => {
    const a = adapters(page);
    expect(await a.tab.list(options)).toEqual(['列表x', '详情']);
    expect(await a.tab.active(options)).toBe('列表x');
  });

  test('切换页签', async ({ page }) => {
    const a = adapters(page);
    expect(await a.tab.activate('详情', options)).toContain('详情');
  });

  test('关闭页签', async ({ page }) => {
    const a = adapters(page);
    expect(await a.tab.close('列表', options)).toBe(true);
    expect(await a.tab.list(options)).toEqual(['详情']);
  });
});

test.describe('GridAdapter', () => {
  const options = {
    rowSelector: '.test-row',
    cellSelector: '.test-cell',
    headerSelector: '.test-header',
    rowActionSelector: 'button',
    rootSelector: '.test-grid',
  };

  test('读取行列', async ({ page }) => {
    const a = adapters(page);
    const grid = a.grid(options);
    expect(await grid.rowCount()).toBe(2);
    expect(await grid.cellText(0, 'a')).toBe('1');
    expect((await grid.headers()).map((item) => item.colId)).toEqual(['a', 'b']);
  });

  test('编辑单元格', async ({ page }) => {
    const a = adapters(page);
    const grid = a.grid(options);
    expect(await grid.setCell(0, 'a', '99')).toContain('99');
  });

  test('新增与删除行', async ({ page }) => {
    const a = adapters(page);
    const grid = a.grid(options);
    const add = await a.context.resolver.resolve([{ kind: 'testid', value: 'add-row' }]);
    expect(await grid.addRow(add, 3)).toBe(3);
    await grid.deleteRow(0);
    expect(await grid.rowCount()).toBe(2);
  });
});

test.describe('LookupAdapter', () => {
  const options = {
    modalSelector: '.test-lookup',
    rowSelector: '.test-row',
    filterFieldSelector: '[data-testid="lookup-field"]',
    filterValueSelector: '[data-testid="lookup-value"]',
    filterButtonText: '筛选',
    confirmText: '确认',
    cancelText: '取消',
    optionSelector: '.test-option',
  };

  test('打开并读取开窗结构', async ({ page }) => {
    const a = adapters(page);
    const trigger = await a.context.resolver.resolve([{ kind: 'testid', value: 'lookup-trigger' }]);
    await a.lookup.open(trigger, options);
    const info = await a.lookup.readInfo(options);
    expect(info.columns).toContain('供应商编号');
    expect(info.selectionMode).toBe('single');
  });

  test('筛选、选择、确认并回填', async ({ page }) => {
    const a = adapters(page);
    const trigger = await a.context.resolver.resolve([{ kind: 'testid', value: 'lookup-trigger' }]);
    await a.lookup.open(trigger, options);
    await a.lookup.filter(options, '供应商编号', 'SUP-001');
    await a.lookup.selectRow(options, 'SUP-001');
    await a.lookup.confirm(options);
    const input = await a.context.resolver.resolve([{ kind: 'testid', value: 'input' }]);
    expect(await a.lookup.readBack(input)).toBe('SUP-001');
  });

  test('取消开窗', async ({ page }) => {
    const a = adapters(page);
    const trigger = await a.context.resolver.resolve([{ kind: 'testid', value: 'lookup-trigger' }]);
    await a.lookup.open(trigger, options);
    await a.lookup.cancel(options);
    expect(await page.locator('.test-lookup').isVisible()).toBe(false);
  });
});

test.describe('TreeAdapter', () => {
  const options = { rootSelector: '.ant-tree', nodeSelector: '.ant-tree-treenode', switcherSelector: '.ant-tree-switcher' };

  test('展开节点', async ({ page }) => {
    const a = adapters(page);
    expect(await a.tree.expand('Root', options)).toBe(true);
    expect(await a.tree.isExpanded('Root', options)).toBe(true);
  });

  test('选择节点', async ({ page }) => {
    const a = adapters(page);
    await a.tree.select('Root', options);
    expect(await page.locator('.ant-tree-treenode').getAttribute('data-selected')).toBe('true');
  });

  test('读取节点', async ({ page }) => {
    const a = adapters(page);
    expect((await a.tree.readNodes(options)).join(' ')).toContain('Root');
  });
});
