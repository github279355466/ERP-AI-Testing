import { Page } from '@playwright/test';

export interface RowActionTarget {
  page: Page;
  ownsPage: boolean;
}

export interface DeleteResult {
  dialogText: string;
  toast: string;
}

/**
 * 基础资料作业的通用列表动作：筛选、列表页操作列编辑/查看、二次确认删除。
 * 只负责页面交互，不持有业务断言；调用方决定操作哪个页面与如何回读数据。
 */
export class MasterDataActions {
  constructor(private readonly getPage: () => Page) {}

  async filterBy(field: string, value: string): Promise<void> {
    const page = this.getPage();
    const openPopover = page.locator('[class*="MultiConditionFilter-module_popover-content"]:visible');
    if ((await openPopover.count()) === 0) {
      await page.locator('button:visible', { hasText: '筛选' }).first().click();
    }
    await page.waitForTimeout(700);
    const root = page.locator('[class*="MultiConditionFilter-module_popover-content"]:visible').last();
    const clear = root.locator('button', { hasText: '清空' }).last();
    if ((await clear.count()) > 0) {
      await clear.click().catch(() => undefined);
      await page.waitForTimeout(400);
    }
    const fieldRow = root.locator('[class*="ConditionRow-module_row-field"] .ath-select').first();
    const currentField = ((await fieldRow.innerText().catch(() => '')) ?? '').replace(/\s+/g, ' ').trim();
    if (!currentField.includes(field)) {
      await fieldRow.click();
      await page.waitForTimeout(1_200);
      let option = page
        .locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option:visible', { hasText: field })
        .first();
      if ((await option.count()) === 0) {
        await fieldRow.click().catch(() => undefined);
        await page.waitForTimeout(1_200);
        option = page
          .locator('.ath-select-dropdown:not(.ath-select-dropdown-hidden) .ath-select-item-option:visible', { hasText: field })
          .first();
      }
      if ((await option.count()) === 0) {
        await page.keyboard.press('Escape');
        throw new Error(`[FILTER_FIELD_NOT_FOUND] 筛选字段「${field}」不存在；当前字段=${currentField}`);
      }
      await option.click();
    }
    await page.waitForTimeout(300);
    const input = root.locator('input[placeholder="请输入值"]').first();
    await input.click();
    await input.fill(value);
    await root.locator('button', { hasText: '筛选' }).last().click();
    await page.waitForTimeout(2200);
  }

  async clearFilter(): Promise<void> {
    const page = this.getPage();
    await page.locator('button:visible', { hasText: '筛选' }).first().click();
    await page.waitForTimeout(700);
    const root = page.locator('[class*="MultiConditionFilter-module_popover-content"]').first();
    await root.locator('button', { hasText: '清空' }).last().click();
    await page.waitForTimeout(300);
    await root.locator('button', { hasText: '筛选' }).last().click();
    await page.waitForTimeout(2200);
  }

  async rowIndex(column: string, value: string): Promise<number> {
    return this.getPage().evaluate(
      (args) => {
        const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
        const row = rows.find(
          (item) => (item.querySelector(`.ag-cell[col-id="${args.column}"]`)?.textContent || '').trim() === args.value,
        );
        return row ? Number(row.getAttribute('row-index')) : -1;
      },
      { column, value },
    );
  }

  async readRow(column: string, value: string): Promise<Record<string, string> | null> {
    return this.getPage().evaluate((args) => {
      const rows = Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'));
      const row = rows.find(
        (item) => (item.querySelector(`.ag-cell[col-id="${args.column}"]`)?.textContent || '').trim() === args.value,
      );
      if (!row) return null;
      const index = row.getAttribute('row-index');
      const cells = Array.from(
        document.querySelectorAll(`.ag-row[row-index="${index}"] .ag-cell[col-id]`),
      );
      return Object.fromEntries(
        cells.map((cell) => [cell.getAttribute('col-id') || '', (cell.textContent || '').trim()]),
      );
    }, { column, value });
  }

  /**
   * 点击列表页操作列动作。部分作业的“编辑/查看”会打开独立 /detail 页面，
   * 返回 ownsPage=true 时由调用方在保存后关闭该页面。
   */
  async openRowAction(column: string, value: string, text: string): Promise<RowActionTarget> {
    const page = this.getPage();
    const index = await this.rowIndex(column, value);
    if (index < 0) throw new Error(`未找到目标行: ${column}=${value}`);
    const before = new Set(page.context().pages());
    const row = await this.actionRow(page, index, column);
    await row.locator('button.custom-op-text-btn:visible', { hasText: text }).first().click();
    await page.waitForTimeout(2200);

    const created = page.context().pages().filter((item) => !before.has(item));
    const detail = created.find((item) => item.url().includes('/detail'));
    if (detail) {
      await detail.bringToFront();
      await detail.waitForTimeout(800);
      return { page: detail, ownsPage: true };
    }
    const tab = page.locator('.ant-tabs-tab', { hasText: '详情' }).last();
    if ((await tab.count()) > 0) {
      await tab.click();
      await page.waitForTimeout(800);
    }
    return { page, ownsPage: false };
  }

  /** 点击列表页操作列“删除”，只负责打开二次确认。 */
  async clickDelete(column: string, value: string): Promise<void> {
    const page = this.getPage();
    const index = await this.rowIndex(column, value);
    if (index < 0) throw new Error(`未找到目标行: ${column}=${value}`);
    const row = await this.actionRow(page, index, column);
    await row.locator('button.custom-op-text-btn:visible', { hasText: '删除' }).first().click();
    await page.waitForTimeout(1000);
  }

  private async actionRow(page: Page, index: number, column: string) {
    const root = page.locator(`.ag-root:has(.ag-header-cell[col-id="${column}"])`).first();
    const pinnedRight = root.locator(`.ag-pinned-right-cols-container .ag-row[row-index="${index}"]`).first();
    if ((await pinnedRight.count()) > 0) return pinnedRight;
    return root.locator(`.ag-row[row-index="${index}"]`).last();
  }

  /** 确认当前删除弹窗，返回弹窗文案与操作提示。 */
  async confirmDialog(): Promise<DeleteResult> {
    const page = this.getPage();
    const dialog = page.locator('.rc-dialog:visible').last();
    const dialogText = (await dialog.innerText()).replace(/\s+/g, ' ').trim();
    await dialog.getByRole('button', { name: '确定', exact: true }).click();
    await page.waitForTimeout(2600);
    return { dialogText, toast: await this.readToast() };
  }

  /** 列表页操作列删除 + 二次确认的完整动作。 */
  async deleteRowWithConfirm(column: string, value: string): Promise<DeleteResult> {
    await this.clickDelete(column, value);
    return this.confirmDialog();
  }

  async readToast(): Promise<string> {
    const text = await this.getPage().evaluate(() => document.body.innerText || '');
    const lines = text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    return [...lines].reverse().find((line) => /操作成功|已生成|保存成功|删除成功|不可重复|已被引用|失败|错误/.test(line) && line.length < 120) ?? '';
  }

  async gridRowCount(): Promise<number> {
    return this.getPage().evaluate(
      () => Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]')).filter((row) => (row as HTMLElement).offsetWidth > 0).length,
    );
  }

  async waitRows(minRows: number, timeoutMs = 20000): Promise<number> {
    const page = this.getPage();
    const started = Date.now();
    let count = 0;
    while (Date.now() - started < timeoutMs) {
      count = await this.gridRowCount();
      if (count >= minRows) return count;
      await page.waitForTimeout(300);
    }
    return count;
  }
}
