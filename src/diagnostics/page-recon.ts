import { Page } from '@playwright/test';
import { AdapterSet } from '../adapters';
import { probePurchaseOrderControls } from './control-probe';

export interface ReconField {
  fieldKey: string;
  label: string;
  source: 'list' | 'detail-header' | 'detail-grid';
  fieldPath?: string;
  tag: string;
  className: string;
  required: boolean;
  disabled: boolean;
  observedType: string;
  locatorStrategy: string;
}

export interface PageRecon {
  pageKey: string;
  knowledgePageId: string;
  actualPageName: string;
  navigationPath: string[];
  capturedAt: string;
  list: {
    headers: Array<{ colId: string; label: string }>;
    rows: number;
    buttons: string[];
    tabs: string[];
  };
  detail: {
    fields: ReconField[];
    grids: Array<{ index: number; headers: Array<{ colId: string; label: string }>; rows: number }>;
    tabs: string[];
    saveButton: { visible: boolean; enabled: boolean };
    lookup: { field: string; title: string; columns: string[]; rowCount: number };
  };
  evidence: string[];
}

export async function reconPurchaseOrder(
  page: Page,
  adapters: AdapterSet,
  options: { navigationPath: string[]; marker: string },
): Promise<PageRecon> {
  const list = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('.ant-tabs-tab')).map((tab) =>
      (tab.textContent ?? '').replace(/[×\s]+/g, ' ').trim(),
    );
    const buttons = Array.from(document.querySelectorAll('button'))
      .filter((button) => (button as HTMLElement).offsetWidth > 0)
      .map((button) => (button.textContent ?? '').replace(/\s+/g, ' ').trim())
      .filter(Boolean);
    const headers = Array.from(document.querySelectorAll('.ag-header-cell[col-id]'))
      .filter((cell) => (cell as HTMLElement).offsetWidth > 0)
      .map((cell) => ({
        colId: cell.getAttribute('col-id') ?? '',
        label: (cell.textContent ?? '').replace(/\s+/g, ' ').trim(),
      }))
      .filter((item) => item.colId && !item.colId.startsWith('$$_'));
    const rows = document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]').length;
    return { tabs, buttons, headers, rows };
  });

  const add = await adapters.profile.button('新增');
  await adapters.button.click(add, { text: '新增', actionType: 'new' });
  await page.waitForFunction(
    () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
    undefined,
    { timeout: 30_000 },
  );

  const probe = await probePurchaseOrderControls(page, adapters, options.marker);
  const fields: ReconField[] = probe.fields
    .filter((field) => field.fieldPath)
    .map((field) => {
      const fieldKey = field.fieldPath.replace(/^po\./, '');
      const observedType = inferObservedType(field.tag, field.className, fieldKey);
      return {
        fieldKey,
        label: field.label,
        source: 'detail-header',
        fieldPath: field.fieldPath,
        tag: field.tag,
        className: field.className,
        required: field.required,
        disabled: field.disabled,
        observedType,
        locatorStrategy: locatorStrategy(field.fieldPath, observedType),
      };
    });

  const detailGrid = probe.checks.grids.find((grid) => grid.headers.some((header) => header.colId === 'item_no'));
  for (const header of detailGrid?.headers ?? []) {
    if (!header.colId || header.colId.startsWith('$$_') || header.colId === 'operate') continue;
    fields.push({
      fieldKey: header.colId,
      label: header.label,
      source: 'detail-grid',
      tag: 'grid-cell',
      className: '',
      required: header.label.startsWith('*'),
      disabled: false,
      observedType: 'GRID_COLUMN',
      locatorStrategy: `.ag-row[row-index] .ag-cell[col-id="${header.colId}"]`,
    });
  }

  const listKeys = new Set(fields.map((field) => field.fieldKey));
  for (const header of list.headers) {
    if (listKeys.has(header.colId) || header.colId === 'operate') continue;
    fields.push({
      fieldKey: header.colId,
      label: header.label,
      source: 'list',
      tag: 'grid-cell',
      className: '',
      required: false,
      disabled: false,
      observedType: 'GRID_COLUMN',
      locatorStrategy: `.ag-row[row-index] .ag-cell[col-id="${header.colId}"]`,
    });
  }

  return {
    pageKey: 'purchase-order',
    knowledgePageId: 'PAGE-5B4F7C2A66CC',
    actualPageName: probe.title,
    navigationPath: options.navigationPath,
    capturedAt: new Date().toISOString(),
    list: {
      headers: list.headers,
      rows: list.rows,
      buttons: list.buttons,
      tabs: list.tabs,
    },
    detail: {
      fields,
      grids: probe.checks.grids,
      tabs: probe.tabs,
      saveButton: probe.checks.saveButton,
      lookup: {
        field: probe.checks.lookupOpenCancel.field,
        title: probe.checks.lookupOpenCancel.title,
        columns: probe.checks.lookupOpenCancel.columns,
        rowCount: probe.checks.lookupOpenCancel.rowCount,
      },
    },
    evidence: ['shots/real-controls.png', 'dom/real-controls.html', 'real-control-probe.json'],
  };
}

function inferObservedType(tag: string, className: string, fieldKey: string): string {
  if (className.includes('WindowSelect-module_windowSelect')) return 'LOOKUP';
  if (className.includes('Select-module_select')) return 'DROPDOWN';
  if (className.includes('input-number-input')) return 'NUMBER_INPUT';
  if (tag === 'button' && className.includes('Switch-module_switch')) return 'SWITCH';
  if (tag === 'input' && /date/.test(fieldKey)) return 'DATE_PICKER';
  if (tag === 'input' || tag === 'textarea') return 'TEXT_INPUT';
  return 'UNKNOWN';
}

function locatorStrategy(fieldPath: string, observedType: string): string {
  if (observedType === 'LOOKUP') return `label[for="${fieldPath}"] -> form-item -> WindowSelect trigger`;
  if (observedType === 'DROPDOWN') return `label[for="${fieldPath}"] -> form-item -> Select`;
  return `label[for="${fieldPath}"] -> form-item -> input`;
}
