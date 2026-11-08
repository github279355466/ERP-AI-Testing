import { Page } from '@playwright/test';
import { AdapterSet } from '../../adapters';
import { AthenaConfig } from '../../config/athena-config';
import { PageManager } from '../../browser/page-manager';
import { ATHENA_SELECTORS } from '../../locator/athena-profile';
import { MasterDataActions } from '../../runner/actions/master-data-actions';
import { ErpTabs } from '../../controls/erp-tabs';
import { BasePageObject } from '../base/page-object';

export interface PurchaseReturnHeaderInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docNo: string;
  purchaser: string;
  project: string;
  invoiceType?: string;
  docDate?: string;
}

export class PurchaseReturnPage extends BasePageObject {
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

  async switchTab(name: string): Promise<void> {
    const tab = this.page.locator('[role="tab"]').filter({ hasText: new RegExp(`^${name}$`) }).first();
    await tab.waitFor({ state: 'visible', timeout: this.config.browser.actionTimeoutMs });
    await tab.click();
    await this.page.waitForTimeout(800);
  }

  async selectEnum(fieldPath: string, preferred?: string): Promise<string> {
    const box = await this.page.evaluate((path) => {
      const item = document.querySelector(`label[for="${path}"]`)?.closest('[class*="FormItem-module_form-item__"]');
      const select = item?.querySelector('[class*="Select-module_select__"]') as HTMLElement | null;
      if (!select) return null;
      const rect = select.getBoundingClientRect();
      return { x: rect.x, y: rect.y, w: rect.width, h: rect.height };
    }, fieldPath);
    if (!box) throw new Error(`[ENUM_NOT_FOUND] ${fieldPath}`);
    await this.page.mouse.click(box.x + box.w - 16, box.y + box.h / 2);
    await this.page.waitForTimeout(600);
    const options = this.page.locator('.ath-select-item-option:visible');
    const texts = await options.allInnerTexts();
    if (texts.length === 0) throw new Error(`[ENUM_NO_OPTIONS] ${fieldPath}`);
    const target = preferred ? options.filter({ hasText: preferred }).first() : options.first();
    if ((await target.count()) === 0) {
      throw new Error(`[ENUM_OPTION_NOT_FOUND] ${fieldPath} 期望 ${preferred}；可选=${texts.join(' | ')}`);
    }
    await target.click();
    await this.page.waitForTimeout(600);
    return this.formItemText(fieldPath);
  }

  async ensureHeader(input: PurchaseReturnHeaderInput): Promise<Record<string, string>> {
    await this.selectSearchField('pur_rtn_doc.ops_unit_no', '运营单元编号', input.opsUnit);
    await this.selectSearchField('pur_rtn_doc.biz_type_no', '单别', input.bizType);
    await this.switchTab('财务信息');
    await this.selectSearchField('pur_rtn_doc.stlmt_ops_unit_no', '运营单元编号', input.opsUnit);
    await this.switchTab('业务信息');
    const docNo = await this.adapters.profile.input('pur_rtn_doc.pur_rtn_doc_no');
    const docNoReadonly = await docNo.locator.getAttribute('readonly');
    if (!(await docNo.locator.isDisabled()) && docNoReadonly === null) {
      await this.adapters.input.fill(docNo, input.docNo, '单号');
    }
    await this.selectSearchField('pur_rtn_doc.supp_no', '供应商编号', input.supplier);
    await this.selectSearchField('pur_rtn_doc.purhr_no', '员工编号', input.purchaser);
    await this.selectSearchField('pur_rtn_doc.rtn_ops_unit_no', '运营单元编号', input.opsUnit);
    await this.selectSearchField('pur_rtn_doc.proj_no', '项目编号', input.project);
    if (input.docDate) {
      const date = await this.adapters.profile.input('pur_rtn_doc.doc_date');
      await this.adapters.date.fill(date, input.docDate, {}, '单据日期');
    }
    let invoiceType = await this.formItemText('pur_rtn_doc.tax_inv_type');
    if (!invoiceType.includes('发票')) {
      await this.switchTab('财务信息');
      invoiceType = await this.selectEnum('pur_rtn_doc.tax_inv_type', input.invoiceType);
      await this.switchTab('业务信息');
    }
    return {
      opsUnit: await this.formItemText('pur_rtn_doc.ops_unit_no'),
      supplier: await this.formItemText('pur_rtn_doc.supp_no'),
      bizType: await this.formItemText('pur_rtn_doc.biz_type_no'),
      docNo: await this.inputValue('pur_rtn_doc.pur_rtn_doc_no'),
      purchaser: await this.formItemText('pur_rtn_doc.purhr_no'),
      project: await this.formItemText('pur_rtn_doc.proj_no'),
      rtnOpsUnit: await this.formItemText('pur_rtn_doc.rtn_ops_unit_no'),
      settlementOpsUnit: await this.formItemText('pur_rtn_doc.stlmt_ops_unit_no'),
      invoiceType: await this.formItemText('pur_rtn_doc.tax_inv_type'),
      docDate: await this.inputValue('pur_rtn_doc.doc_date'),
      currency: await this.formItemText('pur_rtn_doc.ccy_no'),
    };
  }

  async takeOrder(sourceDocNo: string, sourceType = '采购订单'): Promise<{ rowCount: number; selectedText: string; toast: string }> {
    const button = this.page.locator('button:visible', { hasText: '取单' }).first();
    await button.waitFor({ state: 'visible', timeout: this.config.browser.actionTimeoutMs });
    await button.click();
    await this.page.waitForTimeout(800);
    const menu = this.page.locator('.more-menu-item').filter({ hasText: sourceType }).first();
    if ((await menu.count()) > 0) {
      await menu.click();
      await this.page.waitForTimeout(2_000);
    }
    const modal = this.page.locator(`${ATHENA_SELECTORS.modal}:visible`).last();
    if ((await modal.count()) === 0) {
      throw new Error('[TAKE_ORDER_DIALOG_NOT_OPENED] 采购退货单取单弹窗未打开');
    }
    const info = await this.adapters.lookup.readInfo(this.takeOrderOptions());
    if (info.rowCount === 0) {
      await this.adapters.lookup.cancel(this.takeOrderOptions());
      throw new Error('[TAKE_ORDER_NO_ROWS] 退货取单弹窗无数据');
    }
    const row = modal.locator(this.takeOrderOptions().rowSelector).filter({ hasText: sourceDocNo }).first();
    if ((await row.count()) === 0) {
      const texts = await modal.locator(this.takeOrderOptions().rowSelector).allInnerTexts();
      await this.adapters.lookup.cancel(this.takeOrderOptions());
      throw new Error(`[TAKE_ORDER_SOURCE_NOT_FOUND] ${sourceDocNo}；可见行=${texts.slice(0, 5).join(' | ')}`);
    }
    const selectedText = (await row.innerText()).replace(/\s+/g, ' ').trim();
    await row.click();
    await this.page.waitForTimeout(500);
    await this.adapters.lookup.confirm(this.takeOrderOptions());
    await this.page.waitForTimeout(1_500);
    return { rowCount: info.rowCount, selectedText, toast: await this.readToast() };
  }

  async enableColumn(label: string): Promise<boolean> {
    const gear = this.page.locator('button:visible:has(use[href="#ath-icon-set-outline"])').last();
    if ((await gear.count()) === 0) return false;
    await gear.click();
    await this.page.waitForTimeout(1_000);
    const search = this.page.locator('input[placeholder="请搜索字段"]:visible').first();
    if ((await search.count()) === 0) return false;
    await search.fill(label);
    await this.page.waitForTimeout(700);
    const handled = await this.page.evaluate((name) => {
      const labels = Array.from(document.querySelectorAll('*')).filter(
        (item) => item.children.length === 0 && (item.textContent || '').trim() === name,
      );
      for (const label of labels) {
        let parent = label.parentElement;
        for (let depth = 0; depth < 7 && parent; depth += 1) {
          const input = parent.querySelector('input.digi-checkbox-input') as HTMLInputElement | null;
          if (input) {
            if (!input.checked) input.click();
            return true;
          }
          parent = parent.parentElement;
        }
      }
      return false;
    }, label);
    const close = this.page.locator('button[aria-label="关闭"]:visible').first();
    if ((await close.count()) > 0) await close.click();
    await this.page.waitForTimeout(800);
    return handled;
  }

  async detailHeaders(): Promise<Array<{ colId: string; label: string }>> {
    return this.detailGrid().headers();
  }

  async scrollToColumn(colId: string): Promise<boolean> {
    const max = await this.page.evaluate(() => {
      const root = Array.from(document.querySelectorAll('.ag-root')).filter(
        (item) => (item as HTMLElement).offsetWidth > 0 && Boolean(item.querySelector('.ag-center-cols-container .ag-row[row-index]')),
      ).pop();
      const viewport = root?.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement | null;
      if (!viewport) return 0;
      viewport.scrollLeft = 0;
      return Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    });
    for (let left = 0; left <= max; left += 500) {
      await this.page.evaluate((value) => {
        const root = Array.from(document.querySelectorAll('.ag-root')).filter(
          (item) => (item as HTMLElement).offsetWidth > 0 && Boolean(item.querySelector('.ag-center-cols-container .ag-row[row-index]')),
        ).pop();
        const viewport = root?.querySelector('.ag-body-horizontal-scroll-viewport') as HTMLElement | null;
        if (viewport) viewport.scrollLeft = value;
      }, left);
      await this.page.waitForTimeout(250);
      const found = await this.page.evaluate(
        (id) => Boolean(document.querySelector(`.ag-header-cell[col-id="${id}"]`)),
        colId,
      );
      if (found) return true;
    }
    return false;
  }

  async setGridLookup(rowIndex: number, colId: string, value: string): Promise<string> {
    const found = await this.scrollToColumn(colId);
    if (!found) throw new Error(`[GRID_COLUMN_NOT_FOUND] ${colId} 未在列配置中启用`);
    const grid = this.detailGrid();
    const cell = await grid.cell(rowIndex, colId);
    await cell.scrollIntoViewIfNeeded().catch(() => undefined);
    await this.page.waitForTimeout(400);
    const box = await cell.boundingBox();
    if (!box) throw new Error(`[GRID_CELL_NOT_VISIBLE] 行 ${rowIndex} 列 ${colId} 无包围盒`);
    await this.page.mouse.click(box.x + Math.min(30, box.width / 3), box.y + box.height / 2);
    await this.page.waitForTimeout(1_200);

    const modal = this.page.locator(`${ATHENA_SELECTORS.modal}:visible`).last();
    if ((await modal.count()) > 0) {
      const info = await this.adapters.lookup.readInfo(this.lookupOptions());
      if (info.rowCount === 0) {
        await this.adapters.lookup.cancel(this.lookupOptions());
        throw new Error(`[GRID_LOOKUP_NO_ROWS] ${colId} 开窗无数据`);
      }
      await this.adapters.lookup.selectRow(this.lookupOptions(), value);
      await this.adapters.lookup.confirm(this.lookupOptions());
      await this.page.waitForTimeout(1_000);
    } else {
      const panel = this.page
        .locator('.ag-root:visible:has(.ag-header-cell[col-id="whse_name"]), .ag-root:visible:has(.ag-header-cell[col-id="stsp_no"])')
        .last();
      const inline = cell.locator('input, textarea').first();
      if ((await panel.count()) > 0) {
        const row = panel.locator('.ag-row[row-index]').filter({ hasText: value }).first();
        if ((await row.count()) === 0) {
          const texts = await panel.locator('.ag-row[row-index]').allInnerTexts();
          await this.page.keyboard.press('Escape');
          throw new Error(`[GRID_LOOKUP_ROW_NOT_FOUND] ${colId}=${value}；可见=${texts.slice(0, 5).join(' | ')}`);
        }
        await row.click();
        await this.page.waitForTimeout(600);
        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(1_200);
      } else if ((await inline.count()) > 0) {
        await inline.fill(value);
        await inline.press('Enter').catch(() => undefined);
        await this.page.waitForTimeout(500);
      } else {
        throw new Error(`[GRID_LOOKUP_NOT_OPENED] 行 ${rowIndex} 列 ${colId} 未打开开窗、浮层或编辑器`);
      }
    }

    const actual = await this.page.evaluate((args) => {
      const root = Array.from(document.querySelectorAll('.ag-root')).filter((item) => (item as HTMLElement).offsetWidth > 0 && Boolean(item.querySelector('.ag-center-cols-container .ag-row[row-index]'))).pop();
      const row = root?.querySelector(`.ag-center-cols-container .ag-row[row-index="${args.rowIndex}"]`);
      const target = row?.querySelector(`.ag-cell[col-id="${args.colId}"]`);
      if (!target) return '';
      const input = target.querySelector('input') as HTMLInputElement | null;
      return (input?.value || target.textContent || '').replace(/\s+/g, ' ').trim();
    }, { rowIndex, colId });
    if (!actual.includes(value)) {
      throw new Error(`[GRID_LOOKUP_POSTCHECK_FAILED] 行 ${rowIndex} 列 ${colId} 期望包含「${value}」，实际「${actual}」`);
    }
    return actual;
  }

  async addDetailRow(): Promise<number> {
    const add = await this.adapters.profile.button('新增');
    return this.detailGrid().addRow(add, 1);
  }

  async selectItem(rowIndex: number, itemNo: string): Promise<string> {
    const grid = this.detailGrid();
    const cell = await grid.cell(rowIndex, 'item_no');
    await cell.scrollIntoViewIfNeeded().catch(() => undefined);
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

  async readDetailLines(): Promise<Array<Record<string, string>>> {
    return this.detailGrid()
      .readRows(['seq', 'goods_type', 'item_no', 'item_spec', 'biz_unit_no', 'biz_qty', 'prc_qty', 'prc_unit_no', 'invnt_unit_no'])
      .then((rows) => rows.map((row) => row.cells));
  }

  async save(): Promise<{ toast: string; documentNo: string; validation: string }> {
    const save = await this.adapters.profile.button('保存');
    await this.adapters.button.click(save, { text: '保存', actionType: 'save' });
    await this.page.waitForTimeout(3_000);
    const toast = await this.readToast();
    const documentNo = await this.inputValue('pur_rtn_doc.pur_rtn_doc_no').catch(() => '');
    const validation = await this.readValidationDrawer();
    return { toast, documentNo, validation };
  }

  async filterByDocumentNo(documentNo: string): Promise<void> {
    await this.masterData.filterBy('采购退货单号', documentNo);
    await this.waitListReady();
  }

  async readListRow(documentNo: string): Promise<Record<string, string> | null> {
    return this.masterData.readRow('pur_rtn_doc_no', documentNo);
  }

  async openExisting(documentNo: string): Promise<void> {
    const target = await this.masterData.openRowAction('pur_rtn_doc_no', documentNo, '查看');
    if (target.ownsPage) throw new Error('[PURCHASE_RETURN_OPENED_IN_NEW_PAGE] 当前页面对象未绑定新窗口');
    await this.page.waitForFunction(
      () => document.querySelectorAll('[class*="FormItem-module_form-item__"]').length > 0,
      undefined,
      { timeout: this.config.browser.readyTimeoutMs },
    );
    await this.page.waitForTimeout(800);
  }

  async readHeader(): Promise<Record<string, string>> {
    return {
      documentNo: await this.inputValue('pur_rtn_doc.pur_rtn_doc_no'),
      opsUnit: await this.formItemText('pur_rtn_doc.ops_unit_no'),
      supplier: await this.formItemText('pur_rtn_doc.supp_no'),
      bizType: await this.formItemText('pur_rtn_doc.biz_type_no'),
      project: await this.formItemText('pur_rtn_doc.proj_no'),
      docDate: await this.inputValue('pur_rtn_doc.doc_date'),
    };
  }

  async submitCurrent(): Promise<string> {
    const submit = await this.adapters.profile.button('提交');
    await this.adapters.button.click(submit, { text: '提交', actionType: 'click' });
    await this.page.waitForTimeout(2_500);
    return this.readToast();
  }

  async audit(documentNo: string): Promise<{ toast: string; row: Record<string, string> | null }> {
    await this.filterByDocumentNo(documentNo);
    await this.masterData.openRowAction('pur_rtn_doc_no', documentNo, '审核');
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
      return ((item as HTMLElement).innerText || '').replace(/\s+/g, ' ').trim().replace(labelText, '').replace(/^[:：]\s*/, '').trim();
    }, fieldPath);
  }

  async inputValue(fieldPath: string): Promise<string> {
    const input = await this.adapters.profile.input(fieldPath);
    return this.adapters.input.read(input);
  }

  async readValidationDrawer(): Promise<string> {
    const drawer = this.page.locator('.rc-dialog-wrap:visible, [class*="Drawer-module"]:visible').last();
    if ((await drawer.count()) === 0) return '';
    const text = (await drawer.innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
    if (!/错误|警告|不可为空|失败/.test(text)) return '';
    return text.slice(0, 2_000);
  }

  detailGrid() {
    return this.adapters.grid({
      rowSelector: '.ag-center-cols-container .ag-row[row-index]',
      cellSelector: '.ag-cell[col-id]',
      headerSelector: '.ag-header-cell[col-id]',
      rowActionSelector: 'button',
      rootSelector: '.ag-root:visible:has(.ag-center-cols-container .ag-row[row-index])',
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

  private takeOrderOptions() {
    return { ...this.lookupOptions(), confirmText: '确定' };
  }
}
