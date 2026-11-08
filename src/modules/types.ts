import { Page } from '@playwright/test';
import { AdapterSet } from '../adapters';
import { AthenaConfig } from '../config/athena-config';
import { PageManager } from '../browser/page-manager';
import { PlatformSourceRef } from '../platform/plan/compile';

export interface ModuleFlowContext {
  page: Page;
  config: AthenaConfig;
  adapters: AdapterSet;
  pages: PageManager;
  params: Record<string, string>;
  sourceRef: PlatformSourceRef;
}

export interface ModuleFlowAssertion {
  name: string;
  expected: string;
  actual: string;
  passed: boolean;
  level: 'ui' | 'business' | 'persistence';
  source_ref?: PlatformSourceRef;
}

export interface ModuleFlowResult {
  assertions: ModuleFlowAssertion[];
  documents?: Array<{ document_type: string; identifier: string }>;
  notes?: string;
}

export type ModuleFlow = (context: ModuleFlowContext) => Promise<ModuleFlowResult>;

export function flowAssertion(
  name: string,
  passed: boolean,
  expected: string,
  actual: string,
  level: ModuleFlowAssertion['level'],
  sourceRef: PlatformSourceRef,
): ModuleFlowAssertion {
  return { name, passed, expected, actual, level, source_ref: sourceRef };
}
