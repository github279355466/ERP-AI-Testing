export type UiPageType = 'document' | 'master';

export interface UiSpecSourceRef {
  document_id: string;
  file_path: string;
  source_type: string;
  excerpt: string;
}

export interface ListExpectation {
  status_colors?: Record<string, 'green' | 'blue' | 'yellow' | 'orange' | 'gray'>;
  tabs: { required: string[]; allow_extra?: boolean };
  columns: { order: string[]; allow_extra?: boolean };
  batch_actions: { order: string[] };
  actions_by_status: Record<string, string[]>;
  pagination?: { required_text?: string[] };
}

export interface FieldGroupExpectation {
  title: string;
  fields: string[];
}

export interface DetailExpectation {
  banner: { require_single_number: boolean; max_totals: number; totals?: string[] };
  header_groups: { order: string[]; allow_extra?: boolean };
  field_layout: { order: string[]; groups?: FieldGroupExpectation[]; lookup_fields?: string[] };
  grid: { required: boolean; section_title_pattern?: string; columns?: string[] };
  lookup_input?: LookupInputExpectation;
  bottom_actions: { order: string[] };
}

export interface UiSpec {
  schema_version: '1.0';
  module_id: string;
  page_key: string;
  page_name: string;
  page_type: UiPageType;
  source_ref: UiSpecSourceRef;
  expectations: { list: ListExpectation; detail: DetailExpectation };
}

export interface HeaderObservation {
  id: string;
  text: string;
  pinned: 'left' | 'center' | 'right';
}

export interface ListRowObservation {
  status: string;
  statusColor: string;
  actions: string[];
}

export interface ListObservation {
  tabs: string[];
  headers: HeaderObservation[];
  batchActions: string[];
  rows: ListRowObservation[];
  rowCount: number;
  paginationText: string;
}

export interface BannerObservation {
  found: boolean;
  text: string;
}

export interface FieldObservation {
  label: string;
  value: string;
  group: string;
  required: boolean;
  isLookup: boolean;
  top: number;
  left: number;
}

export interface LookupProbe {
  label: string;
  keyword: string;
  found: boolean;
  editable: boolean;
  fuzzy: boolean;
  resultCount: number;
  codeKeyword?: string;
  codeResultCount?: number;
  skippedReason?: string;
}

export interface LookupInputExpectation {
  require_manual_entry: boolean;
  require_fuzzy_query: boolean;
  max_fields: number;
}

export interface DetailObservation {
  banner: BannerObservation;
  totals: string[];
  headerGroups: string[];
  fields: FieldObservation[];
  sectionTitles: string[];
  gridColumns: string[];
  bottomActions: string[];
  statusBadge: string;
  hasSingleNumber: boolean;
  lookupProbes?: LookupProbe[];
}

export type UiFindingStatus = 'pass' | 'fail' | 'unknown' | 'skipped';

export interface UiFinding {
  rule: string;
  title: string;
  expectation: string;
  observed: string;
  status: UiFindingStatus;
  severity: 'P0' | 'P1' | 'P2';
  note?: string;
}

export interface UiPageResult {
  module_id: string;
  page_key: string;
  page_name: string;
  page_type: UiPageType;
  source_ref: UiSpecSourceRef;
  findings: UiFinding[];
  list?: ListObservation;
  detail?: DetailObservation;
  screenshots?: string[];
  error?: string;
}

export interface UiRunSummary {
  total: number;
  passed: number;
  failed: number;
  unknown: number;
  skipped: number;
  rules: number;
}
