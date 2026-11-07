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

const DOCUMENT_LINES = new WeakMap<DocumentRecord, string[]>();

function rawLineOf(document: DocumentRecord, line: number | null): string | null {
  if (!line) return null;
  const lines = DOCUMENT_LINES.get(document);
  const raw = lines?.[line - 1];
  return raw === undefined ? null : raw.trim();
}

function truncate(text: string, limit = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length <= limit ? compact : `${compact.slice(0, limit)}…`;
}

function stripTrailingEllipsis(text: string): string {
  return text.replace(/…+$/, '').trim();
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
  const verbatim = rawLineOf(document, lineStart);
  const composed = excerpt ? truncate(excerpt, 160) : undefined;
  let evidenceExcerpt = composed;
  if (verbatim && verbatim.length > 0 && composed && !verbatim.includes(stripTrailingEllipsis(composed))) {
    const key = /\(([A-Za-z0-9_.]{2,40})\)/.exec(composed)?.[1];
    const index = key ? verbatim.indexOf(`"${key}"`) : -1;
    evidenceExcerpt = index >= 0
      ? verbatim.slice(Math.max(0, index - 80), Math.min(verbatim.length, index + 180))
      : verbatim.slice(0, 200);
  }
  return {
    document_id: document.id,
    file_path: document.relative_path,
    doc_version: document.doc_version,
    sha256: document.sha256,
    section: section ?? undefined,
    line_start: lineStart ?? undefined,
    line_end: lineEnd ?? undefined,
    page: null,
    paragraph_index: null,
    excerpt: verbatim && verbatim.length > 0 ? evidenceExcerpt ?? verbatim.slice(0, 200) : composed,
    table: section ?? undefined,
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
  const document: DocumentRecord = {
    id: file.document_id,
    object_type: 'Document',
    name: meta.title,
    module,
    status: 'ACTIVE',
    source_refs: [
      {
        document_id: file.document_id,
        file_path: file.relative_path,
        doc_version: meta.version,
        sha256: file.sha256,
        line_start: 1,
        excerpt: meta.title,
      },
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
    scanned_at: now,
    parser: markdown ? 'markdown' : 'json',
    source_role: file.role,
    job_directory: file.job_directory,
    supersedes: [],
    superseded_by: null,
    related_document_ids: [],
    is_latest: false,
  };
  if (markdown) {
    DOCUMENT_LINES.set(document, markdown.lines);
  } else {
    try {
      DOCUMENT_LINES.set(document, fs.readFileSync(file.absolute_path, 'utf8').split(/\r?\n/));
    } catch {
      DOCUMENT_LINES.set(document, []);
    }
  }
  return document;
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
  attributes: Record<string, string>;
  attributeLines: Record<string, number>;
  line: number;
  section: string;
}

type FieldAttributes = Omit<
  FieldSeed,
  'fieldNo' | 'label' | 'line' | 'section' | 'tabLabel' | 'entityNo' | 'attributeLines'
>;

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
    attributes: Object.fromEntries([...map.entries()].filter(([, value]) => value.trim().length > 0)),
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
    const attributeLines: Record<string, number> = {};
    for (const row of table.rows) {
      const key = (row.cells[0] ?? '').trim();
      if (key && !attributeLines[key]) attributeLines[key] = row.line;
    }
    seen.add(fieldNo);
    seeds.push({
      ...parsed,
      attributeLines,
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
      attributes: {
        ...(attr.title ? { 标题名: attr.title } : {}),
        ...(attr.requiredCondition ? { 必填条件: attr.requiredCondition } : {}),
        ...(attr.readonlyCondition ? { 只读条件: attr.readonlyCondition } : {}),
        ...(attr.validation ? { 校验项: attr.validation } : {}),
      },
      attributeLines: { 字段项: 1 },
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
      attributes: seed.attributes,
      attribute_lines: seed.attributeLines,
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
  derivation: string | null,
  sourceType?: SourceType,
  conditions: string[] = []
): Rule {
  const pending = PENDING_PATTERN.test(description);
  const resolved: SourceType = pending
    ? 'PENDING'
    : sourceType ?? (derivation ? 'PRD_DERIVED' : 'PRD_EXPLICIT');
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
    source_type: resolved,
    confidence: pending ? 'AMBIGUOUS' : resolved === 'PRD_EXPLICIT' ? 'CONFIRMED' : 'DERIVED',
    applies_to: entity ? [entity.id] : [],
    field_no: field?.field_no ?? null,
    field_name: field?.label ?? null,
    trigger,
    conditions,
    expected_result: truncate(expected, 200),
    derivation,
    service_refs: [...new Set([...description.matchAll(API_PATTERN)].map((match) => match[0]))],
    document_id: document.id,
    open_question_ids: [],
  };
}

const PLACEHOLDER_TEXT = /^(无|无。|无（[^）]*）|无\([^)]*\)|-|—|\/|不适用|n\/a|none|null)$/i;
const EXAMPLE_TEXT = /^(例|示例|例如|如)[:：]/;
const API_FRAGMENT = /^(入参|回参|出参|入参说明|回参说明|返回参数|返回)[:：]/;
const RULE_LIKE = /必须|须|不得|不可|不能|禁止|校验|限制|格式|唯一|重复|大于|小于|不超过|不少于|大于等于|小于等于|>=|<=|等于|默认|带出|回写|提示|报错|拦截|只读|隐藏|禁用|计算|换算/;

function isPlaceholderValue(text: string): boolean {
  const value = text.trim();
  return value.length === 0 || PLACEHOLDER_TEXT.test(value);
}

function toConditions(...values: Array<string | null | undefined>): string[] {
  const conditions: string[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(/[\n；;]/)) {
      const item = part.trim().replace(/^[-*•]\s*/, '');
      if (!item || isPlaceholderValue(item) || conditions.includes(item)) continue;
      conditions.push(item);
    }
  }
  return conditions.slice(0, 5);
}

function extractConditionClauses(text: string | null): string[] {
  if (!text) return [];
  return text
    .split(/[。\n；;]/)
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && /(当|若|如果|一旦|只有|满足)[^，,]{1,60}(时|后|情况下)?/.test(item))
    .slice(0, 3);
}

function splitValidationItems(text: string): string[] {
  const segments = text
    .split(/\r?\n|<br\s*\/?>/i)
    .map((segment) => segment.replace(/^\s*[-*•]\s*/, '').trim())
    .filter((segment) => segment.length > 0);
  const items: string[] = [];
  for (const segment of segments) {
    if (items.length > 0 && (API_FRAGMENT.test(segment) || /^(其中|接口|说明)[:：]/.test(segment))) {
      items[items.length - 1] = `${items[items.length - 1]}；${segment}`;
      continue;
    }
    items.push(segment.replace(/^\s*\d+[.、)]\s*/, '').trim());
  }
  return items.filter(
    (item) =>
      !isPlaceholderValue(item) &&
      !EXAMPLE_TEXT.test(item) &&
      !API_FRAGMENT.test(item) &&
      (RULE_LIKE.test(item) || /^调用接口/.test(item))
  );
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
    const attrLine = (key: string): number | null => field.attribute_lines[key] ?? line;
    const attrValue = (key: string): string => (field.attributes[key] ?? '').trim();
    if (field.required) {
      rules.push(
        makeRule(
          document,
          `${base}|REQUIRED`,
          `${field.label} 必填`,
          `【${field.label}(${field.field_no ?? ''})】${attrValue('是否必填') || '必填'}${field.required_condition ? `；必填条件：${field.required_condition}` : ''}`,
          'REQUIRED',
          field,
          entity,
          'SAVE',
          '为空时保存应被拦截',
          section,
          attrLine('是否必填'),
          '由字段属性行「是否必填」直接映射',
          'PRD_EXPLICIT',
          toConditions(field.required_condition)
        )
      );
    }
    if (field.readonly) {
      rules.push(
        makeRule(
          document,
          `${base}|READONLY`,
          `${field.label} 只读`,
          `【${field.label}(${field.field_no ?? ''})】${attrValue('是否只读') || '只读'}${field.readonly_condition ? `；只读条件：${field.readonly_condition}` : ''}`,
          'READONLY',
          field,
          entity,
          'FORM_OPEN',
          '字段不可编辑',
          section,
          attrLine('是否只读'),
          '由字段属性行「是否只读」直接映射',
          'PRD_EXPLICIT',
          toConditions(field.readonly_condition)
        )
      );
    }
    if (field.hidden) {
      rules.push(
        makeRule(
          document,
          `${base}|HIDDEN`,
          `${field.label} 隐藏`,
          `【${field.label}(${field.field_no ?? ''})】${attrValue('是否隐藏') || '隐藏'}`,
          'HIDDEN',
          field,
          entity,
          'FORM_OPEN',
          '字段不展示',
          section,
          attrLine('是否隐藏'),
          '由字段属性行「是否隐藏」直接映射',
          'PRD_EXPLICIT',
          toConditions(field.attributes['是否隐藏'])
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
          attrLine('是否禁用'),
          '由字段属性行「是否禁用」与禁用条件组合映射',
          'PRD_EXPLICIT',
          toConditions(field.disabled_condition)
        )
      );
    }
    if (field.default_value && !isPlaceholderValue(field.default_value)) {
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
          attrLine('默认值'),
          '由字段属性行「默认值」直接映射',
          'PRD_EXPLICIT',
          toConditions(field.default_timing)
        )
      );
    }
    if (field.lookup_desc && !isPlaceholderValue(field.lookup_desc)) {
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
          attrLine('开窗说明') ?? attrLine('开窗类型'),
          '由字段属性行「开窗类型/开窗说明」直接映射',
          'PRD_EXPLICIT',
          extractConditionClauses(field.attributes['开窗说明'] ?? null)
        )
      );
    }
    if (field.validation_text) {
      const items = splitValidationItems(field.validation_text).filter((item) => !isFlagRestatement(item));
      for (const [index, item] of items.slice(0, 4).entries()) {
        const isService = /调用接口|bm\.|接口/.test(item);
        rules.push(
          makeRule(
            document,
            `${base}|VALIDATION|${index}`,
            `${field.label} 校验`,
            `【${field.label}(${field.field_no ?? ''})】${item}`,
            isService ? 'API_CONTRACT' : classifyRule(item),
            field,
            entity,
            'SAVE',
            isService ? '按平台服务返回结果决定是否放行' : '按校验规则拦截或提示',
            section,
            attrLine('校验项'),
            isService ? '由字段属性行「校验项」中的平台服务调用映射' : '由字段属性行「校验项」直接映射',
            isService ? 'PLATFORM_SERVICE' : 'PRD_EXPLICIT',
            extractConditionClauses(item)
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
    const phaseLines: Record<string, number> = {};
    for (const row of table.rows) {
      const key = (row.cells[0] ?? '').trim();
      if (key && !phaseLines[key]) phaseLines[key] = row.line;
    }
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
      phase_lines: phaseLines,
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
    phase_lines: { 可用条件: 1, 操作前校验: 1, 操作中处理: 1, 操作后处理: 1 },
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
        if (phase === 'AVAILABILITY') return !isPlaceholderValue(item) && item.length >= 3;
        if (phase === 'PRECHECK') return true;
        return ruleish.test(item);
      });
      for (const [index, item] of items.slice(0, 3).entries()) {
        const label =
          phase === 'PRECHECK' ? '前置校验' : phase === 'POST' ? '后置处理' : phase === 'AVAILABILITY' ? '可用条件' : '处理';
        const isService = /调用接口|bm\.[a-z0-9_]+\.[a-z0-9_]+/i.test(item);
        const isDisplayOnly = phase === 'AVAILABILITY' && /^(隐藏|不显示|不可见)/.test(item);
        const ruleType: RuleType =
          isService
            ? 'API_CONTRACT'
            : isDisplayOnly
              ? 'HIDDEN'
              : phase === 'AVAILABILITY'
            ? 'PERMISSION'
            : /取单|回写|来源单据/.test(item)
              ? 'WORKFLOW'
              : classifyRule(item);
        const phaseKey = phase === 'AVAILABILITY' ? '可用条件' : phase === 'PRECHECK' ? '操作前校验' : phase === 'PROCESSING' ? '操作中处理' : '操作后处理';
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
            isService
              ? '按平台服务调用结果决定是否继续'
              : isDisplayOnly
                ? '按钮或区域不显示'
                : phase === 'PRECHECK'
                  ? '校验不通过则操作被拦截'
                  : '按操作说明执行',
            action.name,
            action.phase_lines[phaseKey] ?? action.source_refs[0]?.line_start ?? null,
            isService
              ? '由操作说明中的平台服务调用映射'
              : phase === 'PROCESSING'
                ? '由操作说明中的处理步骤映射'
                : '由操作说明中的控制项映射',
            isService ? 'PLATFORM_SERVICE' : 'PRD_DERIVED',
            extractConditionClauses(item)
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
  const seqIndex = indexOf(/^(序|序号|步骤|步骤序号|编号)$/);
  const stepIndex = table.header.findIndex(
    (header, index) => index !== seqIndex && /^(环节|环节名称|操作步骤|步骤名称|节点名称|动作|操作)$/.test(header)
  );
  const descIndex = indexOf(/^(说明|描述|处理|内容|处理说明)$/);
  const exceptionIndex = indexOf(/异常|分支|备注/);
  const nodeIndex = table.header.findIndex(
    (header, index) => index !== stepIndex && /^(单据节点|节点|业务对象|单据)$/.test(header)
  );
  const actorIndex = indexOf(/触发方|角色|执行方|操作方/);
  const preIndex = table.header.findIndex((header) => /前置|输入/.test(header));
  const outputIndex = indexOf(/^输出|产出|结果/);
  const nextIndex = indexOf(/下一步|后续|下一环节/);
  if (stepIndex < 0) return null;
  const steps: WorkflowStep[] = table.rows
    .map((row, rowIndex) => ({
      seq: seqIndex >= 0 ? row.cells[seqIndex] ?? String(rowIndex + 1) : String(rowIndex + 1),
      step: row.cells[stepIndex] ?? '',
      description: descIndex >= 0 ? row.cells[descIndex] ?? '' : '',
      exception: exceptionIndex >= 0 ? row.cells[exceptionIndex] ?? '' : '',
      node_name: nodeIndex >= 0 ? row.cells[nodeIndex] ?? '' : undefined,
      actor: actorIndex >= 0 ? row.cells[actorIndex] ?? '' : undefined,
      precondition: preIndex >= 0 ? row.cells[preIndex] ?? '' : undefined,
      output: outputIndex >= 0 ? row.cells[outputIndex] ?? '' : undefined,
      next_step: nextIndex >= 0 ? row.cells[nextIndex] ?? '' : undefined,
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
        const mappingMatch = /([\u4e00-\u9fa5A-Za-z0-9_]{2,20})\s*(?:←|<-|取自|=|对应为)\s*([\u4e00-\u9fa5A-Za-z0-9_.]{2,30})/.exec(text);
        const looksLikeEntity = /^[\u4e00-\u9fa5]/.test(target);
        const relationType = !looksLikeEntity
          ? 'REFERENCES'
          : /回写|写回|更新下游/.test(text)
            ? 'GENERATES'
            : /取单|来源单据|依据.*选择|带入/.test(text)
              ? 'DERIVED_FROM'
              : 'REFERENCES';
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
          relation_type: relationType,
          mapping: mappingMatch ? `${mappingMatch[1].trim()} ← ${mappingMatch[2].trim()}` : null,
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
          from || to ? null : '状态机表格缺少状态列',
          'PRD_EXPLICIT',
          from ? [`起始状态：${from}`] : []
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
