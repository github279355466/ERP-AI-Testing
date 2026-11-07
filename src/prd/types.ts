export const PARSER_VERSION = '1.0.0';
export const SCHEMA_VERSION = '1.0.0';

export type Confidence = 'CONFIRMED' | 'DERIVED' | 'AMBIGUOUS' | 'CONFLICTED' | 'MISSING';

export type SourceType =
  | 'PRD_EXPLICIT'
  | 'PRD_DERIVED'
  | 'PLATFORM_SERVICE'
  | 'UI_OBSERVED'
  | 'USER_CONFIRMED'
  | 'PENDING';

export type ObjectType =
  | 'Document'
  | 'Entity'
  | 'Page'
  | 'Field'
  | 'Control'
  | 'Rule'
  | 'Action'
  | 'Workflow'
  | 'Dependency'
  | 'Scenario'
  | 'OpenQuestion'
  | 'ExistingCase'
  | 'Evidence';

export interface SourceRef {
  document_id: string;
  file_path: string;
  doc_version?: string | null;
  sha256?: string;
  section?: string;
  line_start?: number;
  line_end?: number;
  /** JSON 文档内的定位路径（JSON Pointer 风格，支持在 JSON 字符串节点内继续解析） */
  json_path?: string | null;
  page?: number | null;
  paragraph_index?: number | null;
  excerpt?: string;
  table?: string;
}

export interface BaseKnowledgeObject {
  id: string;
  object_type: ObjectType;
  name: string;
  module: string;
  status: 'ACTIVE' | 'DRAFT' | 'MISSING_SOURCE';
  schema_version?: string;
  source_refs: SourceRef[];
  created_by_parser_version: string;
  updated_at: string;
}

export type ScanStatus = 'NEW' | 'MODIFIED' | 'UNCHANGED' | 'SOURCE_MISSING';

export interface DocumentRecord extends BaseKnowledgeObject {
  object_type: 'Document';
  file_path: string;
  relative_path: string;
  file_name: string;
  sha256: string;
  size_bytes: number;
  modified_at: string;
  title: string;
  doc_version: string | null;
  doc_date: string | null;
  doc_status: string | null;
  prd_type: string | null;
  business_object: string | null;
  biz_model_no: string | null;
  application: string | null;
  entity_names: string[];
  section_count: number;
  table_count: number;
  last_scan_status: ScanStatus;
  scanned_at: string;
  parser: string;
  source_role: 'PRD' | 'TEST_CASE_LIBRARY';
  job_directory: string;
  supersedes: string[];
  superseded_by: string | null;
  related_document_ids: string[];
  is_latest: boolean;
}

export interface Entity extends BaseKnowledgeObject {
  object_type: 'Entity';
  entity_no: string | null;
  label: string;
  parent_entity_no: string | null;
  document_ids: string[];
  field_count: number;
  page_count: number;
  rule_count: number;
  /** BUSINESS：有字段的业务实体；HEADER_ONLY：仅有实体声明；DETAIL：明细/技术子实体 */
  entity_kind?: 'BUSINESS' | 'HEADER_ONLY' | 'DETAIL';
  /** 被归并到本实体的历史实体 ID，保留可追溯性 */
  superseded_entity_ids?: string[];
}

export type PageType = 'LIST' | 'FORM' | 'TAB' | 'MODAL' | 'UNKNOWN';

export interface Page extends BaseKnowledgeObject {
  object_type: 'Page';
  page_type: PageType;
  entity_id: string | null;
  document_id: string;
  parent_page_id: string | null;
  menu_path: string[];
}

export type ControlType =
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

export interface Control extends BaseKnowledgeObject {
  object_type: 'Control';
  control_type: ControlType;
  field_id: string | null;
  document_id: string;
  evidence_text: string | null;
}

export interface Field extends BaseKnowledgeObject {
  object_type: 'Field';
  field_no: string | null;
  label: string;
  /** JSON 文档字段属性节点的定位路径 */
  json_path?: string | null;
  /** JSON 文档校验项节点的定位路径，与校验项顺序一致 */
  validation_paths?: string[];
  entity_id: string | null;
  entity_no: string | null;
  entity_label: string | null;
  page_id: string | null;
  document_id: string;
  control_type: ControlType;
  required: boolean;
  required_condition: string | null;
  readonly: boolean;
  readonly_condition: string | null;
  hidden: boolean;
  disabled: boolean;
  disabled_condition: string | null;
  default_value: string | null;
  default_timing: string | null;
  lookup_desc: string | null;
  options: string[];
  validation_text: string | null;
  attributes: Record<string, string>;
  attribute_lines: Record<string, number | null> | null;
  source_kind?: 'markdown' | 'json';
  data_type: string | null;
  length: number | null;
  precision: number | null;
  related_master_data: string | null;
  confidence: Confidence;
  source_type: SourceType;
}

export type RuleType =
  | 'REQUIRED'
  | 'READONLY'
  | 'HIDDEN'
  | 'DISABLED'
  | 'DEFAULT_VALUE'
  | 'LOOKUP'
  | 'VALIDATION'
  | 'UNIQUENESS'
  | 'FORMAT'
  | 'PRECISION'
  | 'CALCULATION'
  | 'LINKAGE'
  | 'STATE_TRANSITION'
  | 'PERMISSION'
  | 'WORKFLOW'
  | 'API_CONTRACT'
  | 'UNKNOWN';

export interface Rule extends BaseKnowledgeObject {
  object_type: 'Rule';
  description: string;
  rule_type: RuleType;
  source_type: SourceType;
  confidence: Confidence;
  applies_to: string[];
  field_no: string | null;
  field_name: string | null;
  trigger: string | null;
  conditions: string[];
  expected_result: string | null;
  derivation: string | null;
  /** 规则文本中引用的平台服务，用于区分「字段行为引用服务」与「纯平台服务规则」 */
  service_refs?: string[];
  document_id: string;
  open_question_ids: string[];
}

export interface Action extends BaseKnowledgeObject {
  object_type: 'Action';
  action_name: string;
  scope: 'HEADER' | 'DETAIL' | 'LIST' | 'UNKNOWN';
  availability: string | null;
  display_location: string | null;
  pre_check: string | null;
  processing: string | null;
  post_processing: string | null;
  apis: string[];
  phase_lines: Record<string, number>;
  document_id: string;
}

export interface WorkflowStep {
  seq: string;
  step: string;
  description: string;
  exception: string;
  node_name?: string;
  actor?: string;
  precondition?: string;
  output?: string;
  next_step?: string;
}

export interface Workflow extends BaseKnowledgeObject {
  object_type: 'Workflow';
  document_id: string;
  entity_id: string | null;
  steps: WorkflowStep[];
}

export type RelationType =
  | 'USES_MASTER_DATA'
  | 'DERIVED_FROM'
  | 'GENERATES'
  | 'REFERENCES'
  | 'CONSUMES'
  | 'RETURNS_TO'
  | 'STATUS_TRANSITION'
  | 'FIELD_DEPENDENCY'
  | 'CANDIDATE_LINK';

export interface Dependency extends BaseKnowledgeObject {
  object_type: 'Dependency';
  source_id: string;
  target_id: string | null;
  target_ref: string;
  relation_type: RelationType;
  mapping: RelationMapping[] | string | null;
  source_type: SourceType;
  confidence: Confidence;
  document_id: string;
}

export interface RelationMapping {
  target: string;
  source: string;
  cond: string | null;
}

export type ScenarioStatus = 'DRAFT' | 'REVIEW_REQUIRED' | 'APPROVED' | 'REJECTED' | 'EXECUTABLE';

export type AutomationFeasibility =
  | 'UI_READY'
  | 'NEEDS_UI_EXPLORATION'
  | 'NEEDS_CONFIRMATION'
  | 'NOT_UI_OBSERVABLE';

export interface ScenarioAssertion {
  type: string;
  target: string;
  expected: string;
}

export interface Scenario extends Omit<BaseKnowledgeObject, 'status'> {
  object_type: 'Scenario';
  title: string;
  test_objective: string;
  scenario_type: string;
  status: ScenarioStatus;
  automation_feasibility: AutomationFeasibility;
  business_object: string | null;
  preconditions: string[];
  data_requirements: string[];
  steps: string[];
  assertions: ScenarioAssertion[];
  expected_result: string;
  evidence_requirements: string[];
  rule_ids: string[];
  document_ids: string[];
  case_ids: string[];
  review_required: boolean;
  origin: 'GENERATED' | 'EXISTING_CASE';
}

export interface ExistingCaseRecord {
  id: string;
  object_type: 'ExistingCase';
  case_id: string;
  schema_version?: string;
  package: string;
  module: string;
  title: string;
  category: string;
  priority: 'P0' | 'P1' | 'P2' | string;
  /** 已解析到本知识库的 Rule.id（RULE-*），由覆盖率匹配回填 */
  rule_ids: string[];
  /** 用例库原始规则编号（如 R-xxx），与知识库命名空间无关，仅作溯源 */
  source_rule_ids: string[];
  object: string | null;
  field: string | null;
  field_no?: string | null;
  field_nos?: string[];
  object_path?: string | null;
  needs_confirm: boolean;
  assertion_types: string[];
  document_id: string;
}

export interface Evidence extends BaseKnowledgeObject {
  object_type: 'Evidence';
  evidence_id: string;
  document_id: string;
  doc_version: string | null;
  sha256: string;
  file_path: string;
  section: string | null;
  line_start: number | null;
  line_end: number | null;
  json_path: string | null;
  page: number | null;
  paragraph_index: number | null;
  excerpt: string | null;
  verbatim: boolean;
  kind: 'RULE' | 'ACTION' | 'WORKFLOW' | 'DEPENDENCY' | 'FIELD' | 'SECTION';
  referenced_by: string[];
}

export interface OpenQuestion {
  id: string;
  schema_version?: string;
  object_type: 'OpenQuestion';
  question: string;
  category:
    | 'VERSION_CONFLICT'
    | 'RULE_CONFLICT'
    | 'MISSING_EVIDENCE'
    | 'MISSING_DEFINITION'
    | 'AMBIGUOUS_RULE'
    | 'INCOMPLETE_STATE_MACHINE'
    | 'BROKEN_FLOW'
    | 'UNSUPPORTED_FORMAT'
    | 'PARSE_ERROR'
    | 'SCENARIO_GAP'
    | 'SOURCE_CONFLICT'
    | 'SOURCE_MISSING'
    | 'DUPLICATE_SOURCE'
    | 'EXCLUDED_SOURCE';
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  document_ids: string[];
  evidence: string[];
  impact: string;
  suggested_owner: string;
  status: 'OPEN' | 'CLOSED';
  created_at: string;
}

export interface ParseIssue {
  file_path: string;
  document_id: string | null;
  parser: string;
  stage: string;
  message: string;
  line: number | null;
}

export interface ScanSummary {
  scanned_at: string;
  source_root: string;
  total_files: number;
  supported_files: number;
  unsupported_files: number;
  new_documents: number;
  modified_documents: number;
  unchanged_documents: number;
  missing_documents: number;
  parse_errors: number;
  mode: 'FULL' | 'INCREMENTAL';
}

export interface KnowledgeBundle {
  documents: DocumentRecord[];
  entities: Entity[];
  pages: Page[];
  fields: Field[];
  controls: Control[];
  rules: Rule[];
  actions: Action[];
  workflows: Workflow[];
  dependencies: Dependency[];
  scenarios: Scenario[];
  existingCases: ExistingCaseRecord[];
  openQuestions: OpenQuestion[];
  evidence: Evidence[];
  issues: ParseIssue[];
  scan: ScanSummary;
}

export interface DocumentExtraction {
  document: DocumentRecord;
  entities: Entity[];
  pages: Page[];
  fields: Field[];
  controls: Control[];
  rules: Rule[];
  actions: Action[];
  workflows: Workflow[];
  dependencies: Dependency[];
  openQuestions: OpenQuestion[];
  issues: ParseIssue[];
}
