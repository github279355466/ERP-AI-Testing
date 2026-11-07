import fs from 'node:fs';
import { PrdModelingConfig, resolveModuleName } from './config';
import {
  actionId,
  dependencyId,
  entityId,
  fieldId,
  pageId,
  questionId,
  ruleId,
  workflowId,
} from './ids';
import {
  findTableAfterLine,
  MarkdownDocument,
  parseMarkdown,
  parsePrdJsonPayload,
  PrdJsonPayload,
  tableToKeyValue,
} from './parsers';
import { ScannedFile } from './scanner';
import {
  Action,
  Confidence,
  Control,
  ControlType,
  Dependency,
  DocumentExtraction,
  DocumentRecord,
  Entity,
  Field,
  OpenQuestion,
  Page,
  PARSER_VERSION,
  ParseIssue,
  Rule,
  RuleType,
  SourceRef,
  SourceType,
  Workflow,
  WorkflowStep,
} from './types';

const FIELD_HEADING = /^#{3,5}\s+(.+?)\s*[（(]([A-Za-z0-9_.]+)[)）]\s*$/;
const API_PATTERN = /\b([a-z][a-z0-9_]*\.[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*)\b/g;
const PENDING_PATTERN = /待确认|待补充|TBD|暂定|待定|不确定/i;

function truncate(text: string, limit = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit)}…`;
}

function metadataValue(text: string, keys: string[]): string | null {
  for (const key of keys) {
    const pattern = new RegExp(`\\*\\*${key}\\*\\*\\s*[：:]\\s*(.+)`);
    const match = pattern.exec(text);
    if (match) return match[1].replace(/\*\*/g, '').trim();
  }
  return null;
}

function toSourceRef(
  document: DocumentRecord,
  section: string | null,
  lineStart: number | null,
  lineEnd: number | null,
  excerpt: string | null
): SourceRef {
  return {
    document_id: document.id,
    file_path: document.relative_path,
    section: section ?? undefined,
    line_start: lineStart ?? undefined,
    line_end: lineEnd ?? undefined,
    excerpt: excerpt ? truncate(excerpt, 160) : undefined,
  };
}

function splitItems(text: string | null): string[] {
  if (!text) return [];
  const items: string[] = [];
  for (const rawLine of text.split(/\r?\n|<br\s*\/?>/i)) {
    const line = rawLine.replace(/^\s*[-*•]\s*/, '').replace(/^\s*\d+[.、)]\s*/, '').trim();
    if (line.length < 3) continue;
    if (/^[-–—]+$/.test(line)) continue;
    items.push(line);
  }
  return items;
}

function classifyRule(text: string): RuleType {
  if (/必填|不可空白|不能为空|为空时/.test(text)) return 'REQUIRED';
  if (/只读|不可修改|不可编辑|不允许修改/.test(text)) return 'READONLY';
  if (/隐藏|不展示|不显示/.test(text)) return 'HIDDEN';
  if (/禁用|置灰|不可用|不可点击/.test(text)) return 'DISABLED';
  if (/默认|带出|预设/.test(text)) return 'DEFAULT_VALUE';
  if (/唯一|重复/.test(text)) return 'UNIQUENESS';
  if (/取位|小数位|精度|四舍五入/.test(text)) return 'PRECISION';
  if (/合计|金额|税额|计算|=\s*[^=]*[×*]/.test(text)) return 'CALCULATION';
  if (/状态(变为|迁移|流转)|状态机|审核后自动|撤审|作废|提交后|生效后/.test(text)) return 'STATE_TRANSITION';
  if (/权限|仅.*可|角色/.test(text)) return 'PERMISSION';
  if (/\bIF\b.*\bTHEN\b|联动|清空|带出到/.test(text)) return 'LINKAGE';
  if (/取单|回写|来源单据|上游|下游/.test(text)) return 'WORKFLOW';
  if (/调用.*接口|bm\.[a-z0-9_]+\.[a-z0-9_]+/.test(text)) return 'API_CONTRACT';
  return 'VALIDATION';
}

const FLAG_RESTATEMENT_HEAD = /^\s*(隐藏|只读|不可编辑|不可修改|不允许修改|禁用|置灰)/;
const FLAG_RESTATEMENT_EXTRA = /必填|校验|提示|拦截|报错|唯一|默认|限制|不得超过|不能大于|不能小于|应/;

function isFlagRestatement(text: string): boolean {
  return FLAG_RESTATEMENT_HEAD.test(text) && !FLAG_RESTATEMENT_EXTRA.test(text);
}

function controlTypeOf(fillMethod: string | null): ControlType {
  if (!fillMethod) return 'UNKNOWN';
  if (/开窗|\[F2\]|查询方案/.test(fillMethod)) return 'LOOKUP';
  if (/下拉|选择框|枚举/.test(fillMethod)) return 'DROPDOWN';
  if (/日期|date/i.test(fillMethod)) return 'DATE_PICKER';
  if (/勾选|开关|复选/.test(fillMethod)) return 'CHECKBOX';
  if (/单选框|单选按钮/.test(fillMethod)) return 'RADIO';
  if (/数字|金额|数量|数值|百分比/.test(fillMethod)) return 'NUMBER_INPUT';
  if (/表格|明细|列表/.test(fillMethod)) return 'GRID';
  if (/按钮/.test(fillMethod)) return 'BUTTON';
  if (/文本|输入框|手工|多行/.test(fillMethod)) return 'TEXT_INPUT';
  return 'UNKNOWN';
}

function truthyFlag(value: string | undefined): boolean {
  if (!value) return false;
  return /✅\s*是|^\s*是\s*$|^Y$|^true$/i.test(value);
}

function extractApis(text: string | null): string[] {
  if (!text) return [];
  const found = new Set<string>();
  for (const match of text.matchAll(API_PATTERN)) found.add(match[1]);
  return [...found];
}

interface DocumentMeta {
  title: string;
  prdType: string | null;
  version: string | null;
  businessObject: string | null;
  dataModel: string | null;
  application: string | null;
  docStatus: string | null;
  docDate: string | null;
}

function extractDocumentMeta(text: string, markdown: MarkdownDocument, fileName: string): DocumentMeta {
  const firstHeading = markdown.headings.find((heading) => heading.level === 1);
  const versionFromMeta = metadataValue(text, ['版本', '文档版本']);
  const versionFromName = /PRD[.\-_]v(\d+(?:\.\d+)*)/i.exec(fileName);
  const versionFromDocName = /_V(\d+(?:\.\d+)*)\.md$/i.exec(fileName);
  const version = versionFromMeta
    ? (versionFromMeta.replace(/^V/i, '').match(/\d+(?:\.\d+)*/)?.[0] ?? null)
    : versionFromName
      ? versionFromName[1]
      : versionFromDocName
        ? versionFromDocName[1]
      : null;

  let docDate = metadataValue(text, ['日期', '发布日期', '文档日期']);
  if (!docDate) {
    const changeLogTable = markdown.tables.find((table) =>
      table.sectionPath.some((item) => /变更日志|变更历史/.test(item))
    );
    if (changeLogTable) {
      const dateIndex = changeLogTable.header.findIndex((header) => /日期/.test(header));
      if (dateIndex >= 0) {
        const dates = changeLogTable.rows
          .map((row) => row.cells[dateIndex])
          .filter((value) => /^\d{4}-\d{2}-\d{2}$/.test(value))
          .sort();
        docDate = dates.length > 0 ? dates[dates.length - 1] : null;
      }
    }
  }

  return {
    title: firstHeading?.text ?? fileName.replace(/\.(md|markdown|txt)$/i, ''),
    prdType: metadataValue(text, ['PRD类型', '文档类型']),
    version,
    businessObject: metadataValue(text, ['业务对象', '业务实体']),
    dataModel: metadataValue(text, ['数据模型']),
    application: metadataValue(text, ['所属应用', '应用']),
    docStatus: metadataValue(text, ['文档状态']),
    docDate,
  };
}

interface EntitySeed {
  entityNo: string | null;
  label: string;
  parentEntityNo: string | null;
}

function extractEntitySeeds(meta: DocumentMeta, payload: PrdJsonPayload | null, folderName: string): EntitySeed[] {
  const seeds: EntitySeed[] = [];
  const seen = new Set<string>();
  const push = (entityNo: string | null, label: string, parent: string | null = null): void => {
    const key = `${entityNo ?? ''}|${label}`;
    if (!label || seen.has(key)) return;
    seen.add(key);
    seeds.push({ entityNo, label, parentEntityNo: parent });
  };
  if (payload?.bizModelNo) push(payload.bizModelNo, payload.bizModelName ?? folderName);
  if (meta.businessObject) {
    for (const part of meta.businessObject.split(/[、,，;；]/)) {
      const match = /([^\s（(]+)\s*[（(]([A-Za-z0-9_./]+)[)）]/.exec(part.trim());
      if (match) push(match[2], match[1].trim());
      else if (part.trim()) push(null, part.trim());
    }
  }
  if (meta.dataModel) {
    for (const rawPart of meta.dataModel.split(/[、,，/]/)) {
      const match = /`?([a-z][a-z0-9_]+)`?\s*(?:[（(]([^)）]+)[)）])?/i.exec(rawPart.trim());
      if (!match) continue;
      const labelHint = match[2] ?? '';
      const label = /单头|主表|表头/.test(labelHint) ? (payload?.bizModelName ?? folderName) : match[1];
      push(match[1], label);
    }
  }
  if (payload) {
    for (const attr of payload.attrs) {
      if (attr.entityNo) push(attr.entityNo, attr.entityLabel ?? attr.entityNo);
    }
  }
  if (seeds.length === 0) push(null, folderName);
  return seeds;
}

function buildDocument(
  file: ScannedFile,
  meta: DocumentMeta,
  markdown: MarkdownDocument | null,
  payload: PrdJsonPayload | null,
  config: PrdModelingConfig,
  now: string
): DocumentRecord {
  const moduleByDomain = file.domain_name ? resolveModuleName(config.prd.moduleRules, file.domain_name) : '其他';
  const module = moduleByDomain !== '其他'
    ? moduleByDomain
    : resolveModuleName(config.prd.moduleRules, file.job_directory || file.directory_name);
  const entityNames = (payload?.attrs ?? [])
    .map((attr) => attr.entityLabel)
    .filter((label): label is string => Boolean(label));
  return {
    id: file.document_id,
    object_type: 'Document',
    name: meta.title,
    module,
    status: 'ACTIVE',
    source_refs: [
      { document_id: file.document_id, file_path: file.relative_path, line_start: 1, excerpt: meta.title },
    ],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    file_path: file.absolute_path,
    relative_path: file.relative_path,
    file_name: file.file_name,
    sha256: file.sha256,
    size_bytes: file.size_bytes,
    modified_at: file.modified_at,
    title: meta.title,
    doc_version: meta.version,
    doc_date: meta.docDate,
    doc_status: meta.docStatus,
    prd_type: meta.prdType,
    business_object: meta.businessObject,
    biz_model_no: payload?.bizModelNo ?? null,
    application: meta.application ?? payload?.application ?? null,
    entity_names: [...new Set(entityNames)],
    section_count: markdown?.sections.length ?? 0,
    table_count: markdown?.tables.length ?? 0,
    last_scan_status: file.status,
    parser: markdown ? 'markdown' : 'json',
    source_role: file.role,
    job_directory: file.job_directory,
    is_latest: true,
  };
}

function buildEntities(document: DocumentRecord, seeds: EntitySeed[], now: string): Entity[] {
  return seeds.map((seed) => ({
    id: entityId(seed.entityNo ?? seed.label),
    object_type: 'Entity' as const,
    name: seed.label,
    module: document.module,
    status: 'ACTIVE' as const,
    source_refs: [toSourceRef(document, '业务对象', 1, null, seed.label)],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    entity_no: seed.entityNo,
    label: seed.label,
    parent_entity_no: seed.parentEntityNo,
    document_ids: [document.id],
    field_count: 0,
    page_count: 0,
    rule_count: 0,
  }));
}

function buildPages(
  document: DocumentRecord,
  markdown: MarkdownDocument,
  entities: Entity[],
  now: string
): Page[] {
  const pages: Page[] = [];
  const listPage = markdown.headings.find((heading) => /列表页$/.test(heading.text) && heading.level <= 4);
  const detailPage = markdown.headings.find((heading) => /详情页$/.test(heading.text) && heading.level <= 4);
  const parentEntity = entities[0]?.id ?? null;
  if (listPage) {
    pages.push({
      id: pageId(document.id, `list:${listPage.text}`),
      object_type: 'Page',
      name: listPage.text,
      module: document.module,
      status: 'ACTIVE',
      source_refs: [toSourceRef(document, listPage.text, listPage.line, null, listPage.text)],
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      page_type: 'LIST',
      entity_id: parentEntity,
      document_id: document.id,
      parent_page_id: null,
      menu_path: [],
    });
  }
  if (!detailPage) return pages;
  const detailId = pageId(document.id, `form:${detailPage.text}`);
  pages.push({
    id: detailId,
    object_type: 'Page',
    name: detailPage.text,
    module: document.module,
    status: 'ACTIVE',
    source_refs: [toSourceRef(document, detailPage.text, detailPage.line, null, detailPage.text)],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    page_type: 'FORM',
    entity_id: parentEntity,
    document_id: document.id,
    parent_page_id: null,
    menu_path: [],
  });
  const detailSection = markdown.sections.find((section) => section.title === detailPage.text);
  if (!detailSection) return pages;
  for (const section of markdown.sections) {
    if (section.level !== 4) continue;
    if (section.lineStart <= detailSection.lineStart || section.lineStart >= detailSection.lineEnd) continue;
    const label = section.title.replace(/^\d+[.、]\s*/, '').trim();
    if (!label || FIELD_HEADING.test(`#### ${section.title}`)) continue;
    const entity = entities.find((item) => item.label === label || item.name === label);
    pages.push({
      id: pageId(document.id, `tab:${label}`),
      object_type: 'Page',
      name: label,
      module: document.module,
      status: 'ACTIVE',
      source_refs: [toSourceRef(document, label, section.lineStart, section.lineEnd, label)],
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      page_type: 'TAB',
      entity_id: entity?.id ?? null,
      document_id: document.id,
      parent_page_id: detailId,
      menu_path: [],
    });
  }
  return pages;
}

interface FieldSeed {
  fieldNo: string;
  label: string;
  entityNo: string | null;
  tabLabel: string | null;
  controlType: ControlType;
  required: boolean;
  requiredCondition: string | null;
  readonly: boolean;
  readonlyCondition: string | null;
  hidden: boolean;
  disabled: boolean;
  disabledCondition: string | null;
  defaultValue: string | null;
  defaultTiming: string | null;
  lookupDesc: string | null;
  options: string[];
  validationText: string | null;
  line: number;
  section: string;
}

type FieldAttributes = Omit<FieldSeed, 'fieldNo' | 'label' | 'line' | 'section' | 'tabLabel' | 'entityNo'>;

function parseFieldTable(map: Map<string, string>): FieldAttributes | null {
  if (!map.has('字段项') && !map.has('标题名')) return null;
  const defaultValue = map.get('默认值') ?? null;
  const timingMatch = defaultValue ? /时机点[：:]\s*(.+)$/.exec(defaultValue) : null;
  const optionsRaw = map.get('下拉项') ?? '';
  const lookupRaw = map.get('开窗说明')?.trim() || map.get('开窗类型')?.trim() || null;
  return {
    controlType: controlTypeOf(map.get('填值方式') ?? null),
    required: truthyFlag(map.get('是否必填')),
    requiredCondition: map.get('必填条件')?.trim() || null,
    readonly: truthyFlag(map.get('是否只读')),
    readonlyCondition: map.get('只读条件')?.trim() || null,
    hidden: truthyFlag(map.get('是否隐藏')),
    disabled: truthyFlag(map.get('是否禁用')),
    disabledCondition: map.get('禁用条件')?.trim() || null,
    defaultValue: defaultValue?.trim() || null,
    defaultTiming: timingMatch ? timingMatch[1].trim() : null,
    lookupDesc: lookupRaw && !/^无$/.test(lookupRaw) ? lookupRaw : null,
    options: optionsRaw
      .split(/[、,，;；|]/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0 && item !== '-'),
    validationText: map.get('校验项')?.trim() || map.get('输入说明')?.trim() || null,
  };
}

function extractFieldSeeds(markdown: MarkdownDocument): FieldSeed[] {
  const seeds: FieldSeed[] = [];
  const seen = new Set<string>();
  let currentTab: string | null = null;
  for (const heading of markdown.headings) {
    if (heading.level === 4 && !FIELD_HEADING.test(`#### ${heading.text}`)) {
      currentTab = heading.text.replace(/^\d+[.、]\s*/, '').trim();
      continue;
    }
    if (heading.level < 3 || heading.level > 5) continue;
    const match = FIELD_HEADING.exec(`#### ${heading.text}`);
    if (!match) continue;
    const fieldNo = match[2].trim();
    if (seen.has(fieldNo)) continue;
    const table = findTableAfterLine(markdown, heading.line, 6);
    if (!table) continue;
    const parsed = parseFieldTable(tableToKeyValue(table));
    if (!parsed) continue;
    seen.add(fieldNo);
    seeds.push({
      ...parsed,
      fieldNo,
      label: match[1].trim(),
      entityNo: null,
      tabLabel: currentTab,
      line: heading.line,
      section: heading.text,
    });
  }
  return seeds;
}

function seedsFromPayload(payload: PrdJsonPayload): FieldSeed[] {
  return payload.attrs.map((attr) => {
    const fillMethod = attr.lookupDesc ? '开窗' : attr.options.length > 0 ? '下拉选择' : null;
    return {
      fieldNo: attr.fieldNo,
      label: attr.title ?? attr.fieldName,
      entityNo: attr.entityNo,
      tabLabel: attr.entityLabel,
      controlType: controlTypeOf(fillMethod),
      required: attr.required,
      requiredCondition: attr.requiredCondition,
      readonly: attr.readonly,
      readonlyCondition: attr.readonlyCondition,
      hidden: attr.hidden,
      disabled: attr.disabled,
      disabledCondition: attr.disabledCondition,
      defaultValue: attr.defaultValue,
      defaultTiming: null,
      lookupDesc: attr.lookupDesc,
      options: attr.options,
      validationText: attr.validation ?? attr.inputDesc,
      line: 1,
      section: attr.entityLabel ?? '字段配置',
    };
  });
}

function buildFields(
  document: DocumentRecord,
  seeds: FieldSeed[],
  entities: Entity[],
  pages: Page[],
  now: string
): { fields: Field[]; controls: Control[] } {
  const fields: Field[] = [];
  const controls: Control[] = [];
  const tabPages = pages.filter((page) => page.page_type === 'TAB');
  const detailPage = pages.find((page) => page.page_type === 'FORM') ?? null;

  for (const seed of seeds) {
    let entity: Entity | undefined;
    if (seed.entityNo) entity = entities.find((item) => item.entity_no === seed.entityNo);
    if (!entity && seed.tabLabel) {
      entity = entities.find((item) => item.label === seed.tabLabel || item.name === seed.tabLabel);
    }
    if (!entity && entities.length === 1) entity = entities[0];
    const tabPage = seed.tabLabel ? tabPages.find((page) => page.name === seed.tabLabel) : undefined;
    const id = fieldId(document.id, entity?.entity_no ?? seed.entityNo, seed.fieldNo, seed.label);
    const pending =
      PENDING_PATTERN.test(seed.validationText ?? '') || PENDING_PATTERN.test(seed.requiredCondition ?? '');
    const field: Field = {
      id,
      object_type: 'Field',
      name: seed.label,
      module: document.module,
      status: 'ACTIVE',
      source_refs: [toSourceRef(document, seed.section, seed.line, null, `${seed.label} (${seed.fieldNo})`)],
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      field_no: seed.fieldNo,
      label: seed.label,
      entity_id: entity?.id ?? null,
      entity_no: entity?.entity_no ?? seed.entityNo,
      entity_label: entity?.label ?? seed.tabLabel,
      page_id: tabPage?.id ?? detailPage?.id ?? null,
      document_id: document.id,
      control_type: seed.controlType,
      required: seed.required,
      required_condition: seed.requiredCondition,
      readonly: seed.readonly,
      readonly_condition: seed.readonlyCondition,
      hidden: seed.hidden,
      disabled: seed.disabled,
      disabled_condition: seed.disabledCondition,
      default_value: seed.defaultValue,
      default_timing: seed.defaultTiming,
      lookup_desc: seed.lookupDesc,
      options: seed.options,
      validation_text: seed.validationText,
      data_type: null,
      length: null,
      precision: null,
      related_master_data: extractApis(seed.lookupDesc)[0] ?? null,
      confidence: pending ? 'AMBIGUOUS' : 'CONFIRMED',
      source_type: pending ? 'PENDING' : 'PRD_EXPLICIT',
    };
    fields.push(field);
    controls.push({
      id: `CTL-${id.slice(4)}`,
      object_type: 'Control',
      name: `${seed.label} 控件`,
      module: document.module,
      status: 'ACTIVE',
      source_refs: field.source_refs,
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      control_type: seed.controlType,
      field_id: field.id,
      document_id: document.id,
      evidence_text: seed.lookupDesc ?? seed.validationText,
    });
  }
  return { fields, controls };
}

function makeRule(
  document: DocumentRecord,
  key: string,
  name: string,
  description: string,
  ruleType: RuleType,
  field: Field | null,
  entity: Entity | null,
  trigger: string | null,
  expected: string,
  section: string | null,
  line: number | null,
  derivation: string | null
): Rule {
  const pending = PENDING_PATTERN.test(description);
  return {
    id: ruleId(document.id, key),
    object_type: 'Rule',
    name,
    module: document.module,
    status: 'ACTIVE',
    source_refs: [toSourceRef(document, section, line, null, description)],
    created_by_parser_version: PARSER_VERSION,
    updated_at: document.updated_at,
    description: truncate(description, 300),
    rule_type: ruleType,
    source_type: pending ? 'PENDING' : derivation ? 'PRD_DERIVED' : 'PRD_EXPLICIT',
    confidence: pending ? 'AMBIGUOUS' : derivation ? 'DERIVED' : 'CONFIRMED',
    applies_to: entity ? [entity.id] : [],
    field_no: field?.field_no ?? null,
    field_name: field?.label ?? null,
    trigger,
    conditions: [],
    expected_result: truncate(expected, 200),
    derivation,
    document_id: document.id,
    open_question_ids: [],
  };
}

function buildFieldRules(
  document: DocumentRecord,
  fields: Field[],
  entities: Entity[],
  limit: number
): Rule[] {
  const rules: Rule[] = [];
  for (const field of fields) {
    if (rules.length >= limit) break;
    const entity = entities.find((item) => item.id === field.entity_id) ?? null;
    const ref = field.source_refs[0];
    const line = ref?.line_start ?? null;
    const section = ref?.section ?? null;
    const base = `${field.entity_no ?? ''}.${field.field_no ?? field.label}`;
    if (field.required) {
      rules.push(
        makeRule(
          document,
          `${base}|REQUIRED`,
          `${field.label} 必填`,
          `【${field.label}(${field.field_no ?? ''})】必填${field.required_condition ? `：${field.required_condition}` : ''}`,
          'REQUIRED',
          field,
          entity,
          'SAVE',
          '为空时保存应被拦截',
          section,
          line,
          field.required_condition ? null : '由「是否必填=是」直接映射'
        )
      );
    }
    if (field.readonly) {
      rules.push(
        makeRule(
          document,
          `${base}|READONLY`,
          `${field.label} 只读`,
          `【${field.label}(${field.field_no ?? ''})】只读${field.readonly_condition ? `：${field.readonly_condition}` : ''}`,
          'READONLY',
          field,
          entity,
          'FORM_OPEN',
          '字段不可编辑',
          section,
          line,
          null
        )
      );
    }
    if (field.hidden) {
      rules.push(
        makeRule(
          document,
          `${base}|HIDDEN`,
          `${field.label} 隐藏`,
          `【${field.label}(${field.field_no ?? ''})】隐藏`,
          'HIDDEN',
          field,
          entity,
          'FORM_OPEN',
          '字段不展示',
          section,
          line,
          null
        )
      );
    }
    if (field.disabled && field.disabled_condition) {
      rules.push(
        makeRule(
          document,
          `${base}|DISABLED`,
          `${field.label} 禁用`,
          `【${field.label}(${field.field_no ?? ''})】禁用条件：${field.disabled_condition}`,
          'DISABLED',
          field,
          entity,
          'FORM_OPEN',
          '条件成立时字段不可用',
          section,
          line,
          null
        )
      );
    }
    if (field.default_value) {
      rules.push(
        makeRule(
          document,
          `${base}|DEFAULT`,
          `${field.label} 默认值`,
          `【${field.label}(${field.field_no ?? ''})】默认值：${field.default_value}`,
          'DEFAULT_VALUE',
          field,
          entity,
          field.default_timing ?? 'FORM_OPEN',
          `默认值：${truncate(field.default_value, 80)}`,
          section,
          line,
          null
        )
      );
    }
    if (field.lookup_desc) {
      rules.push(
        makeRule(
          document,
          `${base}|LOOKUP`,
          `${field.label} 开窗`,
          `【${field.label}(${field.field_no ?? ''})】开窗：${field.lookup_desc}`,
          'LOOKUP',
          field,
          entity,
          'EDIT',
          `开窗：${(/开窗标题[：:]\s*([^\n<]+)/.exec(field.lookup_desc)?.[1] ?? '按开窗说明').trim()}`,
          section,
          line,
          null
        )
      );
    }
    if (field.validation_text) {
      const items = splitItems(field.validation_text).filter((item) => !isFlagRestatement(item));
      for (const [index, item] of items.slice(0, 4).entries()) {
        rules.push(
          makeRule(
            document,
            `${base}|VALIDATION|${index}`,
            `${field.label} 校验`,
            `【${field.label}(${field.field_no ?? ''})】${item}`,
            classifyRule(item),
            field,
            entity,
            'SAVE',
            '按校验规则拦截或提示',
            section,
            line,
            null
          )
        );
        if (rules.length >= limit) break;
      }
    }
  }
  return rules;
}

function buildActions(document: DocumentRecord, markdown: MarkdownDocument, now: string): Action[] {
  const actions: Action[] = [];
  const seen = new Set<string>();
  for (const section of markdown.sections) {
    if (!section.path.some((item) => /操作说明|操作/.test(item))) continue;
    if (section.level < 3) continue;
    const table = markdown.tables.find(
      (item) => item.lineStart > section.lineStart && item.lineStart <= section.lineEnd + 1
    );
    if (!table) continue;
    const map = tableToKeyValue(table);
    if (!table.header.includes('控制项')) continue;
    const name = section.title.replace(/^\d+[.、]\s*/, '').trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    const preCheck = map.get('操作前校验') ?? null;
    const processing = map.get('操作中处理') ?? null;
    const post = map.get('操作后处理') ?? null;
    actions.push({
      id: actionId(document.id, name),
      object_type: 'Action',
      name,
      module: document.module,
      status: 'ACTIVE',
      source_refs: [toSourceRef(document, name, section.lineStart, section.lineEnd, name)],
      created_by_parser_version: PARSER_VERSION,
      updated_at: now,
      action_name: name,
      scope: section.path.some((item) => /明细操作/.test(item)) ? 'DETAIL' : 'HEADER',
      availability: map.get('可用条件') ?? null,
      display_location: map.get('展示设置') ?? null,
      pre_check: preCheck,
      processing,
      post_processing: post,
      apis: [...new Set([...extractApis(preCheck), ...extractApis(processing), ...extractApis(post)])],
      document_id: document.id,
    });
  }
  return actions;
}

function actionsFromPayload(document: DocumentRecord, payload: PrdJsonPayload, now: string): Action[] {
  return payload.operations.map((operation) => ({
    id: actionId(document.id, operation.name),
    object_type: 'Action' as const,
    name: operation.name,
    module: document.module,
    status: 'ACTIVE' as const,
    source_refs: [toSourceRef(document, operation.name, 1, null, operation.name)],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    action_name: operation.name,
    scope: 'HEADER' as const,
    availability: operation.availability,
    display_location: operation.displaySettings.join('、') || null,
    pre_check: operation.preCheck,
    processing: operation.processing,
    post_processing: operation.postAction,
    apis: [
      ...new Set([
        ...extractApis(operation.preCheck),
        ...extractApis(operation.processing),
        ...extractApis(operation.postAction),
      ]),
    ],
    document_id: document.id,
  }));
}

function buildActionRules(document: DocumentRecord, actions: Action[], limit: number): Rule[] {
  if (limit <= 0) return [];
  const ruleish = /必填|只读|禁用|置灰|不可|不能|须|必须|校验|IF|THEN|ELSE|E\+MSG|提示|回写|取单|调用|唯一|默认|带出|清空|Enable|Disable/i;
  const rules: Rule[] = [];
  for (const action of actions) {
    if (rules.length >= limit) break;
    const phases: Array<[string, string | null]> = [
      ['AVAILABILITY', action.availability],
      ['PRECHECK', action.pre_check],
      ['PROCESSING', action.processing],
      ['POST', action.post_processing],
    ];
    for (const [phase, text] of phases) {
      const items = splitItems(text).filter((item) => {
        if (phase === 'AVAILABILITY') return item.length >= 3;
        if (phase === 'PRECHECK') return true;
        return ruleish.test(item);
      });
      for (const [index, item] of items.slice(0, 3).entries()) {
        const label =
          phase === 'PRECHECK' ? '前置校验' : phase === 'POST' ? '后置处理' : phase === 'AVAILABILITY' ? '可用条件' : '处理';
        const ruleType: RuleType =
          phase === 'AVAILABILITY'
            ? 'PERMISSION'
            : /取单|回写|来源单据/.test(item)
              ? 'WORKFLOW'
              : classifyRule(item);
        rules.push(
          makeRule(
            document,
            `${action.action_name}|${phase}|${index}`,
            `${action.action_name} ${label}`,
            `【${action.action_name}】${item}`,
            ruleType,
            null,
            null,
            action.action_name,
            phase === 'PRECHECK' ? '校验不通过则操作被拦截' : '按操作说明执行',
            action.name,
            action.source_refs[0]?.line_start ?? null,
            phase === 'PROCESSING' ? '由操作说明中的处理步骤映射' : null
          )
        );
        if (rules.length >= limit) return rules;
      }
    }
  }
  return rules;
}

function buildWorkflow(
  document: DocumentRecord,
  markdown: MarkdownDocument,
  entities: Entity[],
  now: string
): Workflow | null {
  const table = markdown.tables.find(
    (item) => item.sectionPath.some((section) => /业务流程图|流程图/.test(section)) && item.rows.length >= 2
  );
  if (!table) return null;
  const indexOf = (pattern: RegExp): number => table.header.findIndex((header) => pattern.test(header));
  const seqIndex = indexOf(/^序|序号|步骤/);
  const stepIndex = indexOf(/环节|步骤|节点/);
  const descIndex = indexOf(/说明|描述|内容/);
  const exceptionIndex = indexOf(/异常|分支|备注/);
  if (stepIndex < 0 && descIndex < 0) return null;
  const steps: WorkflowStep[] = table.rows
    .map((row, rowIndex) => ({
      seq: seqIndex >= 0 ? row.cells[seqIndex] ?? String(rowIndex + 1) : String(rowIndex + 1),
      step: stepIndex >= 0 ? row.cells[stepIndex] ?? '' : '',
      description: descIndex >= 0 ? row.cells[descIndex] ?? '' : '',
      exception: exceptionIndex >= 0 ? row.cells[exceptionIndex] ?? '' : '',
    }))
    .filter((step) => step.step || step.description);
  if (steps.length === 0) return null;
  return {
    id: workflowId(document.id),
    object_type: 'Workflow',
    name: `${document.title} 业务流程`,
    module: document.module,
    status: 'ACTIVE',
    source_refs: [toSourceRef(document, '业务流程图', table.lineStart, table.lineEnd, '业务流程图')],
    created_by_parser_version: PARSER_VERSION,
    updated_at: now,
    document_id: document.id,
    entity_id: entities[0]?.id ?? null,
    steps,
  };
}

function buildDependencies(
  document: DocumentRecord,
  markdown: MarkdownDocument,
  now: string
): Dependency[] {
  const dependencies: Dependency[] = [];
  const seen = new Set<string>();
  const keywords = /取单|来源单据|上游|下游|回写|关联|引用/;
  for (const table of markdown.tables) {
    if (!table.sectionPath.some((section) => keywords.test(section))) continue;
    for (const row of table.rows.slice(0, 30)) {
      const text = row.cells.join(' ');
      const targets = [...extractApis(text), ...[...text.matchAll(/`([a-z][a-z0-9_]{2,})`/g)].map((m) => m[1])];
      for (const target of targets) {
        if (seen.has(target)) continue;
        seen.add(target);
        dependencies.push({
          id: dependencyId(document.id, `dep:${target}`),
          object_type: 'Dependency',
          name: `${document.title} → ${target}`,
          module: document.module,
          status: 'ACTIVE',
          source_refs: [toSourceRef(document, table.sectionPath.join(' / '), row.line, null, text)],
          created_by_parser_version: PARSER_VERSION,
          updated_at: now,
          source_id: document.id,
          target_id: null,
          target_ref: target,
          relation_type: 'REFERENCES',
          mapping: null,
          source_type: 'PRD_DERIVED',
          confidence: 'DERIVED',
          document_id: document.id,
        });
      }
      if (dependencies.length >= 30) return dependencies;
    }
  }
  return dependencies;
}

function buildStateRules(
  document: DocumentRecord,
  markdown: MarkdownDocument,
  entities: Entity[],
  now: string
): Rule[] {
  const rules: Rule[] = [];
  for (const table of markdown.tables) {
    if (!table.sectionPath.some((section) => /状态机|状态迁移|状态流转/.test(section))) continue;
    const header = table.header;
    const fromIndex = header.findIndex((cell) => /当前状态|原状态|起始状态|来源状态/.test(cell));
    const toIndex = header.findIndex((cell) => /目标状态|新状态|变更后|结果状态|下一状态/.test(cell));
    const flowIndex = header.findIndex((cell) => /流转|迁移|变化/.test(cell));
    const actionIndex = header.findIndex((cell) => /操作|动作|事件|按钮|触发/.test(cell));
    if (actionIndex < 0) continue;
    if (fromIndex < 0 && toIndex < 0 && flowIndex < 0) continue;
    for (const row of table.rows) {
      const action = (row.cells[actionIndex] ?? '').trim();
      if (!action) continue;
      let from = fromIndex >= 0 ? (row.cells[fromIndex] ?? '').trim() : '';
      let to = toIndex >= 0 ? (row.cells[toIndex] ?? '').trim() : '';
      if ((!from || !to) && flowIndex >= 0) {
        const flow = row.cells[flowIndex] ?? '';
        const match = /(.+?)\s*(?:→|->|=>)\s*(.+)/.exec(flow);
        if (match) {
          from = from || match[1].trim();
          to = to || match[2].trim();
        }
      }
      rules.push(
        makeRule(
          document,
          `STATE|${action}|${from}|${to}`,
          `状态迁移 ${action}`,
          `状态迁移：${from || '*'} --[${action}]--> ${to || '*'}`,
          'STATE_TRANSITION',
          null,
          entities[0] ?? null,
          action,
          `状态变为 ${to || '按状态机表格'}`,
          table.sectionPath.join(' / '),
          row.line,
          from || to ? null : '状态机表格缺少状态列'
        )
      );
      if (rules.length >= 60) return rules;
    }
  }
  return rules;
}

function buildOpenQuestions(
  document: DocumentRecord,
  entities: Entity[],
  fields: Field[],
  rules: Rule[],
  now: string
): OpenQuestion[] {
  const questions: OpenQuestion[] = [];
  if (entities.length === 0) {
    questions.push({
      id: questionId(`${document.id}|no-entity`),
      object_type: 'OpenQuestion',
      question: '文档未识别出业务实体，需确认业务对象与模型名',
      category: 'MISSING_DEFINITION',
      severity: 'MEDIUM',
      document_ids: [document.id],
      evidence: [document.relative_path],
      impact: '字段与规则无法归属实体，覆盖率统计不完整',
      suggested_owner: 'PRD 作者',
      status: 'OPEN',
      created_at: now,
    });
  }
  const counts = new Map<string, number>();
  for (const field of fields) {
    if (!field.field_no) continue;
    counts.set(field.field_no, (counts.get(field.field_no) ?? 0) + 1);
  }
  for (const [fieldNo, count] of counts) {
    if (count < 2) continue;
    questions.push({
      id: questionId(`${document.id}|dup|${fieldNo}`),
      object_type: 'OpenQuestion',
      question: `字段码 ${fieldNo} 在同一文档出现 ${count} 次，需确认是否属于不同页签或子对象`,
      category: 'MISSING_DEFINITION',
      severity: 'LOW',
      document_ids: [document.id],
      evidence: [document.relative_path],
      impact: '字段定位可能歧义',
      suggested_owner: 'PRD 作者',
      status: 'OPEN',
      created_at: now,
    });
  }
  for (const rule of rules.filter((item) => item.confidence === 'AMBIGUOUS').slice(0, 20)) {
    questions.push({
      id: questionId(`${rule.id}|ambiguous`),
      object_type: 'OpenQuestion',
      question: `规则描述含待确认表述：${rule.name}`,
      category: 'AMBIGUOUS_RULE',
      severity: 'MEDIUM',
      document_ids: [document.id],
      evidence: rule.source_refs.map((ref) => `${ref.file_path}:${ref.line_start ?? ''}`),
      impact: '无法直接生成可执行断言',
      suggested_owner: 'PRD 作者 / 业务',
      status: 'OPEN',
      created_at: now,
    });
  }
  return questions;
}

export function extractPrdDocument(
  file: ScannedFile,
  config: PrdModelingConfig,
  now: string
): DocumentExtraction {
  const text = fs.readFileSync(file.absolute_path, 'utf8');
  const issues: ParseIssue[] = [];
  const isJson = file.extension === '.json';
  let markdown: MarkdownDocument | null = null;
  let payload: PrdJsonPayload | null = null;

  if (isJson) {
    payload = parsePrdJsonPayload(text);
    if (!payload) {
      issues.push({
        file_path: file.relative_path,
        document_id: file.document_id,
        parser: 'json',
        stage: 'parse',
        message: 'JSON 不是平台 prd_spec 结构，未提取知识对象',
        line: null,
      });
    }
  } else {
    markdown = parseMarkdown(text);
    if (markdown.headings.length === 0) {
      issues.push({
        file_path: file.relative_path,
        document_id: file.document_id,
        parser: 'markdown',
        stage: 'parse',
        message: '未识别到 Markdown 标题',
        line: null,
      });
    }
  }

  const meta: DocumentMeta = markdown
    ? extractDocumentMeta(text, markdown, file.file_name)
    : {
        title: payload?.bizModelName ?? file.file_name,
        prdType: null,
        version: /-v(\d+(?:\.\d+)*)/i.exec(file.file_name)?.[1] ?? payload?.version ?? null,
        businessObject: payload?.bizModelName ?? null,
        dataModel: payload?.bizModelNo ?? null,
        application: payload?.application ?? null,
        docStatus: null,
        docDate: payload?.changeLog.at(-1)?.date ?? null,
      };

  const document = buildDocument(file, meta, markdown, payload, config, now);
  const seeds = extractEntitySeeds(meta, payload, file.directory_name);
  const entities = buildEntities(document, seeds, now);
  const pages = markdown ? buildPages(document, markdown, entities, now) : [];
  const fieldSeeds = markdown ? extractFieldSeeds(markdown) : payload ? seedsFromPayload(payload) : [];
  const { fields, controls } = buildFields(document, fieldSeeds, entities, pages, now);
  const actions = markdown
    ? buildActions(document, markdown, now)
    : payload
      ? actionsFromPayload(document, payload, now)
      : [];
  const limit = config.policy.maxRulesPerDocument;
  const fieldRules = buildFieldRules(document, fields, entities, Math.floor(limit * 0.75));
  const stateRules = markdown ? buildStateRules(document, markdown, entities, now) : [];
  const rules = [
    ...fieldRules,
    ...stateRules.slice(0, Math.max(0, limit - fieldRules.length)),
    ...buildActionRules(document, actions, limit - fieldRules.length - stateRules.length),
  ];
  const workflows = markdown
    ? [buildWorkflow(document, markdown, entities, now)].filter((item): item is Workflow => item !== null)
    : [];
  const dependencies = markdown ? buildDependencies(document, markdown, now) : [];
  const openQuestions = buildOpenQuestions(document, entities, fields, rules, now);

  for (const entity of entities) {
    entity.field_count = fields.filter((field) => field.entity_id === entity.id).length;
    entity.page_count = pages.filter((page) => page.entity_id === entity.id).length;
    entity.rule_count = rules.filter((rule) => rule.applies_to.includes(entity.id)).length;
  }

  return {
    document,
    entities,
    pages,
    fields,
    controls,
    rules,
    actions,
    workflows,
    dependencies,
    openQuestions,
    issues,
  };
}
