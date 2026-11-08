import { Page } from '@playwright/test';
import { AdapterSet } from '../../adapters';
import { AthenaConfig } from '../../config/athena-config';
import { PageManager } from '../../browser/page-manager';
import { ATHENA_SELECTORS } from '../../locator/athena-profile';
import { MasterDataActions } from '../../runner/actions/master-data-actions';
import { ErpTabs } from '../../controls/erp-tabs';
import { BasePageObject } from '../base/page-object';

export interface PurchaseOrderHeaderInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docDate?: string;
  project?: string;
}

export interface PurchaseOrderLineInput {
  itemNo: string;
  qty: string;
  price?: string;
}

export class PurchaseOrderPage extends BasePageObject {
  private readonly masterData: MasterDataActions;

  constructor(page: Page, config: AthenaConfig, adapters: AdapterSet, pages: PageManager) {
    super(page, config, adapters, pages);
    this.masterData = new MasterDataActions(() => this.page);
  }

  async openNew(): Promise<void> {
    const add = await this.adapters.profile.button('新增');
    await this.adapters.button.click(add, { text: '新增', actionType: 'new' });
    await this.page.waitForFunction(
      () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
      undefined,
      { timeout: this.config.browser.readyTimeoutMs },
    );
    await this.page.waitForTimeout(800);
  }

  async selectSearchField(fieldPath: string, searchField: string, value: string): Promise<string> {
    const trigger = await this.adapters.profile.lookup(fieldPath);
    await this.adapters.lookup.open(trigger, this.lookupOptions(), fieldPath);
    await this.adapters.lookup.filter(this.lookupOptions(), searchField, value);
    const info = await this.adapters.lookup.readInfo(this.lookupOptions());
    if (info.rowCount === 0) {
      await this.adapters.lookup.cancel(this.lookupOptions());
      throw new Error(`[LOOKUP_NO_ROWS] ${fieldPath} 筛选 ${searchField}=${value} 后无数据`);
    }
    await this.adapters.lookup.selectRow(this.lookupOptions(), value);
    await this.adapters.lookup.confirm(this.lookupOptions());
    await this.page.waitForTimeout(800);
    return this.formItemText(fieldPath);
  }

  async ensureHeader(input: PurchaseOrderHeaderInput): Promise<Record<string, string>> {
    await this.selectSearchField('po.ops_unit_no', '运营单元编号', input.opsUnit);
    await this.selectSearchField('po.supp_no', '供应商编号', input.supplier);
    await this.selectSearchField('po.biz_type_no', '业务类型编号', input.bizType);
    if (input.project) {
      await this.selectSearchField('po.proj_no', '项目编号', input.project);
    }
    if (input.docDate) {
      const date = await this.adapters.profile.input('po.doc_date');
      await this.adapters.date.fill(date, input.docDate, {}, '单据日期');
    }
    return {
      opsUnit: await this.formItemText('po.ops_unit_no'),
      supplier: await this.formItemText('po.supp_no'),
      bizType: await this.formItemText('po.biz_type_no'),
      docDate: await this.inputValue('po.doc_date'),
      project: await this.formItemText('po.proj_no'),
      currency: await this.formItemText('po.ccy_no'),
    };
  }

  async addDetailRow(): Promise<number> {
    const add = await this.adapters.profile.button('新增');
    const grid = this.detailGrid();
    return grid.addRow(add, 1);
  }

  async fillRemark(value: string): Promise<void> {
    const remark = await this.adapters.profile.input('po.rmk');
    await this.adapters.input.fill(remark, value, '备注');
  }

  async selectItem(rowIndex: number, itemNo: string): Promise<string> {
    const grid = this.detailGrid();
    const cell = await grid.cell(rowIndex, 'item_no');
    const control = { locator: cell, strategy: `detail-grid row=${rowIndex} col=item_no`, attempts: [], usedFallback: false };
    await this.adapters.lookup.openFromCell(control, this.lookupOptions(), 'item_no');
    const visibleRows = await this.page.locator('.rc-dialog-wrap:visible .ag-center-cols-container .ag-row[row-index]').allInnerTexts();
    if (!visibleRows.some((text) => text.includes(itemNo))) {
      await this.adapters.lookup.filter(this.lookupOptions(), '品号', itemNo);
      const info = await this.adapters.lookup.readInfo(this.lookupOptions());
      if (info.rowCount === 0) {
        await this.adapters.lookup.cancel(this.lookupOptions());
        throw new Error(`[LOOKUP_NO_ROWS] 品号 ${itemNo} 无数据`);
      }
    }
    await this.adapters.lookup.selectRow(this.lookupOptions(), itemNo);
    await this.adapters.lookup.confirm(this.lookupOptions());
    await this.page.waitForTimeout(1_500);
    return grid.cellText(rowIndex, 'item_no');
  }

  async setLine(rowIndex: number, line: PurchaseOrderLineInput): Promise<Record<string, string>> {
    const grid = this.detailGrid();
    await this.selectItem(rowIndex, line.itemNo);
    await grid.setCell(rowIndex, 'biz_qty', line.qty);
    if (line.price) await grid.setCell(rowIndex, 'price', line.price);
    await this.page.waitForTimeout(800);
    return grid.readRows(['po_seq', 'goods_type', 'item_no', 'item_name', 'item_spec', 'biz_qty', 'price', 'amt', 'biz_unit_no'])
      .then((rows) => rows.find((row) => row.rowIndex === rowIndex)?.cells ?? {});
  }

  async save(): Promise<{ toast: string; documentNo: string }> {
    const save = await this.adapters.profile.button('保存');
    await this.adapters.button.click(save, { text: '保存', actionType: 'save' });
    await this.page.waitForTimeout(3_000);
    const toast = await this.readToast();
    const documentNo = await this.inputValue('po.po_doc_no').catch(() => '');
    return { toast, documentNo };
  }

  async filterByDocumentNo(documentNo: string): Promise<void> {
    await this.masterData.filterBy('采购订单单号', documentNo);
    await this.waitListReady();
  }

  async readListRow(documentNo: string): Promise<Record<string, string> | null> {
    return this.masterData.readRow('po_doc_no', documentNo);
  }

  async openExisting(documentNo: string): Promise<void> {
    const target = await this.masterData.openRowAction('po_doc_no', documentNo, '查看');
    if (target.ownsPage) {
      throw new Error('[PURCHASE_ORDER_OPENED_IN_NEW_PAGE] 当前页面对象未绑定新窗口');
    }
    await this.page.waitForFunction(
      () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
      undefined,
      { timeout: this.config.browser.readyTimeoutMs },
    );
    await this.page.waitForTimeout(800);
  }

  async readHeader(): Promise<Record<string, string>> {
    return {
      documentNo: await this.inputValue('po.po_doc_no'),
      opsUnit: await this.formItemText('po.ops_unit_no'),
      supplier: await this.formItemText('po.supp_no'),
      bizType: await this.formItemText('po.biz_type_no'),
      docDate: await this.inputValue('po.doc_date'),
      currency: await this.formItemText('po.ccy_no'),
    };
  }

  async readDetailLines(): Promise<Array<Record<string, string>>> {
    const grid = this.detailGrid();
    return grid.readRows(['po_seq', 'goods_type', 'item_no', 'item_name', 'item_spec', 'biz_qty', 'price', 'amt', 'biz_unit_no'])
      .then((rows) => rows.map((row) => row.cells));
  }

  async submitCurrent(): Promise<string> {
    const submit = await this.adapters.profile.button('提交');
    await this.adapters.button.click(submit, { text: '提交', actionType: 'click' });
    await this.page.waitForTimeout(2_500);
    return this.readToast();
  }

  async audit(documentNo: string): Promise<{ toast: string; row: Record<string, string> | null }> {
    await this.filterByDocumentNo(documentNo);
    await this.masterData.openRowAction('po_doc_no', documentNo, '审核');
    await this.page.waitForTimeout(1_500);
    const modal = this.page.locator('.rc-dialog-wrap:visible').last();
    if ((await modal.count()) > 0) {
      for (const name of ['确定', '确认']) {
        const button = modal.getByRole('button', { name, exact: true });
        if ((await button.count()) > 0) {
          await button.last().click();
          break;
        }
      }
      await this.page.waitForTimeout(2_500);
    }
    return { toast: await this.readToast(), row: await this.readListRow(documentNo) };
  }

  async closeDetail(): Promise<void> {
    await new ErpTabs(this.page).closeActiveWithDiscard();
    await this.page.waitForTimeout(500);
  }

  async readToast(): Promise<string> {
    return this.masterData.readToast();
  }

  async formItemText(fieldPath: string): Promise<string> {
    return this.page.evaluate((path) => {
      const label = document.querySelector(`label[for="${path}"]`);
      const item = label?.closest('[class*="FormItem-module_form-item__"]');
      if (!item) return '';
      const labelText = (item.querySelector('[class*="form-item-label-text__"]')?.textContent || '').trim();
      return ((item as HTMLElement).innerText || '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(labelText, '')
        .replace(/^[:：]\s*/, '')
        .trim();
    }, fieldPath);
  }

  async inputValue(fieldPath: string): Promise<string> {
    const input = await this.adapters.profile.input(fieldPath);
    return this.adapters.input.read(input);
  }

  detailGrid() {
    return this.adapters.grid({
      rowSelector: '.ag-center-cols-container .ag-row[row-index]',
      cellSelector: '.ag-cell[col-id]',
      headerSelector: '.ag-header-cell[col-id]',
      rowActionSelector: 'button',
      rootSelector: '.ag-root:visible:not(:has(.ag-header-cell[col-id="whse_name"]))',
    });
  }

  private lookupOptions() {
    return {
      modalSelector: ATHENA_SELECTORS.modal,
      rowSelector: '.ag-center-cols-container .ag-row[row-index]',
      filterFieldSelector: '[class*="ConditionRow-module_row-field"] .ath-select',
      filterValueSelector: 'input[placeholder="请输入值"]',
      filterButtonText: '筛选',
      confirmText: '确认',
      cancelText: '取消',
      optionSelector: ATHENA_SELECTORS.dropdownOption,
    };
  }
}
