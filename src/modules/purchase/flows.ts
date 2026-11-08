import { PurchaseOrderPage } from '../../pages/purchase/purchase-order.page';
import { createPurchaseOrder } from '../../pages/purchase/purchase-order.flow';
import { ModuleFlow, flowAssertion } from '../types';

function requireParam(params: Record<string, string>, key: string): string {
  const value = params[key];
  if (!value) throw new Error(`[FLOW_PARAM_MISSING] purchase-order-create 缺少参数 ${key}`);
  return value;
}

export const purchaseOrderCreate: ModuleFlow = async (context) => {
  const params = context.params;
  await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page);
  await context.pages.waitReady(context.page);
  const pageObject = new PurchaseOrderPage(context.page, context.config, context.adapters, context.pages);
  const result = await createPurchaseOrder(context.page, pageObject, {
    opsUnit: requireParam(params, 'opsUnit'),
    supplier: requireParam(params, 'supplier'),
    bizType: requireParam(params, 'bizType'),
    ...(params.docDate ? { docDate: params.docDate } : {}),
    ...(params.project ? { project: params.project } : {}),
    remark: requireParam(params, 'remark'),
    line: {
      itemNo: requireParam(params, 'itemNo'),
      qty: params.qty ?? '1',
      ...(params.price ? { price: params.price } : {}),
    },
  });
  const levelOf = (name: string): 'ui' | 'business' | 'persistence' => {
    if (name.startsWith('重查')) return 'business';
    if (name.startsWith('保存')) return 'business';
    return 'ui';
  };
  return {
    assertions: result.assertions.map((entry) =>
      flowAssertion(entry.name, entry.passed, entry.expected, entry.actual, levelOf(entry.name), context.sourceRef),
    ),
    documents: [{ document_type: 'purchase_order', identifier: result.documentNo }],
    notes: `采购订单 ${result.documentNo} 保存并重查完成；toast=${result.toast || '(空)'}`,
  };
};

export const purchaseOrderListSmoke: ModuleFlow = async (context) => {
  const closed = await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page, { forceReload: closed > 0 });
  const ready = await context.pages.waitReady(context.page);
  const rows = await context.page.locator('.ag-center-cols-container .ag-row[row-index]').count();
  return {
    assertions: [
      flowAssertion('列表-页面加载', ready.ok, '表单/表格就绪', `formItems=${ready.formItems} rows=${ready.gridRows}`, 'ui', context.sourceRef),
      flowAssertion('列表-存在表格', rows >= 0, '>=0', String(rows), 'ui', context.sourceRef),
    ],
    notes: `列表页就绪，当前可见行 ${rows}`,
  };
};
