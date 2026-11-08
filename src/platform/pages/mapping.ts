import fs from 'node:fs';
import path from 'node:path';
import { Locator, Page } from '@playwright/test';
import { LocatorCandidate, LocatorResolver, ResolvedControl } from '../../locator/strategy';
import { ContractIssue, validateData } from '../contracts/validator';
import { readStructured } from '../contracts/validator';
import { PlatformSourceRef } from '../plan/compile';

export type PageControlType =
  | 'TEXT_INPUT'
  | 'NUMBER_INPUT'
  | 'DATE_PICKER'
  | 'DROPDOWN'
  | 'LOOKUP'
  | 'TREE_SELECT'
  | 'CHECKBOX'
  | 'RADIO'
  | 'GRID'
  | 'BUTTON'
  | 'TAB'
  | 'MODAL'
  | 'UNKNOWN';

export interface PageFieldMapping {
  name: string;
  label: string;
  control_type: PageControlType;
  locator: { strategy: 'role' | 'label' | 'placeholder' | 'testid' | 'css' | 'xpath'; value: string; unique: boolean };
  required: boolean;
  readonly: boolean;
  verified: boolean;
  source_ref: PlatformSourceRef;
}

export interface PageMapping {
  schema_version: '1.0';
  module_id: string;
  page_key: string;
  page_name: string;
  navigation: { menu_path: string[]; work_item_code: string; route: string };
  status: 'candidate' | 'confirmed' | 'deprecated';
  review_status: 'draft' | 'needs_review' | 'approved' | 'blocked';
  locator_priority: Array<'role' | 'label' | 'placeholder' | 'testid' | 'css' | 'xpath'>;
  fields: PageFieldMapping[];
}

export interface PageMappingLoadResult {
  directory: string;
  mappings: PageMapping[];
  issues: Array<{ file: string; issues: ContractIssue[] }>;
}

export class PageMappingError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(`[${code}] ${message}`);
    this.name = 'PageMappingError';
  }
}

export function pageMappingDirectory(repoRoot: string, moduleId: string): string {
  return path.join(repoRoot, 'business-modules', moduleId, 'page-mappings');
}

export function loadPageMappings(repoRoot: string, moduleId: string): PageMappingLoadResult {
  const directory = pageMappingDirectory(repoRoot, moduleId);
  if (!fs.existsSync(directory)) {
    throw new PageMappingError('PAGE_MAPPING_DIR_MISSING', `页面映射目录不存在: ${directory}`);
  }
  const files = fs
    .readdirSync(directory)
    .filter((file) => /\.ya?ml$/i.test(file))
    .sort();
  const mappings: PageMapping[] = [];
  const issues: PageMappingLoadResult['issues'] = [];
  for (const file of files) {
    const target = path.join(directory, file);
    const result = validateData('page-mapping', readStructured(target), { target });
    if (!result.valid) {
      issues.push({ file, issues: result.issues });
      continue;
    }
    const mapping = readStructured(target) as PageMapping;
    if (mapping.module_id !== moduleId) {
      issues.push({
        file,
        issues: [{ path: '/module_id', message: `页面映射 module_id=${mapping.module_id} 与模块包 ${moduleId} 不一致` }],
      });
      continue;
    }
    mappings.push(mapping);
  }
  return { directory, mappings, issues };
}

export class PageMappingRegistry {
  private readonly byKey = new Map<string, PageMapping>();

  constructor(mappings: PageMapping[]) {
    for (const mapping of mappings) {
      if (this.byKey.has(mapping.page_key)) {
        throw new PageMappingError('PAGE_KEY_DUPLICATED', `页面标识重复: ${mapping.page_key}`);
      }
      this.byKey.set(mapping.page_key, mapping);
    }
  }

  static load(repoRoot: string, moduleId: string): PageMappingRegistry {
    const result = loadPageMappings(repoRoot, moduleId);
    if (result.issues.length > 0) {
      const detail = result.issues.map((entry) => `${entry.file}: ${entry.issues.map((issue) => issue.message).join('; ')}`).join(' | ');
      throw new PageMappingError('PAGE_MAPPING_INVALID', detail);
    }
    return new PageMappingRegistry(result.mappings);
  }

  keys(): string[] {
    return [...this.byKey.keys()].sort();
  }

  all(): PageMapping[] {
    return this.keys().map((key) => this.byKey.get(key) as PageMapping);
  }

  require(pageKey: string): PageMapping {
    const mapping = this.byKey.get(pageKey);
    if (!mapping) throw new PageMappingError('PAGE_NOT_MAPPED', `模块未登记页面: ${pageKey}`);
    return mapping;
  }

  field(pageKey: string, fieldName: string): PageFieldMapping {
    const mapping = this.require(pageKey);
    const field = mapping.fields.find((candidate) => candidate.name === fieldName);
    if (!field) {
      throw new PageMappingError('PAGE_FIELD_NOT_MAPPED', `${pageKey} 未登记字段: ${fieldName}`);
    }
    return field;
  }

  fieldsByLabel(pageKey: string): Map<string, PageFieldMapping> {
    return new Map(this.require(pageKey).fields.map((field) => [field.label, field]));
  }
}

const FORM_ITEM_XPATH = 'xpath=ancestor::div[contains(@class,"FormItem-module_form-item__")][1]';

export function controlSelector(controlType: PageControlType): string {
  switch (controlType) {
    case 'TEXT_INPUT':
    case 'NUMBER_INPUT':
    case 'DATE_PICKER':
      return 'input, textarea';
    case 'DROPDOWN':
      return '[class*="Select-module_select__"]';
    case 'LOOKUP':
      return '[class*="WindowSelect-module_windowSelect"]';
    case 'TREE_SELECT':
      return '.ant-tree-select, [class*="TreeSelect"]';
    case 'CHECKBOX':
      return 'input[type="checkbox"], .ant-checkbox';
    case 'RADIO':
      return 'input[type="radio"], .ant-radio';
    case 'GRID':
      return '.ag-root';
    case 'BUTTON':
      return 'button';
    case 'TAB':
      return '.ant-tabs-tab';
    case 'MODAL':
      return '.rc-dialog';
    default:
      return 'input, textarea, [role="combobox"], button';
  }
}

function escapeAttribute(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function toCandidates(field: PageFieldMapping, mapping: PageMapping): LocatorCandidate[] {
  const primary: LocatorCandidate = {
    kind: field.locator.strategy,
    value: field.locator.value,
    exact: true,
  };
  const extras: LocatorCandidate[] = [];
  for (const strategy of mapping.locator_priority) {
    if (strategy === field.locator.strategy) continue;
    if (strategy === 'label') extras.push({ kind: 'label', value: field.label, exact: true });
    if (strategy === 'css') extras.push({ kind: 'css', value: `[data-field="${escapeAttribute(field.name)}"]` });
    if (strategy === 'testid') extras.push({ kind: 'testid', value: field.name });
  }
  return [primary, ...extras];
}

export async function resolvePageField(
  page: Page,
  mapping: PageMapping,
  field: PageFieldMapping,
  timeoutMs = 10_000,
): Promise<ResolvedControl> {
  if (field.locator.strategy === 'label') {
    const label = page.locator(`label[for="${escapeAttribute(field.locator.value)}"]:visible`).first();
    if ((await label.count().catch(() => 0)) > 0) {
      const formItem: Locator = label.locator(FORM_ITEM_XPATH);
      const control = formItem.locator(controlSelector(field.control_type)).first();
      if ((await control.count().catch(() => 0)) > 0) {
        return LocatorResolver.fromLocator(control, `label[for="${field.locator.value}"] -> ${field.control_type}`);
      }
      return LocatorResolver.fromLocator(formItem, `label[for="${field.locator.value}"] -> form-item`);
    }
  }
  const resolver = new LocatorResolver(page, timeoutMs);
  return resolver.resolve(toCandidates(field, mapping));
}
