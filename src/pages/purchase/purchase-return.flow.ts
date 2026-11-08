import { Page } from '@playwright/test';
import { PurchaseReturnPage } from './purchase-return.page';

export interface CreatePurchaseReturnInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docNo: string;
  purchaser: string;
  project: string;
  invoiceType?: string;
  docDate?: string;
  sourceDocNo?: string;
  itemNo: string;
  qty: string;
  warehouse?: string;
}

export interface CreatePurchaseReturnResult {
  header: Record<string, string>;
  takeOrder: { rowCount: number; selectedText: string; toast: string } | null;
  takeOrderError: string;
  toast: string;
  validation: string;
  listRow: Record<string, string> | null;
  detailHeader: Record<string, string>;
  detailLines: Array<Record<string, string>>;
  assertions: Array<{ name: string; passed: boolean; expected: string; actual: string }>;
}

export async function createPurchaseReturn(
  page: Page,
  ret: PurchaseReturnPage,
  input: CreatePurchaseReturnInput,
): Promise<CreatePurchaseReturnResult> {
  await ret.openNew();
  const header = await ret.ensureHeader({
    opsUnit: input.opsUnit,
    supplier: input.supplier,
    bizType: input.bizType,
    docNo: input.docNo,
    purchaser: input.purchaser,
    project: input.project,
    invoiceType: input.invoiceType,
    docDate: input.docDate,
  });

  let takeOrder: CreatePurchaseReturnResult['takeOrder'] = null;
  let takeOrderError = '';
  if (input.sourceDocNo) {
    try {
      takeOrder = await ret.takeOrder(input.sourceDocNo);
    } catch (error) {
      takeOrderError = error instanceof Error ? error.message : String(error);
    }
  }

  if (takeOrder) {
    const grid = ret.detailGrid();
    const sourceLines = await ret.readDetailLines();
    for (let index = 0; index < sourceLines.length; index += 1) {
      await grid.setCell(index, 'biz_qty', input.qty);
      try {
        await grid.setCell(index, 'prc_qty', input.qty);
      } catch {
        // 计价数量可能由业务数量换算得出，只读时跳过。
      }
    }
    if (input.warehouse) {
      await ret.enableColumn('仓库');
      for (let index = 0; index < sourceLines.length; index += 1) {
        await ret.setGridLookup(index, 'whse_no', input.warehouse);
      }
    }
  } else {
    await ret.addDetailRow();
    await ret.selectItem(0, input.itemNo);
    const grid = ret.detailGrid();
    await grid.setCell(0, 'biz_qty', input.qty);
  }

  const lines = await ret.readDetailLines();
  const saved = await ret.save();
  const documentNo = saved.documentNo || input.docNo;
  if (!saved.toast.includes('成功')) {
    throw new Error(
      `[PURCHASE_RETURN_SAVE_FAILED] toast=${saved.toast || '(空)'}，validation=${saved.validation || '(无)'}`,
    );
  }

  await ret.closeDetail();
  await ret.resetToList();
  await ret.filterByDocumentNo(documentNo);
  const listRow = await ret.readListRow(documentNo);
  await ret.openExisting(documentNo);
  const detailHeader = await ret.readHeader();
  const detailLines = await ret.readDetailLines();
  await ret.closeDetail();

  const detailLine = detailLines[0] ?? {};
  const sourceOk = takeOrder ? takeOrder.selectedText.includes(input.sourceDocNo ?? '') : true;
  const assertions = [
    assertion('表头-运营单元', header.opsUnit.includes(input.opsUnit), input.opsUnit, header.opsUnit),
    assertion('表头-供应商', header.supplier.includes(input.supplier), input.supplier, header.supplier),
    assertion('表头-单别', header.bizType.includes(input.bizType), input.bizType, header.bizType),
    assertion('表头-项目', header.project.includes(input.project), input.project, header.project),
    assertion('表头-单号', Boolean(header.docNo), input.docNo || '(自动编码)', header.docNo),
    assertion('来源-取单', sourceOk, input.sourceDocNo ?? '(手工)', (takeOrder?.selectedText ?? takeOrderError) || '(手工录入)'),
    assertion('明细-品号', (detailLine.item_no ?? '').includes(input.itemNo), input.itemNo, detailLine.item_no ?? ''),
    assertion('明细-数量', detailLine.biz_qty === input.qty, input.qty, detailLine.biz_qty ?? ''),
    assertion('保存-提示', saved.toast.includes('成功'), '包含成功', saved.toast),
    assertion('重查-列表行', Boolean(listRow), '存在', listRow ? JSON.stringify(listRow) : '不存在'),
    assertion('重查-详情单号', detailHeader.documentNo === documentNo, documentNo, detailHeader.documentNo),
    assertion('重查-详情供应商', detailHeader.supplier.includes(input.supplier), input.supplier, detailHeader.supplier),
    assertion('重查-详情品号', (detailLine.item_no ?? '').includes(input.itemNo), input.itemNo, detailLine.item_no ?? ''),
    assertion('重查-详情数量', detailLine.biz_qty === input.qty, input.qty, detailLine.biz_qty ?? ''),
  ];

  return {
    header,
    takeOrder,
    takeOrderError,
    toast: saved.toast,
    validation: saved.validation,
    listRow,
    detailHeader,
    detailLines,
    assertions,
  };
}

function assertion(name: string, passed: boolean, expected: string, actual: string) {
  return { name, passed, expected, actual };
}
