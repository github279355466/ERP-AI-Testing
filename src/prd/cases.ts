import fs from 'node:fs';
import path from 'node:path';
import { PARSER_VERSION, DocumentRecord, ExistingCaseRecord, ParseIssue } from './types';
import { ScannedFile } from './scanner';
import { stableId } from './ids';

export const CATEGORY_RULE_TYPES: Record<string, string[]> = {
  readonly: ['READONLY'],
  disabled: ['DISABLED'],
  hidden: ['HIDDEN'],
  required: ['REQUIRED'],
  default_value: ['DEFAULT_VALUE'],
  window_lookup: ['LOOKUP'],
  value_list: ['VALIDATION', 'FORMAT'],
  precheck: ['VALIDATION'],
  operation_gate: ['PERMISSION'],
  state_transition: ['STATE_TRANSITION'],
  rounding: ['PRECISION'],
  api_contract: ['API_CONTRACT'],
  interaction: ['LINKAGE'],
  focus_flow: ['LINKAGE'],
  clear_linkage: ['LINKAGE'],
  input_constraint: ['FORMAT', 'PRECISION'],
};

interface RawCase {
  caseId?: unknown;
  title?: unknown;
  category?: unknown;
  priority?: unknown;
  ruleId?: unknown;
  ruleIds?: unknown;
  object?: unknown;
  field?: unknown;
  objectRef?: { entity?: unknown; label?: unknown; objectPath?: unknown } | null;
  fieldRef?: { fieldNo?: unknown; label?: unknown } | null;
  needsConfirm?: unknown;
  blocked?: unknown;
  automation?: { steps?: unknown } | null;
}

interface RawCasePackage {
  meta?: {
    name?: unknown;
    version?: unknown;
    bizModelNo?: unknown;
    application?: unknown;
    fileNo?: unknown;
  };
  count?: unknown;
  cases?: unknown;
}

export interface CaseLibraryExtraction {
  document: DocumentRecord;
  cases: ExistingCaseRecord[];
  issues: ParseIssue[];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function extractCaseLibrary(file: ScannedFile, now: string): CaseLibraryExtraction | null {
  if (!/test-cases\.json$/i.test(file.file_name)) return null;
  const issues: ParseIssue[] = [];
  let parsed: RawCasePackage;
  try {
    parsed = JSON.parse(fs.readFileSync(file.absolute_path, 'utf8')) as RawCasePackage;
  } catch (error) {
    issues.push({
      file_path: file.relative_path,
      document_id: file.document_id,
      parser: 'test-case-json',
      stage: 'parse',
      message: error instanceof Error ? error.message : String(error),
      line: null,
    });
    return null;
  }
  if (!Array.isArray(parsed.cases)) {
    issues.push({
      file_path: file.relative_path,
      document_id: file.document_id,
      parser: 'test-case-json',
      stage: 'parse',
      message: 'test-cases.json 缺少 cases 数组',
      line: null,
    });
    return null;
  }

  const packageName = file.relative_path.split('/').slice(0, 2).filter((part) => !/test-cases\.json$/i.test(part)).join('/');
  const name = readString(parsed.meta?.name) ?? file.directory_name;
  const assertionsByCase = readAssertions(path.join(path.dirname(file.absolute_path), 'assertions.json'));

  const cases: ExistingCaseRecord[] = [];
  for (const raw of parsed.cases as RawCase[]) {
    const caseId = readString(raw.caseId);
    if (!caseId) continue;
    const ruleIds = Array.isArray(raw.ruleIds)
      ? raw.ruleIds.filter((item): item is string => typeof item === 'string')
      : readString(raw.ruleId)?.split(',').map((item) => item.trim()).filter(Boolean) ?? [];
    const objectLabel = readString(raw.objectRef?.label) ?? readString(raw.object);
    const fieldLabel = readString(raw.fieldRef?.label) ?? readString(raw.field);
    const assertionInfo = assertionsByCase.get(caseId);
    const fieldNos = [
      ...(readString(raw.fieldRef?.fieldNo) ? [readString(raw.fieldRef?.fieldNo) as string] : []),
      ...(assertionInfo?.fieldNos ?? []),
      ...readStepTargets(raw.automation),
    ];
    cases.push({
      id: stableId('CASE', `${file.relative_path}|${caseId}`),
      object_type: 'ExistingCase',
      case_id: caseId,
      package: packageName || name,
      module: name,
      title: readString(raw.title) ?? caseId,
      category: readString(raw.category) ?? 'unknown',
      priority: readString(raw.priority) ?? 'P2',
      rule_ids: [],
      source_rule_ids: ruleIds,
      object: objectLabel,
      field: fieldLabel,
      field_no: readString(raw.fieldRef?.fieldNo),
      field_nos: [...new Set(fieldNos)],
      object_path: readString(raw.objectRef?.objectPath),
      needs_confirm: raw.needsConfirm === true || raw.blocked === true,
      assertion_types: assertionInfo?.types ?? [],
      document_id: file.document_id,
    });
  }

  const document: DocumentRecord = {
    id: file.document_id,
    object_type: 'Document',
    name,
    module: '测试用例',
    status: 'ACTIVE',
    source_refs: [{ document_id: file.document_id, file_path: file.relative_path, line_start: 1, excerpt: name }],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    file_path: file.absolute_path,
    relative_path: file.relative_path,
    file_name: file.file_name,
    sha256: file.sha256,
    size_bytes: file.size_bytes,
    modified_at: file.modified_at,
    title: name,
    doc_version: readString(parsed.meta?.version),
    doc_date: null,
    doc_status: null,
    prd_type: '测试用例',
    business_object: name,
    biz_model_no: readString(parsed.meta?.bizModelNo),
    application: readString(parsed.meta?.application),
    entity_names: [],
    section_count: 0,
    table_count: 0,
    last_scan_status: file.status,
    scanned_at: now,
    parser: 'test-case-json',
    source_role: 'TEST_CASE_LIBRARY',
    job_directory: file.job_directory,
    supersedes: [],
    superseded_by: null,
    related_document_ids: [],
    is_latest: true,
  };
  return { document, cases, issues };
}

function readStepTargets(automation: RawCase['automation']): string[] {
  if (!automation || !Array.isArray(automation.steps)) return [];
  const fieldNos: string[] = [];
  for (const rawStep of automation.steps) {
    if (typeof rawStep !== 'object' || rawStep === null) continue;
    const step = rawStep as { target?: { fieldNo?: unknown }; targets?: unknown };
    if (step.target && typeof step.target.fieldNo === 'string') fieldNos.push(step.target.fieldNo);
    if (Array.isArray(step.targets)) {
      for (const target of step.targets) {
        if (typeof target === 'object' && target !== null) {
          const fieldNo = (target as { fieldNo?: unknown }).fieldNo;
          if (typeof fieldNo === 'string') fieldNos.push(fieldNo);
        }
      }
    }
  }
  return fieldNos;
}

function readAssertions(assertionsPath: string): Map<string, { types: string[]; fieldNos: string[] }> {
  const result = new Map<string, { types: string[]; fieldNos: string[] }>();
  if (!fs.existsSync(assertionsPath)) return result;
  try {
    const parsed = JSON.parse(fs.readFileSync(assertionsPath, 'utf8')) as {
      assertions?: Record<string, unknown>;
    };
    const assertions = parsed.assertions ?? {};
    for (const [caseId, value] of Object.entries(assertions)) {
      const list = Array.isArray(value) ? value : [value];
      const types: string[] = [];
      const fieldNos: string[] = [];
      for (const item of list) {
        if (typeof item !== 'object' || item === null) continue;
        const record = item as { type?: unknown; target?: { fieldNo?: unknown } };
        if (typeof record.type === 'string') types.push(record.type);
        if (record.target && typeof record.target.fieldNo === 'string') fieldNos.push(record.target.fieldNo);
      }
      result.set(caseId, { types: [...new Set(types)], fieldNos: [...new Set(fieldNos)] });
    }
  } catch {
    return result;
  }
  return result;
}
