import { ControlClassification, ControlDescriptor } from './control-types';

const includes = (value: string | undefined, needle: string): boolean => (value ?? '').includes(needle);

/**
 * 基于真实 DOM 特征识别 Athena ERP 控件。
 * 规则来自页面元素分析报告与实测样本，无法判定时返回 UNKNOWN，不猜测。
 */
export function classifyControl(descriptor: ControlDescriptor): ControlClassification {
  const { tag, className, inputType, readOnly, disabled } = descriptor;
  const cls = className ?? '';
  const lowerTag = tag.toLowerCase();

  if (includes(cls, 'WindowSelect-module_windowSelect')) {
    return { kind: 'LOOKUP', confidence: 'high', reason: 'WindowSelect 容器' };
  }
  if (includes(cls, 'Switch-module_switch')) {
    return { kind: 'SWITCH', confidence: 'high', reason: 'Switch 组件' };
  }
  if (includes(cls, 'rc-dialog-wrap')) {
    return { kind: 'MODAL', confidence: 'high', reason: 'rc-dialog 弹窗容器' };
  }
  if (includes(cls, 'ag-row') || includes(cls, 'ag-center-cols-container')) {
    return { kind: 'GRID', confidence: 'high', reason: 'ag-Grid 行容器' };
  }
  if (lowerTag === 'li' && includes(cls, 'ant-tabs-tab')) {
    return { kind: 'TAB', confidence: 'high', reason: 'antd 页签' };
  }
  if (includes(cls, 'Select-module_select')) {
    if (disabled || includes(cls, 'Select-module_disabled')) {
      return { kind: 'READONLY', confidence: 'high', reason: '禁用的 Select' };
    }
    return { kind: 'DROPDOWN', confidence: 'high', reason: 'Select 组件' };
  }
  if (includes(cls, 'ath-select')) {
    return { kind: 'DROPDOWN', confidence: 'medium', reason: 'ath-select 组件' };
  }
  if (lowerTag === 'input') {
    if (inputType === 'checkbox') return { kind: 'CHECKBOX', confidence: 'high', reason: '复选框' };
    if (inputType === 'password') return { kind: 'TEXT', confidence: 'high', reason: '密码输入框' };
    if (inputType === 'number') return { kind: 'NUMBER', confidence: 'high', reason: '数字输入框' };
    if (readOnly) return { kind: 'READONLY', confidence: 'medium', reason: '只读输入框' };
    if (includes(cls, 'digi-input')) return { kind: 'TEXT', confidence: 'high', reason: 'digi-input 输入框' };
    return { kind: 'TEXT', confidence: 'low', reason: '普通输入框' };
  }
  if (lowerTag === 'button') {
    return { kind: 'WORKFLOW_BUTTON', confidence: 'low', reason: '按钮，需按文本判定语义' };
  }

  return { kind: 'UNKNOWN', confidence: 'low', reason: `未匹配规则: tag=${lowerTag} class=${cls.slice(0, 60)}` };
}

export function isHighRiskClass(kind: string): boolean {
  return kind === 'WORKFLOW_BUTTON';
}
