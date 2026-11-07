import { Locator, Page } from '@playwright/test';
import { gridCellSelector, SELECTORS } from '../locator/selectors';

export interface GridHeader {
  colId: string;
  label: string;
}

export interface GridRowData {
  rowIndex: number;
  rowId: string | null;
  cells: Record<string, string>;
}

export class ErpGrid {
  constructor(private readonly page: Page) {}

  async headers(): Promise<GridHeader[]> {
    return this.page.evaluate((selector) => {
      return Array.from(document.querySelectorAll(selector))
        .filter((cell) => (cell as HTMLElement).offsetWidth > 0)
        .map((cell) => ({
          colId: cell.getAttribute('col-id') ?? '',
          label: (cell.textContent ?? '').trim(),
        }))
        .filter((item) => item.colId);
    }, SELECTORS.grid.header);
  }

  async rowCount(): Promise<number> {
    return this.page.evaluate(() => {
      const indexes = new Set(
        Array.from(document.querySelectorAll('.ag-center-cols-container .ag-row[row-index]'))
          .filter((row) => (row as HTMLElement).offsetWidth > 0)
          .map((row) => row.getAttribute('row-index')),
      );
      return indexes.size;
    });
  }

  async row(rowIndex: number): Promise<Locator> {
    return this.page.locator(`${SELECTORS.grid.centerRows}[row-index="${rowIndex}"]`).first();
  }

  async cellText(rowIndex: number, colId: string): Promise<string> {
    const cell = this.page.locator(`${SELECTORS.grid.centerRows}[row-index="${rowIndex}"] ${gridCellSelector(colId)}`).first();
    return (await cell.textContent())?.trim() ?? '';
  }

  async readRows(colIds?: string[]): Promise<GridRowData[]> {
    return this.page.evaluate(
      (args) => {
        const rows = Array.from(document.querySelectorAll(args.rowSelector)).filter(
          (row) => (row as HTMLElement).offsetWidth > 0,
        );
        return rows.map((row) => {
          const cells: Record<string, string> = {};
          Array.from(row.querySelectorAll('.ag-cell[col-id]')).forEach((cell) => {
            const colId = cell.getAttribute('col-id') ?? '';
            if (colId && (!args.colIds || args.colIds.includes(colId))) {
              cells[colId] = (cell.textContent ?? '').trim();
            }
          });
          return {
            rowIndex: Number(row.getAttribute('row-index')),
            rowId: row.getAttribute('row-id'),
            cells,
          };
        });
      },
      { rowSelector: SELECTORS.grid.centerRows, colIds },
    );
  }

  async waitForRows(minRows = 1, timeoutMs = 20000): Promise<boolean> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      if ((await this.rowCount()) >= minRows) return true;
      await this.page.waitForTimeout(250);
    }
    return false;
  }

  async clickRowAction(rowIndex: number, actionText: string): Promise<void> {
    const row = await this.row(rowIndex);
    const button = row.locator(SELECTORS.buttons.rowAction, { hasText: actionText }).first();
    if ((await button.count()) === 0) {
      throw new Error(`第 ${rowIndex} 行没有操作按钮: ${actionText}`);
    }
    await button.click({ timeout: 10000 });
  }

  async footerText(): Promise<string> {
    return this.page.evaluate(() => {
      const text = document.body.innerText || '';
      const match = text.match(/共\s*\d+\s*条[\s\S]{0,40}/);
      return match ? match[0].replace(/\s+/g, ' ').trim() : '';
    });
  }
}
