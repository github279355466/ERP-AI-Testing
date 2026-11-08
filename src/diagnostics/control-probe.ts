import { Page } from '@playwright/test';
import { AdapterSet } from '../adapters';
import { ATHENA_SELECTORS } from '../locator/athena-profile';

export interface RealControlProbe {
  title: string;
  tabs: string[];
  formItems: number;
  fields: Array<{ fieldPath: string; label: string; tag: string; className: string; required: boolean; disabled: boolean }>;
  checks: {
    inputFillClear: { field: string; passed: boolean; detail: string };
    dateReadFill: { field: string; value: string; passed: boolean };
    dropdownRead: { field: string; value: string; disabled: boolean };
    lookupOpenCancel: { field: string; title: string; columns: string[]; rowCount: number; passed: boolean };
    saveButton: { visible: boolean; enabled: boolean };
    grids: Array<{ index: number; headers: Array<{ colId: string; label: string }>; rows: number }>;
  };
}

export async function probePurchaseOrderControls(
  page: Page,
  adapters: AdapterSet,
  marker: string,
): Promise<RealControlProbe> {
  const fields = await page.evaluate(() => {
    const items = Array.from(document.querySelectorAll('[class*="FormItem-module_form-item__"]')).filter(
      (item) => (item as HTMLElement).offsetWidth > 0,
    );
    return items.map((item) => {
      const label = item.querySelector('label[for]');
      const control = item.querySelector(
        'input, textarea, button, [class*="Select-module_select__"], [class*="WindowSelect-module_windowSelect"]',
      );
      return {
        fieldPath: label?.getAttribute('for') ?? '',
        label: (item.querySelector('[class*="form-item-label-text__"]')?.textContent || label?.textContent || '')
          .replace(/\s+/g, ' ')
          .trim(),
        tag: control ? control.tagName.toLowerCase() : '',
        className: control ? String(control.className).slice(0, 160) : '',
        required: Boolean(item.querySelector('[class*="form-item-label-required__"]')),
        disabled: control ? control.hasAttribute('disabled') || String(control.className).includes('disabled') : false,
      };
    });
  });

  const rmk = await adapters.profile.input('po.rmk');
  await adapters.input.fill(rmk, marker, '备注');
  const afterFill = await adapters.input.read(rmk);
  await adapters.input.clear(rmk, '备注');
  const afterClear = await adapters.input.read(rmk);

  const dateControl = await adapters.profile.input('po.doc_date');
  const dateValue = await adapters.date.read(dateControl);
  await adapters.date.fill(dateControl, dateValue, {}, '单据日期');

  const dropdown = await adapters.profile.dropdown('po.pur_type');
  const dropdownValue = await adapters.dropdown.read(dropdown, {
    overlaySelector: ATHENA_SELECTORS.dropdownOverlay,
    optionSelector: ATHENA_SELECTORS.dropdownOption,
    selectedSelector: ATHENA_SELECTORS.dropdownSelected,
  });
  const dropdownClass = (await dropdown.locator.getAttribute('class').catch(() => '')) ?? '';

  const supplier = await adapters.profile.lookup('po.supp_no');
  await adapters.lookup.open(supplier, {
    modalSelector: ATHENA_SELECTORS.modal,
    rowSelector: '.ag-center-cols-container .ag-row[row-index]',
    filterFieldSelector: '[class*="ConditionRow-module_row-field"] .ath-select',
    filterValueSelector: 'input[placeholder="请输入值"]',
    filterButtonText: '筛选',
    confirmText: '确认',
    cancelText: '取消',
    optionSelector: ATHENA_SELECTORS.dropdownOption,
  });
  const lookupInfo = await adapters.lookup.readInfo({
    modalSelector: ATHENA_SELECTORS.modal,
    rowSelector: '.ag-center-cols-container .ag-row[row-index]',
    filterFieldSelector: '[class*="ConditionRow-module_row-field"] .ath-select',
    filterValueSelector: 'input[placeholder="请输入值"]',
    filterButtonText: '筛选',
    confirmText: '确认',
    cancelText: '取消',
  });
  await adapters.lookup.cancel({
    modalSelector: ATHENA_SELECTORS.modal,
    rowSelector: '.ag-center-cols-container .ag-row[row-index]',
    filterFieldSelector: '[class*="ConditionRow-module_row-field"] .ath-select',
    filterValueSelector: 'input[placeholder="请输入值"]',
    filterButtonText: '筛选',
    confirmText: '确认',
    cancelText: '取消',
  });

  const save = await adapters.profile.button('保存');
  const title = await page.title();
  const tabs = await adapters.tab.list({
    tabSelector: ATHENA_SELECTORS.tabs,
    activeSelector: ATHENA_SELECTORS.tabActive,
  });
  const grids = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.ag-root')).map((root, index) => ({
      index,
      headers: Array.from(root.querySelectorAll('.ag-header-cell[col-id]')).map((cell) => ({
        colId: cell.getAttribute('col-id') ?? '',
        label: (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
      })),
      rows: root.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length,
    }));
  });

  return {
    title,
    tabs,
    formItems: fields.length,
    fields,
    checks: {
      inputFillClear: {
        field: 'po.rmk',
        passed: afterFill === marker && afterClear === '',
        detail: `fill=${afterFill}, clear=${afterClear}`,
      },
      dateReadFill: { field: 'po.doc_date', value: dateValue, passed: true },
      dropdownRead: {
        field: 'po.pur_type',
        value: dropdownValue,
        disabled: dropdownClass.includes('disabled'),
      },
      lookupOpenCancel: {
        field: 'po.supp_no',
        title: lookupInfo.title,
        columns: lookupInfo.columns,
        rowCount: lookupInfo.rowCount,
        passed: lookupInfo.columns.length > 0,
      },
      saveButton: {
        visible: await adapters.button.isVisible(save),
        enabled: await adapters.button.isEnabled(save),
      },
      grids,
    },
  };
}
