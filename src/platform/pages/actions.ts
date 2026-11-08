import { Page } from '@playwright/test';
import { AdapterSet } from '../../adapters';
import { ATHENA_SELECTORS } from '../../locator/athena-profile';
import { LookupOptions } from '../../adapters/lookup-adapter';
import { DropdownOptions } from '../../adapters/dropdown-adapter';
import { PageFieldMapping, PageMapping, resolvePageField } from './mapping';

export interface PageActionOptions {
  allowWrite: boolean;
  timeoutMs?: number;
  lookup?: Partial<LookupOptions>;
  dropdown?: Partial<DropdownOptions>;
}

export interface PageActionOutcome {
  action: string;
  page_key: string;
  field?: string;
  expected?: string;
  actual?: string;
  strategy?: string;
}

export class PageActionError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'PageActionError';
  }
}

const DEFAULT_LOOKUP: LookupOptions = {
  modalSelector: ATHENA_SELECTORS.modal,
  rowSelector: ATHENA_SELECTORS.gridRow,
  filterFieldSelector: 'input',
  filterValueSelector: 'input',
  filterButtonText: '查询',
  confirmText: '确定',
  cancelText: '取消',
  optionSelector: ATHENA_SELECTORS.dropdownOption,
};

const DEFAULT_DROPDOWN: DropdownOptions = {
  overlaySelector: ATHENA_SELECTORS.dropdownOverlay,
  optionSelector: ATHENA_SELECTORS.dropdownOption,
  selectedSelector: ATHENA_SELECTORS.dropdownSelected,
};

export class PageActionExecutor {
  private readonly timeoutMs: number;
  private readonly lookupOptions: LookupOptions;
  private readonly dropdownOptions: DropdownOptions;

  constructor(
    private readonly page: Page,
    private readonly mapping: PageMapping,
    private readonly adapters: AdapterSet,
    private readonly options: PageActionOptions,
  ) {
    this.timeoutMs = options.timeoutMs ?? 15_000;
    this.lookupOptions = { ...DEFAULT_LOOKUP, ...options.lookup };
    this.dropdownOptions = { ...DEFAULT_DROPDOWN, ...options.dropdown };
  }

  private requireWrite(action: string): void {
    if (!this.options.allowWrite) {
      throw new PageActionError('PAGE_WRITE_NOT_AUTHORIZED', `${this.mapping.page_key} 的 ${action} 属于写操作，未获得本次运行授权`);
    }
  }

  private requireField(fieldName: string): PageFieldMapping {
    const field = this.mapping.fields.find((candidate) => candidate.name === fieldName);
    if (!field) {
      throw new PageActionError('PAGE_FIELD_NOT_MAPPED', `${this.mapping.page_key} 未登记字段: ${fieldName}`);
    }
    return field;
  }

  async fill(fieldName: string, value: string): Promise<PageActionOutcome> {
    this.requireWrite('fill');
    const field = this.requireField(fieldName);
    if (field.readonly) {
      throw new PageActionError('PAGE_FIELD_READONLY', `${this.mapping.page_key}.${fieldName} 标记为只读`);
    }
    const control = await resolvePageField(this.page, this.mapping, field, this.timeoutMs);
    if (field.control_type === 'DATE_PICKER') {
      await this.adapters.date.fill(control, value, {}, field.label);
    } else {
      await this.adapters.input.fill(control, value, field.label);
    }
    return { action: 'fill', page_key: this.mapping.page_key, field: fieldName, expected: value, actual: value, strategy: control.strategy };
  }

  async selectMasterData(fieldName: string, value: string, searchLabel?: string): Promise<PageActionOutcome> {
    this.requireWrite('select_master_data');
    const field = this.requireField(fieldName);
    const control = await resolvePageField(this.page, this.mapping, field, this.timeoutMs);
    await this.adapters.lookup.open(control, this.lookupOptions, field.label);
    await this.adapters.lookup.filter(this.lookupOptions, searchLabel ?? field.label, value);
    const info = await this.adapters.lookup.readInfo(this.lookupOptions);
    if (info.rowCount === 0) {
      await this.adapters.lookup.cancel(this.lookupOptions);
      throw new PageActionError('LOOKUP_NO_ROWS', `${field.label} 筛选 ${value} 后无数据`);
    }
    await this.adapters.lookup.selectRow(this.lookupOptions, value);
    await this.adapters.lookup.confirm(this.lookupOptions);
    const actual = await control.locator
      .inputValue()
      .catch(async () => ((await control.locator.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim());
    return { action: 'select_master_data', page_key: this.mapping.page_key, field: fieldName, expected: value, actual, strategy: control.strategy };
  }

  async selectOption(fieldName: string, optionText: string): Promise<PageActionOutcome> {
    this.requireWrite('select_option');
    const field = this.requireField(fieldName);
    const control = await resolvePageField(this.page, this.mapping, field, this.timeoutMs);
    const actual = await this.adapters.dropdown.select(control, optionText, this.dropdownOptions, field.label);
    return { action: 'select_option', page_key: this.mapping.page_key, field: fieldName, expected: optionText, actual, strategy: control.strategy };
  }

  async clickButton(text: string, options: { write?: boolean } = {}): Promise<PageActionOutcome> {
    if (options.write ?? false) this.requireWrite('click');
    const button = await this.adapters.profile.button(text);
    await this.adapters.button.click(button, { text, actionType: 'click' });
    return { action: 'click', page_key: this.mapping.page_key, field: text, strategy: button.strategy };
  }

  async readValue(fieldName: string): Promise<PageActionOutcome> {
    const field = this.requireField(fieldName);
    const control = await resolvePageField(this.page, this.mapping, field, this.timeoutMs);
    const value = field.control_type === 'DROPDOWN'
      ? await this.adapters.dropdown.read(control, this.dropdownOptions)
      : await control.locator.inputValue().catch(async () => ((await control.locator.innerText().catch(() => '')) ?? '').trim());
    return { action: 'read', page_key: this.mapping.page_key, field: fieldName, actual: value, strategy: control.strategy };
  }

  async assertVisible(fieldName: string): Promise<PageActionOutcome> {
    const field = this.requireField(fieldName);
    const control = await resolvePageField(this.page, this.mapping, field, this.timeoutMs);
    const visible = await control.locator.isVisible().catch(() => false);
    if (!visible) throw new PageActionError('ASSERT_VISIBLE_FAILED', `${this.mapping.page_key}.${fieldName} 不可见`);
    return { action: 'assert_visible', page_key: this.mapping.page_key, field: fieldName, actual: 'visible', strategy: control.strategy };
  }

  async assertValue(fieldName: string, expected: string): Promise<PageActionOutcome> {
    const outcome = await this.readValue(fieldName);
    const actual = outcome.actual ?? '';
    if (!actual.includes(expected)) {
      throw new PageActionError('ASSERT_VALUE_FAILED', `${this.mapping.page_key}.${fieldName} 期望包含「${expected}」，实际「${actual}」`);
    }
    return { ...outcome, action: 'assert_value', expected };
  }

  async save(buttonText = '保存'): Promise<PageActionOutcome> {
    this.requireWrite('save');
    return this.clickButton(buttonText, { write: true });
  }
}
