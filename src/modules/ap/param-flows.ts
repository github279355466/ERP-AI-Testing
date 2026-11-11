import { createBizTypeParamCrudFlow } from '../common/biz-type-param-crud';

export const apBizTypeParamCrud = createBizTypeParamCrudFlow({
  formPrefix: 'biz_type_ap_param',
  label: '应付',
  documentType: 'ap_biz_type_param',
  defaultOpsUnit: '000W1',
});
