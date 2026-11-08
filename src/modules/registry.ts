import { ModuleFlow } from './types';
import { purchaseOrderCreate, purchaseOrderLifecycle, purchaseOrderListSmoke } from './purchase/flows';
import { listSmokeFlow } from './builtin';

const FLOWS: Record<string, Record<string, ModuleFlow>> = {
  purchase: {
    'purchase-order-create': purchaseOrderCreate,
    'purchase-order-lifecycle': purchaseOrderLifecycle,
    'purchase-order-list-smoke': purchaseOrderListSmoke,
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
