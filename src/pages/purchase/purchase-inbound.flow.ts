import { Page } from '@playwright/test';
import { PurchaseInboundPage } from './purchase-inbound.page';

export interface CreatePurchaseInboundInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docDate?: string;
  sourceDocNo: string;
  expectedItemNo: string;
  expectedQty: string;
  warehouse?: string;
  storageLocation?: string;
}

export interface CreatePurchaseInboundResult {
  header: Record<string, string>;
  takeOrder: { rowCount: number; selectedText: string; toast: string };
  toast: string;
  validation: string;
  documentNo: string;
  listRow: Record<string, string> | null;
  detailHeader: Record<string, string>;
  detailLines: Array<Record<string, string>>;
  assertions: Array<{ name: string; passed: boolean; expected: string; actual: string }>;
}

export async function createPurchaseInbound(
  page: Page,
  inbound: PurchaseInboundPage,
  input: CreatePurchaseInboundInput,
): Promise<CreatePurchaseInboundResult> {
  await inbound.openNew();
  const header = await inbound.ensureHeader({
    opsUnit: input.opsUnit,
    supplier: input.supplier,
    bizType: input.bizType,
    docDate: input.docDate,
  });
  const takeOrder = await inbound.takeOrder(input.sourceDocNo);
  const initialLines = await inbound.readDetailLines();
  for (let index = 0; index < initialLines.length; index += 1) {
    if (input.warehouse) await inbound.setGridLookup(index, 'whse_no', input.warehouse);
    if (input.storageLocation) await inbound.setGridLookup(index, 'stsp_no', input.storageLocation);
  }
  const lines = await inbound.readDetailLines();
  const saved = await inbound.save();
  if (!saved.documentNo) {
    throw new Error(
      `[PURCHASE_INBOUND_NO_DOC_NO] 保存后未取得单据号，toast=${saved.toast || '(空)'}，validation=${saved.validation || '(无)'}`,
    );
  }

  await inbound.closeDetail();
  await inbound.resetToList();
  await inbound.filterByDocumentNo(saved.documentNo);
  const listRow = await inbound.readListRow(saved.documentNo);
  await inbound.openExisting(saved.documentNo);
  const detailHeader = await inbound.readHeader();
  const detailLines = await inbound.readDetailLines();
  await inbound.closeDetail();

  const detailLine = detailLines[0] ?? {};
  const assertions = [
    assertion('表头-运营单元', header.opsUnit.includes(input.opsUnit), input.opsUnit, header.opsUnit),
    assertion('表头-供应商', header.supplier.includes(input.supplier), input.supplier, header.supplier),
    assertion('表头-单别', header.bizType.includes(input.bizType), input.bizType, header.bizType),
    assertion('取单-来源单', takeOrder.selectedText.includes(input.sourceDocNo), input.sourceDocNo, takeOrder.selectedText),
    assertion('取单-带入品号', initialLines.some((line) => (line.item_no ?? '').includes(input.expectedItemNo)), input.expectedItemNo, initialLines[0]?.item_no ?? ''),
    assertion('取单-带入数量', initialLines.some((line) => (line.biz_qty ?? '') === input.expectedQty), input.expectedQty, initialLines[0]?.biz_qty ?? ''),
    assertion('保存-单据号', Boolean(saved.documentNo), '非空', saved.documentNo),
    assertion('重查-列表行', Boolean(listRow), '存在', listRow ? JSON.stringify(listRow) : '不存在'),
    assertion('重查-详情单号', detailHeader.documentNo === saved.documentNo, saved.documentNo, detailHeader.documentNo),
    assertion('重查-详情供应商', detailHeader.supplier.includes(input.supplier), input.supplier, detailHeader.supplier),
    assertion('重查-详情品号', (detailLine.item_no ?? '').includes(input.expectedItemNo), input.expectedItemNo, detailLine.item_no ?? ''),
    assertion('重查-详情数量', detailLine.biz_qty === input.expectedQty, input.expectedQty, detailLine.biz_qty ?? ''),
  ];

  return {
    header,
    takeOrder,
    toast: saved.toast,
    validation: saved.validation,
    documentNo: saved.documentNo,
    listRow,
    detailHeader,
    detailLines,
    assertions,
  };
}

function assertion(name: string, passed: boolean, expected: string, actual: string) {
  return { name, passed, expected, actual };
}
