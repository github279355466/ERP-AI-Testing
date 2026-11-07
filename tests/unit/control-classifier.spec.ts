import { expect, test } from '@playwright/test';
import { classifyControl } from '../../src/controls/control-classifier';

test('识别基础资料选择器', () => {
  const result = classifyControl({
    tag: 'div',
    className: 'Select-module_select__U4LyF WindowSelect-module_windowSelect__RGRx1',
  });
  expect(result.kind).toBe('LOOKUP');
  expect(result.confidence).toBe('high');
});

test('识别开关控件', () => {
  expect(classifyControl({ tag: 'button', className: 'Switch-module_switch__PKzsW' }).kind).toBe('SWITCH');
});

test('识别普通下拉与禁用下拉', () => {
  expect(classifyControl({ tag: 'div', className: 'Select-module_select__U4LyF' }).kind).toBe('DROPDOWN');
  expect(classifyControl({ tag: 'div', className: 'Select-module_select__U4LyF Select-module_disabled__kkzG-' }).kind).toBe('READONLY');
});

test('识别弹窗与表格', () => {
  expect(classifyControl({ tag: 'div', className: 'rc-dialog-wrap' }).kind).toBe('MODAL');
  expect(classifyControl({ tag: 'div', className: 'ag-row ag-row-even' }).kind).toBe('GRID');
});

test('识别输入框类型', () => {
  expect(classifyControl({ tag: 'input', className: 'digi-input', inputType: 'text' }).kind).toBe('TEXT');
  expect(classifyControl({ tag: 'input', className: 'digi-checkbox-input', inputType: 'checkbox' }).kind).toBe('CHECKBOX');
  expect(classifyControl({ tag: 'input', className: 'digi-input', readOnly: true }).kind).toBe('READONLY');
});

test('无法判定时返回 UNKNOWN', () => {
  const result = classifyControl({ tag: 'section', className: 'custom-unknown-block' });
  expect(result.kind).toBe('UNKNOWN');
  expect(result.confidence).toBe('low');
});
