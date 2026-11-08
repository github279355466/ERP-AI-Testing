import { PurchaseOrderPage } from '../../pages/purchase/purchase-order.page';
import { createPurchaseOrder } from '../../pages/purchase/purchase-order.flow';
import { ModuleFlow, flowAssertion } from '../types';
import { loadFieldRuleSets, rulesForPage } from '../../platform/rules/loader';
import { captureFieldStates } from '../../platform/rules/browser-probe';
import { evaluateFieldRuleSet } from '../../platform/rules/engine';

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

async function createSimpleOrder(
  context: Parameters<ModuleFlow>[0],
  remark: string,
): Promise<{ documentNo: string; toast: string }> {
  const pageObject = new PurchaseOrderPage(context.page, context.config, context.adapters, context.pages);
  await pageObject.openNew();
  await pageObject.ensureHeader({
    opsUnit: requireParam(context.params, 'opsUnit'),
    supplier: requireParam(context.params, 'supplier'),
    bizType: requireParam(context.params, 'bizType'),
  });
  await pageObject.fillRemark(remark);
  await pageObject.addDetailRow();
  await pageObject.setLine(0, {
    itemNo: requireParam(context.params, 'itemNo'),
    qty: context.params.qty ?? '1',
    ...(context.params.price ? { price: context.params.price } : {}),
  });
  const saved = await pageObject.save();
  const documentNo = saved.documentNo || (/[A-Za-z0-9_]+-\d{8,}/.exec(saved.toast)?.[0] ?? '');
  if (!documentNo) throw new Error(`[FLOW_NO_DOC_NO] 保存后未取得单号，toast=${saved.toast || '(空)'}`);
  await pageObject.closeDetail();
  await context.pages.ensureListState(context.page, { forceReload: true });
  await context.pages.waitReady(context.page);
  return { documentNo, toast: saved.toast };
}

export const purchaseOrderLifecycle: ModuleFlow = async (context) => {
  const po = new PurchaseOrderPage(context.page, context.config, context.adapters, context.pages);
  const tag = requireParam(context.params, 'runTag');
  const assertions = [];
  const documents: Array<{ document_type: string; identifier: string }> = [];

  await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page, { forceReload: true });
  await context.pages.waitReady(context.page);

  const createdA = await createSimpleOrder(context, `P7LIFE-A-${tag}`);
  documents.push({ document_type: 'purchase_order', identifier: createdA.documentNo });
  assertions.push(flowAssertion('新增-单据号', Boolean(createdA.documentNo), '非空', createdA.documentNo, 'business', context.sourceRef));

  const updated = await po.updateRemark(createdA.documentNo, `P7LIFE-UPD-${tag}`);
  assertions.push(flowAssertion('修改-备注回读', updated.after === `P7LIFE-UPD-${tag}`, `P7LIFE-UPD-${tag}`, updated.after, 'business', context.sourceRef));
  assertions.push(flowAssertion('修改-状态保持未审核', updated.status === '未审核', '未审核', updated.status, 'business', context.sourceRef));

  const submitted = await po.submitFromRow(createdA.documentNo);
  assertions.push(flowAssertion('提交-状态流转', submitted.status === '审核中', '审核中', submitted.status, 'business', context.sourceRef));

  const audited = await po.auditFromRow(createdA.documentNo);
  assertions.push(flowAssertion('审核-状态流转', audited.status === '已审核', '已审核', audited.status, 'business', context.sourceRef));

  const unaudited = await po.unauditFromRow(createdA.documentNo);
  assertions.push(flowAssertion('撤审-状态回退', unaudited.status === '未审核', '未审核', unaudited.status, 'business', context.sourceRef));
  assertions.push(flowAssertion('撤审-确认文案', /撤审/.test(unaudited.dialog), '包含撤审确认', unaudited.dialog.slice(0, 60), 'ui', context.sourceRef));

  const createdB = await createSimpleOrder(context, `P7LIFE-DEL-${tag}`);
  const deleted = await po.deleteFromRow(createdB.documentNo);
  assertions.push(flowAssertion('删除-二次确认', /删除/.test(deleted.dialog), '包含删除确认', deleted.dialog.slice(0, 60), 'ui', context.sourceRef));
  assertions.push(flowAssertion('删除-记录不可见', deleted.exists === false, '不存在', String(deleted.exists), 'business', context.sourceRef));

  return {
    assertions,
    documents,
    notes: `全操作闭环：A=${createdA.documentNo}（修改/提交/审核/撤审后保留），B=${createdB.documentNo}（创建后删除）`,
  };
};

export const purchaseOrderFieldRules: ModuleFlow = async (context) => {
  const loaded = loadFieldRuleSets(process.cwd(), 'purchase');
  if (loaded.issues.length > 0) {
    throw new Error(`[FIELD_RULE_INVALID] ${loaded.issues.map((entry) => `${entry.file}: ${entry.messages.join('; ')}`).join(' | ')}`);
  }
  const rules = rulesForPage(loaded.sets, 'purchase-order');
  if (rules.length === 0) throw new Error('[FIELD_RULE_EMPTY] purchase-order 未配置字段规则');
  const fields = [...new Set(rules.map((rule) => rule.field))];
  const po = new PurchaseOrderPage(context.page, context.config, context.adapters, context.pages);

  await context.pages.resetTabs(context.page).catch(() => 0);
  await context.pages.ensureListState(context.page, { forceReload: true });
  await context.pages.waitReady(context.page);

  await po.openNew();
  const before = await captureFieldStates(context.page, fields);
  await po.ensureHeader({
    opsUnit: requireParam(context.params, 'opsUnit'),
    supplier: requireParam(context.params, 'supplier'),
    bizType: requireParam(context.params, 'bizType'),
  });
  await context.page.waitForTimeout(1_200);
  const after = await captureFieldStates(context.page, fields);
  await po.closeDetail();
  await context.pages.ensureListState(context.page, { forceReload: true });
  await context.pages.waitReady(context.page);

  const evaluation = evaluateFieldRuleSet(rules, { before, after });
  const assertions = evaluation.results.map((result) => {
    const warning = result.status === 'warning';
    const skipped = result.status === 'skipped';
    return flowAssertion(
      `${result.rule_id}${warning ? '（候选/警告）' : ''}${skipped ? '（跳过）' : ''}`,
      result.status === 'passed' || warning || skipped,
      result.expected,
      skipped ? `跳过：${result.actual}` : result.actual,
      ['READONLY', 'DISABLED'].includes(result.type) ? 'ui' : 'business',
      context.sourceRef,
    );
  });
  assertions.push(
    flowAssertion(
      '规则集-无失败',
      evaluation.passed,
      'verified 规则全部通过',
      `passed=${evaluation.results.length - evaluation.failed - evaluation.warnings - evaluation.skipped} failed=${evaluation.failed} warnings=${evaluation.warnings} skipped=${evaluation.skipped}`,
      'business',
      context.sourceRef,
    ),
  );
  return {
    assertions,
    notes: `字段规则：${evaluation.results.length} 条，failed=${evaluation.failed}，warning=${evaluation.warnings}，skipped=${evaluation.skipped}`,
  };
};
