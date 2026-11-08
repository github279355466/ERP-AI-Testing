import { Page } from '@playwright/test';
import { PurchaseOrderPage, PurchaseOrderLineInput } from './purchase-order.page';

export interface CreatePurchaseOrderInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docDate?: string;
  project?: string;
  remark: string;
  line: PurchaseOrderLineInput;
}

export interface CreatePurchaseOrderResult {
  header: Record<string, string>;
  line: Record<string, string>;
  toast: string;
  documentNo: string;
  listRow: Record<string, string> | null;
  detailHeader: Record<string, string>;
  detailLines: Array<Record<string, string>>;
  assertions: Array<{ name: string; passed: boolean; expected: string; actual: string }>;
}

export async function createPurchaseOrder(
  page: Page,
  po: PurchaseOrderPage,
  input: CreatePurchaseOrderInput,
): Promise<CreatePurchaseOrderResult> {
  await po.openNew();
  const header = await po.ensureHeader({
    opsUnit: input.opsUnit,
    supplier: input.supplier,
    bizType: input.bizType,
    docDate: input.docDate,
    project: input.project,
  });
  await po.fillRemark(input.remark);

  await po.addDetailRow();
  const line = await po.setLine(0, input.line);
  const saved = await po.save();
  const documentNo = saved.documentNo || extractDocumentNo(saved.toast);
  if (!documentNo) {
    throw new Error(`[PURCHASE_ORDER_NO_DOC_NO] 保存后未取得单据号，toast=${saved.toast || '(空)'}`);
  }

  await po.closeDetail();
  await po.resetToList();
  await po.filterByDocumentNo(documentNo);
  const listRow = await po.readListRow(documentNo);
  await po.openExisting(documentNo);
  const detailHeader = await po.readHeader();
  const detailLines = await po.readDetailLines();
  await po.closeDetail();
  const detailLine = detailLines[0] ?? {};

  const assertions = [
    assertion('表头-运营单元', header.opsUnit.includes(input.opsUnit), input.opsUnit, header.opsUnit),
    assertion('表头-供应商', header.supplier.includes(input.supplier), input.supplier, header.supplier),
    assertion('表头-单别', header.bizType.includes(input.bizType), input.bizType, header.bizType),
    assertion('明细-品号', line.item_no?.includes(input.line.itemNo) ?? false, input.line.itemNo, line.item_no ?? ''),
    assertion('明细-数量', line.biz_qty === input.line.qty, input.line.qty, line.biz_qty ?? ''),
    assertion(
      '明细-单价',
      input.line.price ? line.price === input.line.price : true,
      input.line.price ?? '(未设置)',
      line.price ?? '',
    ),
    assertion('保存-单据号', Boolean(documentNo), '非空', documentNo),
    assertion('重查-列表行', Boolean(listRow), '存在', listRow ? JSON.stringify(listRow) : '不存在'),
    assertion('重查-详情单号', detailHeader.documentNo === documentNo, documentNo, detailHeader.documentNo),
    assertion('重查-详情运营单元', detailHeader.opsUnit.includes(input.opsUnit), input.opsUnit, detailHeader.opsUnit),
    assertion('重查-详情供应商', detailHeader.supplier.includes(input.supplier), input.supplier, detailHeader.supplier),
    assertion('重查-详情品号', detailLine.item_no?.includes(input.line.itemNo) ?? false, input.line.itemNo, detailLine.item_no ?? ''),
    assertion('重查-详情数量', detailLine.biz_qty === input.line.qty, input.line.qty, detailLine.biz_qty ?? ''),
    assertion(
      '重查-详情单价',
      input.line.price ? detailLine.price === input.line.price : true,
      input.line.price ?? '(未设置)',
      detailLine.price ?? '',
    ),
  ];

  return {
    header,
    line,
    toast: saved.toast,
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

function extractDocumentNo(text: string): string {
  const matches = text.match(/[A-Za-z0-9_]+-\d{8,}/g);
  return matches?.[0] ?? '';
}
