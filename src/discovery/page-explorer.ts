import type { Page } from '@playwright/test';
import { ErpForm, FormFieldInfo } from '../controls/erp-form';
import { ErpGrid, GridHeader, GridRowData } from '../controls/erp-grid';
import { ErpModal, ModalInfo } from '../controls/erp-modal';
import { ErpTabs } from '../controls/erp-tabs';
import { redactSecrets } from '../evidence/evidence-manager';

export interface MenuNode {
  id: string;
  text: string;
  level: number;
  children: MenuNode[];
}

export interface PageSnapshot {
  url: string;
  title: string;
  capturedAt: string;
  fields: FormFieldInfo[];
  grid: {
    headers: GridHeader[];
    rowCount: number;
    sampleRows: GridRowData[];
  };
  tabs: string[];
  buttons: string[];
  modal: ModalInfo | null;
  menu: MenuNode[] | null;
}

export interface CandidatePageEntry {
  id: string;
  name: string;
  type: 'lowcode-list' | 'portal' | 'unknown';
  status: 'candidate';
  source: 'dom';
  verifiedAt: string;
  menuPath: string[];
  workItemCode?: string;
  entity?: string;
  fields: Array<{ name: string; label: string; type: string; isKey?: string; componentType: string }>;
  notes: string[];
}

export async function explorePage(page: Page): Promise<PageSnapshot> {
  const form = new ErpForm(page);
  const grid = new ErpGrid(page);
  const tabs = new ErpTabs(page);
  const modal = new ErpModal(page);

  const fields = await form.listFields();
  const headers = await grid.headers();
  const rowCount = await grid.rowCount();
  const sampleRows = rowCount > 0 ? await grid.readRows(headers.map((header) => header.colId).slice(0, 8)) : [];
  const tabTitles = await tabs.list();

  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button'))
      .filter((button) => (button as HTMLElement).offsetWidth > 0)
      .map((button) => (button.textContent ?? '').trim())
      .filter(Boolean)
      .slice(0, 30);
  });

  const menu = await page.evaluate((selector) => {
    const root = document.querySelector(selector);
    if (!root) return null;
    const read = (li: Element): any => {
      const content = li.querySelector(':scope > .menu-content') || li.querySelector(':scope > .ant-menu-submenu-title .menu-content');
      const sub = li.querySelector(':scope > .ant-menu-sub > ul');
      const levelClass = Array.from(li.classList).find((item) => /^level-\d+$/.test(item)) ?? '';
      return {
        id: content?.id ?? '',
        text: (content?.textContent ?? '').trim().replace(/\s+/g, ' '),
        level: Number(levelClass.replace('level-', '') || 0),
        children: sub ? Array.from(sub.children).filter((child) => child.tagName === 'LI').map((child) => read(child)) : [],
      };
    };
    return Array.from(root.children).filter((child) => child.tagName === 'LI').map((child) => read(child));
  }, 'ul.menu-list');

  return {
    url: redactSecrets(page.url()),
    title: await page.title(),
    capturedAt: new Date().toISOString(),
    fields,
    grid: { headers, rowCount, sampleRows },
    tabs: tabTitles,
    buttons,
    modal: await modal.read(),
    menu,
  };
}

export function toCandidateEntry(
  snapshot: PageSnapshot,
  options: { id: string; menuPath: string[]; workItemCode?: string; entity?: string; type?: CandidatePageEntry['type'] },
): CandidatePageEntry {
  const entity = options.entity ?? inferEntity(snapshot.fields);
  return {
    id: options.id,
    name: snapshot.title || options.id,
    type: options.type ?? (snapshot.grid.headers.length > 0 ? 'lowcode-list' : 'unknown'),
    status: 'candidate',
    source: 'dom',
    verifiedAt: snapshot.capturedAt.slice(0, 10),
    menuPath: options.menuPath,
    workItemCode: options.workItemCode,
    entity,
    fields: snapshot.fields
      .filter((field) => field.fieldPath)
      .map((field) => ({
        name: field.fieldPath!.split('.').slice(1).join('.'),
        label: field.label,
        type: field.kind,
        componentType: field.kind,
      })),
    notes: [
      '由页面探索自动生成，需人工确认后升级为 confirmed',
      ...((options.type ?? (snapshot.grid.headers.length > 0 ? 'lowcode-list' : 'unknown')) === 'lowcode-list' && snapshot.grid.rowCount === 0
        ? ['未观察到数据行，可能是空列表或加载未完成']
        : []),
    ],
  };
}

function inferEntity(fields: FormFieldInfo[]): string | undefined {
  const withPath = fields.find((field) => field.fieldPath);
  return withPath?.fieldPath?.split('.')[0];
}
