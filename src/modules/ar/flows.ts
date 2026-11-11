import { createBizTypeCrudFlow, createBizTypeRecord, deleteBizTypeRecord } from '../common/biz-type-crud';
import { ModuleFlow, flowAssertion } from '../types';

const OPTIONS = {
  formPrefix: 'biz_type_gen_info',
  bizProp: '其他应收单',
  label: '应收',
  codePrefix: 'QA',
  documentType: 'ar_biz_type',
};

export const arBizTypeCrud = createBizTypeCrudFlow(OPTIONS);

export const arBizTypeCreate: ModuleFlow = async ({ page, params, sourceRef }) => {
  const code = params.code || `QA${Date.now()}`;
  const created = await createBizTypeRecord(page, OPTIONS, code);
  const assertions = [
    flowAssertion('预置应收业务单别编号', created.code === code, code, created.code, 'persistence', sourceRef),
    flowAssertion('预置应收业务单别名称', created.name === created.expectedName, created.expectedName, created.name, 'persistence', sourceRef),
  ];
  return { assertions, documents: [{ document_type: 'ar_biz_type', identifier: code }], notes: `预置应收业务单别 ${code}` };
};

export const arBizTypeDelete: ModuleFlow = async ({ page, params, sourceRef }) => {
  const code = params.code || '';
  if (!code) throw new Error('[FLOW_PARAM_MISSING] 缺少 code');
  const deleted = await deleteBizTypeRecord(page, code);
  return {
    assertions: [flowAssertion('清理后应收业务单别不可见', deleted, '删除成功', deleted ? '删除成功' : '仍存在', 'persistence', sourceRef)],
    notes: `清理应收业务单别 ${code}`,
  };
};
