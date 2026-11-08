import { Locator } from '@playwright/test';
import { ResolvedControl } from '../locator/strategy';
import { BaseAdapter } from './base/base-adapter';

export interface GridOptions {
  rowSelector: string;
  cellSelector: string;
  headerSelector: string;
  rowActionSelector?: string;
  rootSelector?: string;
}

export interface GridRowData {
  rowIndex: number;
  cells: Record<string, string>;
}

export class GridAdapter extends BaseAdapter {
  constructor(
    ctx: import('./base/adapter-context').AdapterContext,
    private readonly options: GridOptions,
  ) {
    super(ctx);
  }

  async headers(): Promise<Array<{ colId: string; label: string }>> {
    return this.root().evaluate((root, selector) => {
      return Array.from(root.querySelectorAll(selector))
        .filter((cell) => (cell as HTMLElement).offsetWidth > 0)
        .map((cell) => ({
          colId: cell.getAttribute('col-id') ?? '',
          label: (cell.textContent ?? '').trim(),
        }))
        .filter((item) => item.colId);
    }, this.options.headerSelector);
  }

  async rowCount(): Promise<number> {
    return this.root().evaluate((root, selector) => {
      return Array.from(root.querySelectorAll(selector)).filter(
        (row) => (row as HTMLElement).offsetWidth > 0,
      ).length;
    }, this.options.rowSelector);
  }

  async waitForRows(minRows: number, timeoutMs = 20_000): Promise<number> {
    const deadline = Date.now() + timeoutMs;
    let count = 0;
    while (Date.now() < deadline) {
      count = await this.rowCount();
      if (count >= minRows) return count;
      await this.ctx.page.waitForTimeout(300);
    }
    return count;
  }

  async row(rowIndex: number): Promise<Locator> {
    return this.root().locator(`${this.options.rowSelector}[row-index="${rowIndex}"]`).first();
  }

  async cell(rowIndex: number, colId: string): Promise<Locator> {
    return this.root()
      .locator(`${this.options.rowSelector}[row-index="${rowIndex}"] ${this.options.cellSelector}[col-id="${colId}"]`)
      .first();
  }

  async cellText(rowIndex: number, colId: string): Promise<string> {
    return ((await (await this.cell(rowIndex, colId)).innerText().catch(() => '')) ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async readRows(colIds?: string[]): Promise<GridRowData[]> {
    return this.root().evaluate(
      (root, args: { rowSelector: string; cellSelector: string; colIds?: string[] }) => {
        const rows = Array.from(root.querySelectorAll(args.rowSelector)).filter(
          (row) => (row as HTMLElement).offsetWidth > 0,
        );
        return rows.map((row) => {
          const cells: Record<string, string> = {};
          Array.from(row.querySelectorAll(args.cellSelector)).forEach((cell) => {
            const colId = cell.getAttribute('col-id') ?? '';
            if (colId && (!args.colIds || args.colIds.includes(colId))) {
              cells[colId] = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
            }
          });
          return { rowIndex: Number(row.getAttribute('row-index')), cells };
        });
      },
      { rowSelector: this.options.rowSelector, cellSelector: this.options.cellSelector, colIds },
    );
  }

  async setCell(rowIndex: number, colId: string, value: string): Promise<string> {
    this.ensurePolicy('fill');
    const cell = await this.cell(rowIndex, colId);
    await cell.dblclick({ timeout: this.ctx.timeoutMs });
    await this.settle(300);
    const editor = cell.locator('input, textarea').first();
    if ((await editor.count()) === 0) {
      throw new Error(`[GRID_EDITOR_NOT_FOUND] 行 ${rowIndex} 列 ${colId} 未进入编辑态`);
    }
    await editor.fill(value, { timeout: this.ctx.timeoutMs });
    await editor.press('Enter').catch(() => undefined);
    await this.settle(500);
    const actual = await this.cellText(rowIndex, colId);
    if (!actual.includes(value)) {
      throw new Error(`[GRID_POSTCHECK_FAILED] 行 ${rowIndex} 列 ${colId} 期望包含「${value}」，实际「${actual}」`);
    }
    return actual;
  }

  async clickRowAction(rowIndex: number, actionText: string): Promise<void> {
    const row = await this.row(rowIndex);
    const selector = this.options.rowActionSelector ?? 'button';
    const button = row.locator(selector, { hasText: actionText }).first();
    if ((await button.count()) === 0) {
      throw new Error(`[GRID_ROW_ACTION_NOT_FOUND] 行 ${rowIndex} 没有操作「${actionText}」`);
    }
    this.ensurePolicy('row-action', actionText);
    await button.click({ timeout: this.ctx.timeoutMs });
    await this.settle(600);
  }

  async addRow(button: ResolvedControl, expectedMinRows?: number): Promise<number> {
    this.ensurePolicy('new');
    await this.click(button, { actionType: 'new', boxFallback: false });
    await this.settle(600);
    const count = await this.rowCount();
    if (typeof expectedMinRows === 'number' && count < expectedMinRows) {
      throw new Error(`[GRID_ROW_COUNT_UNEXPECTED] 期望至少 ${expectedMinRows} 行，实际 ${count}`);
    }
    return count;
  }

  async deleteRow(rowIndex: number, actionText = '删除'): Promise<void> {
    this.ensurePolicy('delete', actionText);
    await this.clickRowAction(rowIndex, actionText);
  }

  private root(): Locator {
    return this.options.rootSelector
      ? this.ctx.page.locator(this.options.rootSelector).first()
      : this.ctx.page.locator('.ag-root').first();
  }
}
