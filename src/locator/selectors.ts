export const SELECTORS = {
  portal: {
    header: '#main-header',
    sider: '.sider',
    menuList: 'ul.menu-list',
    menuNode: '.menu-content[id]',
    tabBar: '.ath-tab-menus-ul',
  },
  business: {
    tabs: '.ant-tabs-tab',
    tabActive: '.ant-tabs-tab-active',
    tabRemove: '.ant-tabs-tab-remove',
  },
  form: {
    item: '[class*="FormItem-module_form-item__"]',
    required: '[class*="FormItem-module_form-item-label-required__"]',
    labelText: '[class*="FormItem-module_form-item-label-text__"]',
  },
  select: {
    root: '[class*="Select-module_select__"]',
    disabled: '[class*="Select-module_disabled__"]',
  },
  dropdown: {
    root: '.ath-select-dropdown',
    option: '.ath-select-item-option',
    optionSelected: '.ath-select-item-option-selected',
  },
  lookup: {
    root: '[class*="WindowSelect-module_windowSelect"]',
  },
  modal: {
    root: '.rc-dialog-wrap',
    dialog: '.rc-dialog',
    close: '.rc-dialog-close',
  },
  grid: {
    row: '.ag-row',
    cell: '.ag-cell',
    header: '.ag-header-cell',
    centerRows: '.ag-center-cols-container .ag-row',
  },
  buttons: {
    rowAction: 'button.custom-op-text-btn',
  },
} as const;

export function fieldLabelSelector(fieldPath: string): string {
  if (!fieldPath.includes('.')) {
    throw new Error(`字段路径必须形如 <entity>.<field>，实际: ${fieldPath}`);
  }
  return `label[for="${fieldPath}"]`;
}

export function gridCellSelector(colId: string): string {
  return `.ag-cell[col-id="${colId}"]`;
}

export function gridHeaderSelector(colId: string): string {
  return `.ag-header-cell[col-id="${colId}"]`;
}

export function gridRowSelector(rowIndex: number): string {
  return `.ag-row[row-index="${rowIndex}"]`;
}
