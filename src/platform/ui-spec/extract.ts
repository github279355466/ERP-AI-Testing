import { Page } from '@playwright/test';
import { DetailObservation, FieldObservation, ListObservation, LookupProbe } from './types';

export async function extractList(page: Page): Promise<ListObservation> {
  await page
    .waitForFunction(() => document.querySelectorAll('.ag-header-cell').length > 0, undefined, { timeout: 30_000 })
    .catch(() => undefined);
  return page.evaluate(async () => {
    const isVisible = (el: Element): boolean => {
      const rect = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
    };
    const normalize = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').replace(/^\*+\s*/, '').replace(/\s*\*+$/, '').trim();

    const tabContainer = Array.from(document.querySelectorAll('._formdesigner_custom_tabs')).find(isVisible);
    const tabs = tabContainer
      ? Array.from(tabContainer.children).map((child) => normalize(child.textContent)).filter(Boolean)
      : [];

    const seen = new Set<string>();
    const headerContainers: Array<['left' | 'center' | 'right', Element | null]> = [
      ['left', document.querySelector('.ag-pinned-left-header')],
      ['center', document.querySelector('.ag-header-container')],
      ['right', document.querySelector('.ag-pinned-right-header')],
    ];
    const headers: Array<{ id: string; text: string; pinned: 'left' | 'center' | 'right' }> = [];
    for (const [pinned, container] of headerContainers) {
      if (!container) continue;
      for (const cell of Array.from(container.querySelectorAll('.ag-header-cell'))) {
        if (!isVisible(cell)) continue;
        const id = cell.getAttribute('col-id') ?? '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        headers.push({ id, text: normalize((cell as HTMLElement).innerText), pinned });
      }
    }

    const statusHeader = headers.find((header) => header.text === '状态');
    const operateHeader = headers.find((header) => header.text === '操作');
    const rows = Array.from(document.querySelectorAll('.ag-pinned-right-cols-container .ag-row'))
      .filter(isVisible)
      .map((row) => {
        const statusCell = statusHeader ? row.querySelector(`[col-id="${statusHeader.id}"]`) : null;
        const operateCell = operateHeader ? row.querySelector(`[col-id="${operateHeader.id}"]`) : null;
        const status = normalize(statusCell ? (statusCell as HTMLElement).innerText : '');
        const leaf = statusCell
          ? Array.from(statusCell.querySelectorAll('*')).find(
              (element) => element.children.length === 0 && (element.textContent ?? '').trim() === status,
            )
          : null;
        const statusColor = leaf
          ? getComputedStyle(leaf).color
          : statusCell
            ? getComputedStyle(statusCell as Element).color
            : '';
        const actions = (operateCell ? (operateCell as HTMLElement).innerText : '')
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter((item) => item && item !== '...' && item !== '…');
        return { status, statusColor, actions };
      })
      .filter((row) => row.status !== '');

    const buttonTexts = (): string[] =>
      Array.from(document.querySelectorAll('button'))
        .filter(isVisible)
        .filter((button) => !button.closest('[aria-hidden="true"]'))
        .map((button) => ({ text: normalize((button as HTMLElement).innerText), left: button.getBoundingClientRect().left }))
        .filter((button) => button.text)
        .sort((left, right) => left.left - right.left)
        .map((button) => button.text);

    const before = buttonTexts();
    const checkbox = document.querySelector('.ag-pinned-left-cols-container .ag-row .checkbox-cell input, .ag-pinned-left-cols-container .ag-row .checkbox-cell .ag-checkbox-input');
    if (checkbox) (checkbox as HTMLElement).click();
    await new Promise((resolve) => setTimeout(resolve, 900));
    const after = buttonTexts();
    if (checkbox) (checkbox as HTMLElement).click();

    const batchContainer = document.querySelector('[class*="toolbar-batch"]');
    let batchActions: string[];
    if (batchContainer) {
      batchActions = Array.from(batchContainer.querySelectorAll('button'))
        .filter(isVisible)
        .filter((button) => !button.closest('[aria-hidden="true"]'))
        .map((button) => normalize((button as HTMLElement).innerText))
        .filter(Boolean);
    } else {
      const beforeCount = new Map<string, number>();
      for (const text of before) beforeCount.set(text, (beforeCount.get(text) ?? 0) + 1);
      batchActions = after.filter((text) => {
        const remaining = beforeCount.get(text) ?? 0;
        if (remaining > 0) {
          beforeCount.set(text, remaining - 1);
          return false;
        }
        return true;
      });
    }

    const bodyText = document.body.innerText;
    const selected = /已选\s*\d+\s*条\s*\/\s*共\s*\d+\s*条/.exec(bodyText)?.[0] ?? '';
    const pageSize = /\d+\s*条\/页/.exec(bodyText)?.[0] ?? '';

    return {
      tabs,
      headers,
      batchActions,
      rows,
      rowCount: rows.length,
      paginationText: [selected, pageSize].filter(Boolean).join(' '),
    };
  });
}

export async function extractDetail(page: Page): Promise<DetailObservation> {
  return page.evaluate(async () => {
    const isVisible = (el: Element): boolean => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  };
    const normalize = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').replace(/^\*+\s*/, '').replace(/\s*\*+$/, '').trim();

    const topBlocks = Array.from(document.querySelectorAll('div,section,header'))
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { element, top: rect.top, width: rect.width, height: rect.height, text: (element as HTMLElement).innerText || '' };
      })
      .filter((item) => item.top < 300 && item.height >= 40 && item.height <= 220 && item.width > 600);
    const summaryBanner = Array.from(document.querySelectorAll('.summary-banner-layout, [class*=summary-banner]')).find(isVisible);
    const numberBanner = topBlocks
      .filter((item) => /单号/.test(item.text))
      .sort((left, right) => left.height - right.height)[0];
    const banner = summaryBanner ?? numberBanner?.element ?? null;
    const bannerText = banner ? (banner as HTMLElement).innerText : '';
    const bannerLines = bannerText
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    const totals: string[] = [];
    for (let index = 0; index < bannerLines.length - 1; index += 1) {
      if (/^(-|-?[\d,]+(\.\d+)?)$/.test(bannerLines[index + 1])) totals.push(bannerLines[index]);
    }

    const tabEntries = Array.from(document.querySelectorAll('.rc-tabs-nav-list .rc-tabs-tab'))
      .filter(isVisible)
      .map((tab) => {
        const rect = tab.getBoundingClientRect();
        return { text: normalize((tab as HTMLElement).innerText), top: rect.top, left: rect.left };
      })
      .filter((entry) => entry.text.length > 0);
    const tabLabels = tabEntries.map((entry) => entry.text);
    const panes = Array.from(document.querySelectorAll('.rc-tabs-tabpane')).filter(isVisible);

    const sectionHeaders = Array.from(document.querySelectorAll('[class*=header-title]'))
      .filter(isVisible)
      .filter((header) => !header.closest('.ag-header'))
      .map((header) => {
        const rect = header.getBoundingClientRect();
        return { text: normalize((header as HTMLElement).innerText), top: rect.top, left: rect.left };
      })
      .filter((header) => header.text.length > 0 && header.text.length <= 20);

    const headerGroups: string[] = [];
    const groupEntries = [...sectionHeaders, ...tabEntries]
      .filter((entry) => !/明细$/.test(entry.text))
      .sort((left, right) => left.top - right.top || left.left - right.left);
    for (const entry of groupEntries) {
      if (!headerGroups.includes(entry.text)) headerGroups.push(entry.text);
    }

    const formItems = Array.from(document.querySelectorAll('[class*=FormItem-module_form-item]')).filter(
      (item) => isVisible(item) && !(item.parentElement && item.parentElement.closest('[class*=FormItem-module_form-item]')),
    );

    const fields: FieldObservation[] = formItems.map((item) => {
      const labelText = item.querySelector('[class*=form-item-label-text]');
      const label = normalize(labelText ? (labelText as HTMLElement).innerText : '');
      const required = Boolean(item.querySelector('[class*=label-required]'));
      const control = item.querySelector('[class*=form-item-control]');
      let value = control ? normalize((control as HTMLElement).innerText) : '';
      if (!value) {
        const input = item.querySelector('input, textarea') as HTMLInputElement | null;
        value = input ? normalize(input.value) : '';
      }
      const pane = item.closest('.rc-tabs-tabpane');
      const paneIndex = pane ? panes.indexOf(pane) : -1;
      let group = paneIndex >= 0 && paneIndex < tabLabels.length ? tabLabels[paneIndex] : '';
      if (!group) {
        const rect = item.getBoundingClientRect();
        const previous = [...sectionHeaders]
          .filter((header) => header.top <= rect.top)
          .sort((left, right) => right.top - left.top)[0];
        group = previous ? previous.text : '';
      }
      const isLookup = Boolean(item.querySelector('[class*="WindowSelect-module_windowSelect"], [class*="window-select"]'));
      const box = item.getBoundingClientRect();
      return { label, value, group, required, isLookup, top: box.top, left: box.left };
    });

    fields.sort((left, right) => left.top - right.top || left.left - right.left);

    const gridColumns: string[] = [];
    for (const container of ['.ag-pinned-left-header', '.ag-header-container', '.ag-pinned-right-header']) {
      for (const cell of Array.from(document.querySelectorAll(`${container} .ag-header-cell`))) {
        if (!isVisible(cell)) continue;
        const text = normalize((cell as HTMLElement).innerText);
        if (text) gridColumns.push(text);
      }
    }

    const bottomActions = Array.from(document.querySelectorAll('button'))
      .filter(isVisible)
      .map((button) => {
        const rect = button.getBoundingClientRect();
        return { text: normalize((button as HTMLElement).innerText), top: rect.top, left: rect.left };
      })
      .filter((button) => button.text && button.top > window.innerHeight - 110)
      .sort((left, right) => left.left - right.left)
      .map((button) => button.text);

    const badge = Array.from(document.querySelectorAll('[class*=basic-task-detail__status-tag]')).find(isVisible);

    return {
      banner: { found: Boolean(banner), text: normalize(bannerText) },
      totals,
      headerGroups,
      fields,
      sectionTitles: sectionHeaders.map((header) => header.text),
      gridColumns,
      bottomActions,
      statusBadge: badge ? normalize((badge as HTMLElement).innerText) : '',
      hasSingleNumber: fields.some((field) => field.label === '单号'),
    };
  });
}

export async function detectRenderError(page: Page): Promise<string | null> {
  const info = await page
    .evaluate(() => ({
      text: (document.body ? document.body.innerText : '').slice(0, 400),
      headers: document.querySelectorAll('.ag-header-cell').length,
    }))
    .catch(() => ({ text: '', headers: 0 }));
  const match = /(组件渲染异常[^\n]*|Unexpected Application Error[^\n]*|[\u670d\u52a1\u5668\u9519\u8bef[^\n]*)/.exec(info.text);
  if (match) return match[0].trim();
  if (info.headers === 0) return `页面未渲染出列表（无网格列头）：${info.text.replace(/\s+/g, ' ').slice(0, 80)}`;
  return null;
}

export async function openDetailFromList(page: Page, timeoutMs = 60_000): Promise<Page | null> {
  const context = page.context();
  const before = new Set(context.pages());
  const deadline = Date.now() + 20_000;
  let clicked = false;
  while (Date.now() < deadline && !clicked) {
    clicked = await page.evaluate(() => {
      const rows = Array.from(document.querySelectorAll('.ag-pinned-right-cols-container .ag-row'));
      for (const row of rows) {
        const cell = row.querySelector('[col-id="operate"]');
        if (!cell) continue;
        const target = Array.from(cell.querySelectorAll('button, a')).find((element) => {
          if ((element.textContent ?? '').trim() !== '查看') return false;
          if (element.closest('[aria-hidden="true"]')) return false;
          return element.getBoundingClientRect().width > 0;
        });
        if (target) {
          (target as HTMLElement).click();
          return true;
        }
      }
      return false;
    });
    if (!clicked) await page.waitForTimeout(400);
  }
  if (!clicked) return null;

  const waitDetail = async (candidate: Page): Promise<Page | null> => {
    try {
      await candidate.waitForURL(/\/detail\?/, { timeout: 8_000 });
      return candidate;
    } catch {
      return null;
    }
  };

  const byUrl = await waitDetail(page);
  if (byUrl) {
    await byUrl.waitForFunction(() => document.querySelectorAll('[class*="FormItem-module_form-item"]').length > 0, undefined, {
      timeout: timeoutMs,
    });
    await byUrl.waitForTimeout(800);
    return byUrl;
  }

  const createdDeadline = Date.now() + 10_000;
  while (Date.now() < createdDeadline) {
    const created = context.pages().find((candidate) => !before.has(candidate) && /\/detail\?/.test(candidate.url()));
    if (created) {
      await created.waitForLoadState('domcontentloaded').catch(() => undefined);
      await created
        .waitForFunction(() => document.querySelectorAll('[class*="FormItem-module_form-item"]').length > 0, undefined, { timeout: timeoutMs })
        .catch(() => undefined);
      await created.waitForTimeout(800);
      return created;
    }
    await page.waitForTimeout(300);
  }
  throw new Error('[DETAIL_PAGE_NOT_OPENED] 点击「查看」后未出现详情页');
}

export async function openCreateByUrl(page: Page, workItemCode: string, timeoutMs = 45_000): Promise<boolean> {
  const target = new URL(page.url());
  target.pathname = '/detail';
  target.searchParams.set('pageCode', `${workItemCode}-detail`);
  target.searchParams.set('pageName', '新增');
  target.searchParams.set('targetTreeType', '');
  target.searchParams.set('editStatus', 'create');
  target.searchParams.set('rowValue', '[object Object]');
  target.searchParams.set('componentType', 'view');
  target.searchParams.set('isUniquePage', '0');
  await page.goto(target.toString(), { waitUntil: 'domcontentloaded', timeout: timeoutMs }).catch(() => undefined);
  const loaded = await page
    .waitForFunction(() => document.querySelectorAll('[class*="FormItem-module_form-item"]').length > 5, undefined, { timeout: timeoutMs })
    .then(() => true)
    .catch(() => false);
  if (!loaded) return false;
  await page.waitForTimeout(1500);
  return true;
}

export async function openCreateFromList(page: Page, timeoutMs = 60_000): Promise<Page> {
  const context = page.context();
  const before = new Set(context.pages());
  const deadline = Date.now() + 15_000;
  let clicked = false;
  while (Date.now() < deadline && !clicked) {
    clicked = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll('button')).filter((button) => {
        if (button.closest('[aria-hidden="true"]')) return false;
        if ((button.textContent ?? '').trim() !== '新增') return false;
        const rect = button.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      });
      const target = buttons[0];
      if (!target) return false;
      (target as HTMLElement).click();
      return true;
    });
    if (!clicked) await page.waitForTimeout(400);
  }
  if (!clicked) throw new Error('[CREATE_ENTRY_NOT_FOUND] 列表未找到「新增」入口');

  const waitCreate = async (candidate: Page): Promise<Page | null> => {
    try {
      await candidate.waitForURL(/editStatus=create/, { timeout: 10_000 });
      return candidate;
    } catch {
      return null;
    }
  };

  const byUrl = await waitCreate(page);
  const target =
    byUrl ??
    (await (async () => {
      const waitDeadline = Date.now() + 10_000;
      while (Date.now() < waitDeadline) {
        const created = context.pages().find((candidate) => !before.has(candidate) && /editStatus=create/.test(candidate.url()));
        if (created) return created;
        await page.waitForTimeout(300);
      }
      return null;
    })());

  if (!target) throw new Error('[CREATE_PAGE_NOT_OPENED] 点击「新增」后未出现新增表单');
  await target.waitForLoadState('domcontentloaded').catch(() => undefined);
  await target
    .waitForFunction(() => document.querySelectorAll('[class*="FormItem-module_form-item"]').length > 0, undefined, { timeout: timeoutMs })
    .catch(() => undefined);
  await target.waitForTimeout(1000);
  return target;
}

export interface LookupProbeTarget {
  label: string;
  nameKeyword: string;
  codeKeyword: string;
}

async function readLookupResultCount(page: Page): Promise<number> {
  const panels = page.locator('.ath-select-dropdown:visible');
  const count = await panels.count().catch(() => 0);
  let best = 0;
  for (let index = 0; index < count; index += 1) {
    const panel = panels.nth(index);
    const rows = await panel.locator('.ag-row').count().catch(() => 0);
    if (rows > best) best = rows;
    if (rows > 0) continue;
    const text = await panel.innerText().catch(() => '');
    const match = /共\s*(\d+)\s*条/.exec(text);
    if (match && Number(match[1]) > best) best = Number(match[1]);
  }
  return best;
}

async function selectFirstLookupOption(page: Page): Promise<boolean> {
  const panels = page.locator('.ath-select-dropdown:visible');
  const count = await panels.count().catch(() => 0);
  for (let index = 0; index < count; index += 1) {
    const rows = panels.nth(index).locator('.ag-row');
    if ((await rows.count().catch(() => 0)) > 0) {
      await rows.first().click({ timeout: 3_000 }).catch(() => undefined);
      await page.waitForTimeout(700);
      return true;
    }
  }
  return false;
}

export async function probeLookupFields(page: Page, targets: LookupProbeTarget[], maxFields = 3): Promise<LookupProbe[]> {
  const probes: LookupProbe[] = [];
  for (const [index, target] of targets.slice(0, maxFields).entries()) {
    const marker = `probe${index}`;
    let found = false;
    const findDeadline = Date.now() + 10_000;
    while (!found && Date.now() < findDeadline) {
      found = await page
      .evaluate((payload: { label: string; marker: string }) => {
        const items = Array.from(document.querySelectorAll('[class*="FormItem-module_form-item"]')).filter((item) => {
          if (item.getBoundingClientRect().height === 0) return false;
          if (!item.querySelector('input')) return false;
          const labelEl = item.querySelector('[class*="form-item-label-text"]');
          return ((labelEl ? labelEl.textContent : '') ?? '').trim() === payload.label;
        });
        items.sort((left, right) => {
          const a = left.getBoundingClientRect();
          const b = right.getBoundingClientRect();
          return a.width * a.height - b.width * b.height;
        });
        const match = items[0];
        if (!match) return false;
        match.setAttribute('data-ui-probe', payload.marker);
        return true;
      }, { label: target.label, marker })
      .catch(() => false);
      if (!found) await page.waitForTimeout(500);
    }

    const probe: LookupProbe = {
      label: target.label,
      keyword: target.codeKeyword,
      found: Boolean(found),
      editable: false,
      fuzzy: false,
      resultCount: 0,
    };

    if (found) {
      const input = page.locator(`[data-ui-probe="${marker}"] input`).first();
      probe.editable = await input.isEditable().catch(() => false);
      if (probe.editable) {
        await input.click({ timeout: 5_000 }).catch(() => undefined);
        await input.fill('').catch(() => undefined);
        await page.waitForTimeout(1200);
        const baseCount = await readLookupResultCount(page);
        if (baseCount === 0) {
          probe.skippedReason = '无候选数据（可能依赖未满足）';
        } else {
          await input.pressSequentially(target.codeKeyword, { delay: 60 }).catch(() => undefined);
          await page.waitForTimeout(1800);
          probe.resultCount = await readLookupResultCount(page);
          probe.fuzzy = probe.resultCount > 0;
          const selected = await selectFirstLookupOption(page);
          if (!selected) {
            await page.keyboard.press('Enter').catch(() => undefined);
          }
          await page.waitForTimeout(800);
        }
      }
    }

    probes.push(probe);
  }
  return probes;
}
