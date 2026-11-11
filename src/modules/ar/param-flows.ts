import { createBizTypeParamCrudFlow } from '../common/biz-type-param-crud';

export const arBizTypeParamCrud = createBizTypeParamCrudFlow({
  formPrefix: 'biz_type_ar_param',
  label: '应收',
  documentType: 'ar_biz_type_param',
  defaultOpsUnit: '000W1',
});
