import { ModuleFlow } from './types';
import {
  purchaseOrderCreate,
  purchaseOrderFieldRules,
  purchaseOrderLifecycle,
  purchaseOrderListSmoke,
  purchaseOrderMultilineProbe,
} from './purchase/flows';
import { foundationFieldRules } from './foundation/flows';
import { baseInventoryParamToggle } from './base/flows';
import { arBizTypeCreate, arBizTypeCrud, arBizTypeDelete } from './ar/flows';
import { arBizTypeParamCrud } from './ar/param-flows';
import { apBizTypeCrud, apBizTypeCreate, apBizTypeDelete } from './ap/flows';
import { apBizTypeParamCrud } from './ap/param-flows';
import { listSmokeFlow } from './builtin';

const FLOWS: Record<string, Record<string, ModuleFlow>> = {
  purchase: {
    'purchase-order-create': purchaseOrderCreate,
    'purchase-order-lifecycle': purchaseOrderLifecycle,
    'purchase-order-field-rules': purchaseOrderFieldRules,
    'purchase-order-list-smoke': purchaseOrderListSmoke,
    'purchase-order-multiline-probe': purchaseOrderMultilineProbe,
  },
  foundation: {
    'foundation-field-rules': foundationFieldRules,
  },
  base: {
    'base-inventory-param-toggle': baseInventoryParamToggle,
  },
  ar: {
    'ar-biz-type-crud': arBizTypeCrud,
    'ar-biz-type-create': arBizTypeCreate,
    'ar-biz-type-delete': arBizTypeDelete,
    'ar-biz-type-param-crud': arBizTypeParamCrud,
  },
  ap: {
    'ap-biz-type-crud': apBizTypeCrud,
    'ap-biz-type-create': apBizTypeCreate,
    'ap-biz-type-delete': apBizTypeDelete,
    'ap-biz-type-param-crud': apBizTypeParamCrud,
  },
};

export function getModuleFlow(moduleId: string, flowKey: string): ModuleFlow {
  if (flowKey === 'platform:list-smoke') return listSmokeFlow;
  const flow = FLOWS[moduleId]?.[flowKey];
  if (!flow) {
    throw new Error(`[FLOW_NOT_REGISTERED] 模块 ${moduleId} 未注册流程 ${flowKey}；已注册: ${Object.keys(FLOWS[moduleId] ?? {}).join(', ') || '(无)'}`);
  }
  return flow;
}

export function listModuleFlows(moduleId: string): string[] {
  return Object.keys(FLOWS[moduleId] ?? {}).sort();
}
