#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const outputDir = path.resolve('schemas');
fs.mkdirSync(outputDir, { recursive: true });

const nullable = (type) => ({ type: [type, 'null'] });
const stringArray = { type: 'array', items: { type: 'string' } };

const SOURCE_TYPES = ['PRD_EXPLICIT', 'PRD_DERIVED', 'PLATFORM_SERVICE', 'UI_OBSERVED', 'USER_CONFIRMED', 'PENDING'];
const CONFIDENCE = ['CONFIRMED', 'DERIVED', 'AMBIGUOUS', 'CONFLICTED', 'MISSING'];
const RULE_TYPES = [
  'REQUIRED', 'READONLY', 'HIDDEN', 'DISABLED', 'DEFAULT_VALUE', 'LOOKUP', 'VALIDATION',
  'UNIQUENESS', 'PRECISION', 'CALCULATION', 'STATE_TRANSITION', 'PERMISSION', 'LINKAGE',
  'WORKFLOW', 'API_CONTRACT',
];

function write(name, schema) {
  const target = path.join(outputDir, `${name}.schema.json`);
  fs.writeFileSync(target, `${JSON.stringify(schema, null, 2)}\n`, 'utf8');
  return target;
}

write('common', {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://athena.local/schemas/common.schema.json',
  title: 'Athena PRD common definitions',
  $defs: {
    sourceRef: {
      type: 'object',
      required: ['document_id', 'file_path'],
      properties: {
        document_id: { type: 'string', minLength: 1 },
        file_path: { type: 'string', minLength: 1 },
        doc_version: nullable('string'),
        sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
        section: { type: 'string' },
        line_start: nullable('integer'),
        line_end: nullable('integer'),
        page: nullable('integer'),
        paragraph_index: nullable('integer'),
        excerpt: { type: 'string' },
        table: { type: 'string' },
      },
    },
    base: {
      type: 'object',
      required: ['id', 'object_type', 'name', 'module', 'status', 'source_refs', 'created_by_parser_version', 'updated_at'],
      properties: {
        id: { type: 'string', minLength: 1 },
        object_type: { type: 'string' },
        name: { type: 'string' },
        module: { type: 'string' },
        status: { enum: ['ACTIVE', 'DRAFT', 'MISSING_SOURCE'] },
        schema_version: { type: 'string' },
        created_by_parser_version: { type: 'string' },
        updated_at: { type: 'string', minLength: 1 },
        source_refs: { type: 'array', items: { $ref: 'common.schema.json#/$defs/sourceRef' } },
      },
    },
  },
});

function typeSchema(name, title, properties, required = []) {
  return write(name, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://athena.local/schemas/${name}.schema.json`,
    title,
    allOf: [{ $ref: 'common.schema.json#/$defs/base' }],
    required: ['object_type', ...required],
    properties: {
      object_type: { const: title },
      ...properties,
    },
  });
}

function standaloneSchema(name, title, properties, required = []) {
  return write(name, {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: `https://athena.local/schemas/${name}.schema.json`,
    title,
    type: 'object',
    required: ['object_type', ...required],
    properties: {
      object_type: { const: title },
      schema_version: { type: 'string' },
      ...properties,
    },
  });
}

typeSchema('Document', 'Document', {
  file_path: { type: 'string', minLength: 1 },
  relative_path: { type: 'string', minLength: 1 },
  file_name: { type: 'string', minLength: 1 },
  sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  size_bytes: { type: 'integer', minimum: 0 },
  modified_at: { type: 'string' },
  title: { type: 'string' },
  doc_version: nullable('string'),
  doc_date: nullable('string'),
  doc_status: nullable('string'),
  prd_type: nullable('string'),
  business_object: nullable('string'),
  biz_model_no: nullable('string'),
  application: nullable('string'),
  entity_names: stringArray,
  section_count: { type: 'integer', minimum: 0 },
  table_count: { type: 'integer', minimum: 0 },
  last_scan_status: { enum: ['NEW', 'MODIFIED', 'UNCHANGED', 'SOURCE_MISSING'] },
  scanned_at: { type: 'string' },
  parser: { type: 'string' },
  source_role: { enum: ['PRD', 'TEST_CASE_LIBRARY'] },
  job_directory: { type: 'string' },
  supersedes: stringArray,
  superseded_by: nullable('string'),
  related_document_ids: stringArray,
  is_latest: { type: 'boolean' },
}, ['sha256', 'relative_path', 'last_scan_status', 'is_latest']);

typeSchema('Entity', 'Entity', {
  entity_no: nullable('string'),
  label: { type: 'string' },
  parent_entity_no: nullable('string'),
  document_ids: stringArray,
  field_count: { type: 'integer', minimum: 0 },
  page_count: { type: 'integer', minimum: 0 },
  rule_count: { type: 'integer', minimum: 0 },
}, ['label', 'document_ids']);

typeSchema('Page', 'Page', {
  page_type: { enum: ['LIST', 'FORM', 'TAB', 'MODAL', 'UNKNOWN'] },
  entity_id: nullable('string'),
  document_id: { type: 'string', minLength: 1 },
  parent_page_id: nullable('string'),
  menu_path: stringArray,
}, ['document_id', 'page_type']);

typeSchema('Field', 'Field', {
  field_no: nullable('string'),
  label: { type: 'string' },
  entity_id: nullable('string'),
  entity_no: nullable('string'),
  entity_label: nullable('string'),
  page_id: nullable('string'),
  document_id: { type: 'string', minLength: 1 },
  control_type: { type: 'string' },
  required: { type: 'boolean' },
  required_condition: nullable('string'),
  readonly: { type: 'boolean' },
  readonly_condition: nullable('string'),
  hidden: { type: 'boolean' },
  disabled: { type: 'boolean' },
  disabled_condition: nullable('string'),
  default_value: nullable('string'),
  default_timing: nullable('string'),
  lookup_desc: nullable('string'),
  options: stringArray,
  validation_text: nullable('string'),
  attributes: { type: 'object', additionalProperties: { type: 'string' } },
  attribute_lines: { type: 'object', additionalProperties: { type: 'integer' } },
  data_type: nullable('string'),
  length: nullable('integer'),
  precision: nullable('integer'),
  related_master_data: nullable('string'),
  confidence: { enum: CONFIDENCE },
  source_type: { enum: SOURCE_TYPES },
}, ['label', 'document_id', 'control_type']);

typeSchema('Control', 'Control', {
  control_type: { type: 'string' },
  field_id: nullable('string'),
  document_id: { type: 'string', minLength: 1 },
  evidence_text: nullable('string'),
}, ['document_id', 'control_type']);

typeSchema('Rule', 'Rule', {
  description: { type: 'string', minLength: 1 },
  rule_type: { enum: RULE_TYPES },
  source_type: { enum: SOURCE_TYPES },
  confidence: { enum: CONFIDENCE },
  applies_to: stringArray,
  field_no: nullable('string'),
  field_name: nullable('string'),
  trigger: nullable('string'),
  conditions: stringArray,
  expected_result: nullable('string'),
  derivation: nullable('string'),
  service_refs: stringArray,
  document_id: { type: 'string', minLength: 1 },
  open_question_ids: stringArray,
}, ['description', 'rule_type', 'source_type', 'confidence', 'document_id']);

typeSchema('Action', 'Action', {
  action_name: { type: 'string' },
  scope: { enum: ['HEADER', 'DETAIL', 'LIST', 'UNKNOWN'] },
  availability: nullable('string'),
  display_location: nullable('string'),
  pre_check: nullable('string'),
  processing: nullable('string'),
  post_processing: nullable('string'),
  apis: stringArray,
  phase_lines: { type: 'object', additionalProperties: { type: 'integer' } },
  document_id: { type: 'string', minLength: 1 },
}, ['action_name', 'document_id']);

typeSchema('Workflow', 'Workflow', {
  document_id: { type: 'string', minLength: 1 },
  entity_id: nullable('string'),
  steps: {
    type: 'array',
    items: {
      type: 'object',
      required: ['seq', 'step'],
      properties: {
        seq: { type: 'string' },
        step: { type: 'string' },
        description: { type: 'string' },
        exception: { type: 'string' },
        node_name: { type: 'string' },
        actor: { type: 'string' },
        precondition: { type: 'string' },
        output: { type: 'string' },
        next_step: { type: 'string' },
      },
    },
  },
}, ['document_id', 'steps']);

typeSchema('Dependency', 'Dependency', {
  source_id: { type: 'string', minLength: 1 },
  target_id: nullable('string'),
  target_ref: { type: 'string', minLength: 1 },
  relation_type: {
    enum: [
      'USES_MASTER_DATA', 'DERIVED_FROM', 'GENERATES', 'REFERENCES',
      'CONSUMES', 'RETURNS_TO', 'STATUS_TRANSITION', 'FIELD_DEPENDENCY', 'CANDIDATE_LINK',
    ],
  },
  mapping: nullable('string'),
  source_type: { enum: SOURCE_TYPES },
  confidence: { enum: CONFIDENCE },
  document_id: { type: 'string', minLength: 1 },
}, ['source_id', 'target_ref', 'relation_type', 'document_id']);

typeSchema('Scenario', 'Scenario', {
  title: { type: 'string', minLength: 1 },
  test_objective: { type: 'string' },
  scenario_type: { type: 'string' },
  status: { enum: ['DRAFT', 'REVIEW_REQUIRED', 'APPROVED', 'REJECTED', 'EXECUTABLE'] },
  automation_feasibility: { enum: ['UI_READY', 'NEEDS_UI_EXPLORATION', 'NEEDS_CONFIRMATION', 'NOT_UI_OBSERVABLE'] },
  business_object: nullable('string'),
  preconditions: stringArray,
  data_requirements: stringArray,
  steps: stringArray,
  assertions: {
    type: 'array',
    items: {
      type: 'object',
      required: ['type', 'target', 'expected'],
      properties: { type: { type: 'string' }, target: { type: 'string' }, expected: { type: 'string' } },
    },
  },
  expected_result: { type: 'string' },
  evidence_requirements: stringArray,
  rule_ids: stringArray,
  document_ids: stringArray,
  case_ids: stringArray,
  review_required: { type: 'boolean' },
  origin: { enum: ['GENERATED', 'EXISTING_CASE'] },
}, ['title', 'status', 'automation_feasibility', 'rule_ids']);

standaloneSchema('OpenQuestion', 'OpenQuestion', {
  id: { type: 'string', minLength: 1 },
  question: { type: 'string', minLength: 1 },
  category: {
    enum: [
      'VERSION_CONFLICT', 'RULE_CONFLICT', 'MISSING_EVIDENCE', 'MISSING_DEFINITION',
      'AMBIGUOUS_RULE', 'INCOMPLETE_STATE_MACHINE', 'BROKEN_FLOW', 'UNSUPPORTED_FORMAT',
      'PARSE_ERROR', 'SCENARIO_GAP', 'SOURCE_CONFLICT', 'SOURCE_MISSING', 'DUPLICATE_SOURCE',
      'EXCLUDED_SOURCE',
    ],
  },
  severity: { enum: ['HIGH', 'MEDIUM', 'LOW'] },
  document_ids: stringArray,
  evidence: stringArray,
  impact: { type: 'string' },
  suggested_owner: { type: 'string' },
  status: { enum: ['OPEN', 'CLOSED'] },
  created_at: { type: 'string' },
}, ['id', 'question', 'category', 'severity', 'status']);

standaloneSchema('ExistingCase', 'ExistingCase', {
  id: { type: 'string', minLength: 1 },
  case_id: { type: 'string', minLength: 1 },
  package: { type: 'string' },
  module: { type: 'string' },
  title: { type: 'string' },
  category: { type: 'string' },
  priority: { type: 'string' },
  rule_ids: stringArray,
  source_rule_ids: stringArray,
  object: nullable('string'),
  field: nullable('string'),
  field_no: nullable('string'),
  field_nos: stringArray,
  object_path: nullable('string'),
  needs_confirm: { type: 'boolean' },
  assertion_types: stringArray,
  document_id: { type: 'string' },
}, ['id', 'case_id', 'rule_ids', 'source_rule_ids']);

typeSchema('Evidence', 'Evidence', {
  evidence_id: { type: 'string', minLength: 1 },
  document_id: { type: 'string', minLength: 1 },
  doc_version: nullable('string'),
  sha256: { type: 'string', pattern: '^[a-f0-9]{64}$' },
  file_path: { type: 'string', minLength: 1 },
  section: nullable('string'),
  line_start: nullable('integer'),
  line_end: nullable('integer'),
  page: nullable('integer'),
  paragraph_index: nullable('integer'),
  excerpt: nullable('string'),
  verbatim: { type: 'boolean' },
  kind: { type: 'string' },
  referenced_by: stringArray,
}, ['evidence_id', 'document_id', 'sha256', 'file_path', 'line_start']);

process.stdout.write(`generated ${fs.readdirSync(outputDir).length} schema files in ${outputDir}\n`);
