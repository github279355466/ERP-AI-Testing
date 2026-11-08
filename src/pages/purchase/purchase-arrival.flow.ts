import { Page } from '@playwright/test';
import { PurchaseArrivalPage } from './purchase-arrival.page';

export interface CreatePurchaseArrivalInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  invoiceType?: string;
  docDate?: string;
  sourceDocNo: string;
  expectedItemNo: string;
  expectedQty: string;
}

export interface CreatePurchaseArrivalResult {
  header: Record<string, string>;
  takeOrder: { dialogTitle: string; rowCount: number; selectedText: string; toast: string };
  toast: string;
  validation: string;
  documentNo: string;
  listRow: Record<string, string> | null;
  detailHeader: Record<string, string>;
  detailLines: Array<Record<string, string>>;
  assertions: Array<{ name: string; passed: boolean; expected: string; actual: string }>;
}

export async function createPurchaseArrival(
  page: Page,
  arrival: PurchaseArrivalPage,
  input: CreatePurchaseArrivalInput,
): Promise<CreatePurchaseArrivalResult> {
  await arrival.openNew();
  const header = await arrival.ensureHeader({
    opsUnit: input.opsUnit,
    supplier: input.supplier,
    bizType: input.bizType,
    invoiceType: input.invoiceType,
    docDate: input.docDate,
  });
  const takeOrder = await arrival.takeOrder(input.sourceDocNo);
  const lines = await arrival.readDetailLines();
  const saved = await arrival.save();
  const documentNo = saved.documentNo;
  if (!documentNo) {
    throw new Error(
      `[PURCHASE_ARRIVAL_NO_DOC_NO] 保存后未取得单据号，toast=${saved.toast || '(空)'}，validation=${saved.validation || '(无)'}`,
    );
  }

  await arrival.closeDetail();
  await arrival.resetToList();
  await arrival.filterByDocumentNo(documentNo);
  const listRow = await arrival.readListRow(documentNo);
  await arrival.openExisting(documentNo);
  const detailHeader = await arrival.readHeader();
  const detailLines = await arrival.readDetailLines();
  await arrival.closeDetail();

  const detailLine = detailLines[0] ?? {};
  const assertions = [
    assertion('表头-运营单元', header.opsUnit.includes(input.opsUnit), input.opsUnit, header.opsUnit),
    assertion('表头-供应商', header.supplier.includes(input.supplier), input.supplier, header.supplier),
    assertion('表头-单别', header.bizType.includes(input.bizType), input.bizType, header.bizType),
    assertion('取单-来源单', takeOrder.selectedText.includes(input.sourceDocNo), input.sourceDocNo, takeOrder.selectedText),
    assertion('取单-带入品号', lines.some((line) => (line.item_no ?? '').includes(input.expectedItemNo)), input.expectedItemNo, lines[0]?.item_no ?? ''),
    assertion('取单-带入数量', lines.some((line) => (line.biz_qty ?? '') === input.expectedQty), input.expectedQty, lines[0]?.biz_qty ?? ''),
    assertion('保存-单据号', Boolean(documentNo), '非空', documentNo),
    assertion('重查-列表行', Boolean(listRow), '存在', listRow ? JSON.stringify(listRow) : '不存在'),
    assertion('重查-详情单号', detailHeader.documentNo === documentNo, documentNo, detailHeader.documentNo),
    assertion('重查-详情供应商', detailHeader.supplier.includes(input.supplier), input.supplier, detailHeader.supplier),
    assertion('重查-详情品号', (detailLine.item_no ?? '').includes(input.expectedItemNo), input.expectedItemNo, detailLine.item_no ?? ''),
    assertion('重查-详情数量', detailLine.biz_qty === input.expectedQty, input.expectedQty, detailLine.biz_qty ?? ''),
  ];

  return {
    header,
    takeOrder,
    toast: saved.toast,
    validation: saved.validation,
    documentNo,
    listRow,
    detailHeader,
    detailLines,
    assertions,
  };
}

function assertion(name: string, passed: boolean, expected: string, actual: string) {
  return { name, passed, expected, actual };
}
