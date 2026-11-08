import { Locator, Page } from '@playwright/test';
import { LocatorCandidate, LocatorResolver, ResolvedControl } from './strategy';

export const ATHENA_SELECTORS = {
  formItem: '[class*="FormItem-module_form-item__"]',
  dropdownRoot: '[class*="Select-module_select__"]',
  dropdownOverlay: '.ath-select-dropdown',
  dropdownOption: '.ath-select-item-option',
  dropdownSelected: '.ath-select-item-option-selected',
  lookupRoot: '[class*="WindowSelect-module_windowSelect"]',
  modal: '.rc-dialog-wrap',
  modalDialog: '.rc-dialog',
  gridRow: '.ag-center-cols-container .ag-row[row-index]',
  gridCell: '.ag-cell[col-id]',
  gridHeader: '.ag-header-cell[col-id]',
  tabs: '.ant-tabs-tab',
  tabActive: '.ant-tabs-tab-active',
  tabRemove: '.ant-tabs-tab-remove',
  treeRoot: '.ant-tree',
  treeNode: '.ant-tree-treenode',
  treeSwitcher: '.ant-tree-switcher',
} as const;

/**
 * Athena ERP 专用定位知识。通用适配器不直接依赖这些 class；
 * 页面对象通过本 profile 生成 ResolvedControl，并记录定位策略。
 */
export class AthenaProfile {
  private readonly resolver: LocatorResolver;

  constructor(private readonly page: Page) {
    this.resolver = new LocatorResolver(page);
  }

  async formItem(fieldPath: string): Promise<ResolvedControl> {
    const label = this.page.locator(`label[for="${fieldPath}"]:visible`).first();
    return LocatorResolver.fromLocator(
      label.locator(`xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]`),
      `label[for="${fieldPath}"] -> form-item`,
    );
  }

  async input(fieldPath: string): Promise<ResolvedControl> {
    const item = await this.formItem(fieldPath);
    return LocatorResolver.fromLocator(
      item.locator.locator('input, textarea').first(),
      `${item.strategy} -> input`,
    );
  }

  async dropdown(fieldPath: string): Promise<ResolvedControl> {
    const item = await this.formItem(fieldPath);
    return LocatorResolver.fromLocator(
      item.locator.locator(ATHENA_SELECTORS.dropdownRoot).first(),
      `${item.strategy} -> dropdown`,
    );
  }

  async lookup(fieldPath: string): Promise<ResolvedControl> {
    const item = await this.formItem(fieldPath);
    return LocatorResolver.fromLocator(
      item.locator.locator(ATHENA_SELECTORS.lookupRoot).first(),
      `${item.strategy} -> lookup`,
    );
  }

  async button(text: string): Promise<ResolvedControl> {
    return this.resolver.resolve([
      { kind: 'role', value: 'button', name: text, exact: true },
      { kind: 'text', value: text, exact: true },
      { kind: 'css', value: `button:has-text("${escapeCss(text)}")` },
    ]);
  }

  async modal(): Promise<ResolvedControl> {
    return this.resolver.resolve([{ kind: 'css', value: `${ATHENA_SELECTORS.modal}:visible` }]);
  }

  async grid(): Promise<ResolvedControl> {
    return this.resolver.resolve([{ kind: 'css', value: '.ag-root' }]);
  }

  async tabs(): Promise<ResolvedControl> {
    return this.resolver.resolve([{ kind: 'css', value: ATHENA_SELECTORS.tabs }]);
  }

  async tree(): Promise<ResolvedControl> {
    return this.resolver.resolve([{ kind: 'css', value: ATHENA_SELECTORS.treeRoot }]);
  }

  async resolve(candidates: LocatorCandidate[]): Promise<ResolvedControl> {
    return this.resolver.resolve(candidates);
  }

  raw(): LocatorResolver {
    return this.resolver;
  }

  get pageRef(): Page {
    return this.page;
  }
}

export function formItemLocator(page: Page, fieldPath: string): Locator {
  return page
    .locator(`label[for="${fieldPath}"]:visible`)
    .first()
    .locator(`xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]`);
}

function escapeCss(value: string): string {
  return value.replace(/"/g, '\\"');
}
