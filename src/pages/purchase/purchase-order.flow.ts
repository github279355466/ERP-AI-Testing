import { Page } from '@playwright/test';
import { PurchaseOrderPage, PurchaseOrderLineInput } from './purchase-order.page';

export interface CreatePurchaseOrderInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  docDate?: string;
  project?: string;
  remark: string;
  line?: PurchaseOrderLineInput;
  lines?: PurchaseOrderLineInput[];
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

export interface ProbePurchaseOrderLinesInput {
  opsUnit: string;
  supplier: string;
  bizType: string;
  lines: PurchaseOrderLineInput[];
}

export async function probePurchaseOrderLines(
  page: Page,
  po: PurchaseOrderPage,
  input: ProbePurchaseOrderLinesInput,
): Promise<{ header: Record<string, string>; rows: Array<Record<string, string>>; assertions: ReturnType<typeof assertion>[] }> {
  await po.openNew();
  const header = await po.ensureHeader({ opsUnit: input.opsUnit, supplier: input.supplier, bizType: input.bizType });
  for (let index = 0; index < input.lines.length; index += 1) {
    await po.addDetailRow();
    await po.setLine(index, input.lines[index]);
  }
  const rows = await po.readDetailLines();
  const assertions = [
    assertion('明细行数', rows.length === input.lines.length, String(input.lines.length), String(rows.length)),
    ...input.lines.flatMap((expected, index) => {
      const actual = rows[index] ?? {};
      return [
        assertion(`明细${index + 1}-品号`, actual.item_no?.includes(expected.itemNo) ?? false, expected.itemNo, actual.item_no ?? ''),
        assertion(`明细${index + 1}-数量`, actual.biz_qty === expected.qty, expected.qty, actual.biz_qty ?? ''),
        assertion(`明细${index + 1}-单位默认值`, Boolean((actual.biz_unit_no ?? '').trim()), '非空', actual.biz_unit_no ?? ''),
        assertion(
          `明细${index + 1}-单价`,
          expected.price ? actual.price === expected.price : true,
          expected.price ?? '(未设置)',
          actual.price ?? '',
        ),
      ];
    }),
  ];
  await po.closeDetail();
  return { header, rows, assertions };
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

  const lines = input.lines?.length ? input.lines : input.line ? [input.line] : [];
  if (lines.length === 0) throw new Error('[PURCHASE_ORDER_NO_LINES] 至少需要一笔明细');
  const lineResults: Array<Record<string, string>> = [];
  for (let index = 0; index < lines.length; index += 1) {
    await po.addDetailRow();
    lineResults.push(await po.setLine(index, lines[index]));
  }
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
  const line = lineResults[0] ?? {};
  const detailLine = detailLines[0] ?? {};

  const lineAssertions = lines.flatMap((expected, index) => {
    const actual = lineResults[index] ?? {};
    const detail = detailLines[index] ?? {};
    return [
      assertion(`明细${index + 1}-品号`, actual.item_no?.includes(expected.itemNo) ?? false, expected.itemNo, actual.item_no ?? ''),
      assertion(`明细${index + 1}-数量`, actual.biz_qty === expected.qty, expected.qty, actual.biz_qty ?? ''),
      assertion(
        `明细${index + 1}-单位默认值`,
        Boolean((actual.biz_unit_no ?? '').trim()),
        '非空',
        actual.biz_unit_no ?? '',
      ),
      assertion(
        `明细${index + 1}-单价`,
        expected.price ? actual.price === expected.price : true,
        expected.price ?? '(未设置)',
        actual.price ?? '',
      ),
      assertion(
        `重查-明细${index + 1}-品号`,
        detail.item_no?.includes(expected.itemNo) ?? false,
        expected.itemNo,
        detail.item_no ?? '',
      ),
      assertion(`重查-明细${index + 1}-数量`, detail.biz_qty === expected.qty, expected.qty, detail.biz_qty ?? ''),
      assertion(
        `重查-明细${index + 1}-单位默认值`,
        Boolean((detail.biz_unit_no ?? '').trim()),
        '非空',
        detail.biz_unit_no ?? '',
      ),
    ];
  });

  const assertions = [
    assertion('表头-运营单元', header.opsUnit.includes(input.opsUnit), input.opsUnit, header.opsUnit),
    assertion('表头-供应商', header.supplier.includes(input.supplier), input.supplier, header.supplier),
    assertion('表头-单别', header.bizType.includes(input.bizType), input.bizType, header.bizType),
    ...lineAssertions,
    assertion('保存-单据号', Boolean(documentNo), '非空', documentNo),
    assertion('重查-列表行', Boolean(listRow), '存在', listRow ? JSON.stringify(listRow) : '不存在'),
    assertion('重查-详情单号', detailHeader.documentNo === documentNo, documentNo, detailHeader.documentNo),
    assertion('重查-详情运营单元', detailHeader.opsUnit.includes(input.opsUnit), input.opsUnit, detailHeader.opsUnit),
    assertion('重查-详情供应商', detailHeader.supplier.includes(input.supplier), input.supplier, detailHeader.supplier),
    assertion('重查-明细行数', detailLines.length === lines.length, String(lines.length), String(detailLines.length)),
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
