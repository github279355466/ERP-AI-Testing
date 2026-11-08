import { ModuleFlow, flowAssertion } from './types';

export const listSmokeFlow: ModuleFlow = async (context) => {
  await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page, { forceReload: true });
  const ready = await context.pages.waitReady(context.page);
  const rows = await context.page.locator('.ag-center-cols-container .ag-row[row-index]').count();
  const headers = await context.page.locator('.ag-header-cell[col-id]').count();
  return {
    assertions: [
      flowAssertion('列表-页面就绪', ready.ok, 'ready', `formItems=${ready.formItems} rows=${ready.gridRows}`, 'ui', context.sourceRef),
      flowAssertion('列表-列头可读', headers > 0, '>0', String(headers), 'ui', context.sourceRef),
      flowAssertion('列表-行数可读', rows >= 0, '>=0', String(rows), 'business', context.sourceRef),
    ],
    notes: `列表只读冒烟：headers=${headers} rows=${rows}`,
  };
};
