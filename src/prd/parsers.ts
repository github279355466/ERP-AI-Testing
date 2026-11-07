export interface MarkdownHeading {
  level: number;
  text: string;
  line: number;
}

export interface MarkdownTableRow {
  cells: string[];
  line: number;
}

export interface MarkdownTable {
  sectionPath: string[];
  header: string[];
  rows: MarkdownTableRow[];
  lineStart: number;
  lineEnd: number;
}

export interface MarkdownSection {
  level: number;
  title: string;
  path: string[];
  lineStart: number;
  lineEnd: number;
}

export interface MarkdownDocument {
  lines: string[];
  headings: MarkdownHeading[];
  tables: MarkdownTable[];
  sections: MarkdownSection[];
}

export interface PrdJsonAttrConfig {
  seq: number;
  tabOrder: number | null;
  fieldNo: string;
  fieldName: string;
  entityNo: string | null;
  entityLabel: string | null;
  required: boolean;
  requiredCondition: string | null;
  readonly: boolean;
  readonlyCondition: string | null;
  hidden: boolean;
  hiddenCondition: string | null;
  disabled: boolean;
  disabledCondition: string | null;
  defaultValue: string | null;
  validation: string | null;
  lookupDesc: string | null;
  options: string[];
  inputDesc: string | null;
  valueType: string[];
  title: string | null;
  raw: string;
  /** 属性行在 JSON 文档中的定位路径 */
  jsonPath: string;
  /** 校验项在 JSON 文档中的定位路径，与 validation 行一一对应 */
  validationPaths: string[];
}

export interface PrdJsonOperation {
  seq: number;
  name: string;
  availability: string | null;
  preCheck: string | null;
  processing: string | null;
  postAction: string | null;
  displaySettings: string[];
  raw: string;
  /** 操作行在 JSON 文档中的定位路径 */
  jsonPath: string;
}

export interface PrdJsonPayload {
  fileNo: string | null;
  fileName: string | null;
  bizModelNo: string | null;
  bizModelName: string | null;
  application: string | null;
  version: string | null;
  attrs: PrdJsonAttrConfig[];
  operations: PrdJsonOperation[];
  changeLog: Array<{ version: string; date: string; remark: string }>;
  nounList: string | null;
  background: string | null;
}

export function splitTableRow(line: string): string[] {
  const trimmed = line.trim();
  const inner = trimmed.startsWith('|') ? trimmed.slice(1) : trimmed;
  const body = inner.endsWith('|') ? inner.slice(0, -1) : inner;
  const cells: string[] = [];
  let current = '';
  for (let index = 0; index < body.length; index += 1) {
    const char = body[index];
    if (char === '\\' && body[index + 1] === '|') {
      current += '|';
      index += 1;
      continue;
    }
    if (char === '|') {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

export function isTableSeparator(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed.includes('-')) return false;
  if (!trimmed.startsWith('|') && !trimmed.includes('|')) return false;
  return /^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes('|');
}

export function isTableRow(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith('|') && trimmed.indexOf('|', 1) > 0;
}

export function parseMarkdown(text: string): MarkdownDocument {
  const lines = text.split(/\r?\n/);
  const headings: MarkdownHeading[] = [];
  const sections: MarkdownSection[] = [];
  const tables: MarkdownTable[] = [];
  const stack: MarkdownHeading[] = [];
  let inFence = false;

  const currentPath = (): string[] => stack.map((heading) => heading.text);

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const trimmed = line.trim();
    if (trimmed.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;

    const headingMatch = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const headingText = headingMatch[2].replace(/#+\s*$/, '').trim();
      while (stack.length > 0 && stack[stack.length - 1].level >= level) {
        const closed = stack.pop() as MarkdownHeading;
        const closedSection = sections.find((section) => section.lineStart === closed.line);
        if (closedSection) closedSection.lineEnd = index;
      }
      const heading: MarkdownHeading = { level, text: headingText, line: index + 1 };
      headings.push(heading);
      stack.push(heading);
      sections.push({
        level,
        title: headingText,
        path: currentPath(),
        lineStart: index + 1,
        lineEnd: lines.length,
      });
      continue;
    }

    if (isTableRow(line) && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const header = splitTableRow(line);
      const rows: MarkdownTableRow[] = [];
      const lineStart = index + 1;
      let cursor = index + 2;
      while (cursor < lines.length && isTableRow(lines[cursor])) {
        rows.push({ cells: splitTableRow(lines[cursor]), line: cursor + 1 });
        cursor += 1;
      }
      tables.push({
        sectionPath: currentPath(),
        header,
        rows,
        lineStart,
        lineEnd: cursor,
      });
      index = cursor - 1;
    }
  }

  for (const section of sections) {
    if (section.lineEnd === lines.length) {
      section.lineEnd = lines.length;
    }
  }
  return { lines, headings, tables, sections };
}

export function tableToKeyValue(table: MarkdownTable): Map<string, string> {
  const map = new Map<string, string>();
  for (const row of table.rows) {
    if (row.cells.length < 2) continue;
    const key = row.cells[0].trim();
    if (!key) continue;
    map.set(key, row.cells.slice(1).join(' | ').trim());
  }
  return map;
}

export function findTableAfterLine(document: MarkdownDocument, line: number, maxDistance = 12): MarkdownTable | null {
  let best: MarkdownTable | null = null;
  for (const table of document.tables) {
    if (table.lineStart <= line) continue;
    if (table.lineStart - line > maxDistance) break;
    if (!best || table.lineStart < best.lineStart) best = table;
  }
  return best;
}

export function sectionAtLine(document: MarkdownDocument, line: number): MarkdownSection | null {
  let best: MarkdownSection | null = null;
  for (const section of document.sections) {
    if (section.lineStart <= line) best = section;
    else break;
  }
  return best;
}

export function parseJsonSafely(text: string): unknown | null {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function readNumber(record: Record<string, unknown>, key: string): number | null {
  const value = record[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBoolFromFlag(record: Record<string, unknown>, key: string): { on: boolean; cond: string | null } {
  const value = asRecord(record[key]);
  if (!value) return { on: false, cond: null };
  return { on: value.on === true, cond: readString(value, 'cond') };
}

export function parsePrdJsonPayload(text: string): PrdJsonPayload | null {
  const parsed = parseJsonSafely(text);
  const root = asRecord(parsed);
  if (!root) return null;
  const data = asRecord(root.data);
  const params = data ? asRecord(data.params) : null;
  const specList = (params ? params.prd_spec : null) ?? root.prd_spec;
  if (!Array.isArray(specList) || specList.length === 0) return null;
  const spec = asRecord(specList[0]);
  if (!spec) return null;
  const specPath = params ? 'data.params.prd_spec[0]' : 'prd_spec[0]';

  const attrs: PrdJsonAttrConfig[] = [];
  const attrRows = spec.prd_spec_attr_func_cfg;
  if (Array.isArray(attrRows)) {
    for (const [rowIndex, rawRow] of attrRows.entries()) {
      const row = asRecord(rawRow);
      if (!row) continue;
      const fieldNo = readString(row, 'field_no');
      const fieldName = readString(row, 'field_name');
      if (!fieldNo || !fieldName) continue;
      const configText = readString(row, 'field_attr_cfg_cont');
      const config = configText ? asRecord(parseJsonSafely(configText)) : null;
      const constraints = config ? asRecord(config.cnst) : null;
      const required = constraints ? readBoolFromFlag(constraints, 'reqd') : { on: false, cond: null };
      const readonly = constraints ? readBoolFromFlag(constraints, 'read') : { on: false, cond: null };
      const hidden = constraints ? readBoolFromFlag(constraints, 'hid') : { on: false, cond: null };
      const disabled = constraints ? readBoolFromFlag(constraints, 'dis') : { on: false, cond: null };
      const options: string[] = [];
      if (config && Array.isArray(config.list_v)) {
        for (const item of config.list_v) {
          if (typeof item === 'string' && item.trim()) options.push(item.trim());
        }
      }
      const validations: string[] = [];
      const validationPaths: string[] = [];
      if (config && Array.isArray(config.vals)) {
        for (const [valueIndex, item] of config.vals.entries()) {
          const record = asRecord(item);
          const logic = record ? readString(record, 'logic') : null;
          if (logic) {
            validations.push(logic);
            validationPaths.push(
              `${specPath}.prd_spec_attr_func_cfg[${rowIndex}].field_attr_func_cfg_cont.vals[${valueIndex}].logic`
            );
          }
        }
      }
      attrs.push({
        seq: readNumber(row, 'seq') ?? attrs.length + 1,
        tabOrder: readNumber(row, 'tab_order'),
        fieldNo,
        fieldName,
        entityNo: readString(row, 'reg_obj_en_sname'),
        entityLabel: readString(row, 'reg_obj_zh_name'),
        required: required.on,
        requiredCondition: required.cond,
        readonly: readonly.on,
        readonlyCondition: readonly.cond,
        hidden: hidden.on,
        hiddenCondition: hidden.cond,
        disabled: disabled.on,
        disabledCondition: disabled.cond,
        defaultValue: config ? readString(config, 'def_v') : null,
        validation: validations.length > 0 ? validations.join('\n') : null,
        lookupDesc: config ? readString(config, 'win_desc') : null,
        options,
        inputDesc: config ? readString(config, 'input_desc') : null,
        valueType: config && Array.isArray(config.v_type)
          ? config.v_type.filter((item): item is string => typeof item === 'string')
          : [],
        title: config ? readString(config, 'title') : null,
        raw: configText ?? '',
        jsonPath: `${specPath}.prd_spec_attr_func_cfg[${rowIndex}].field_attr_func_cfg_cont`,
        validationPaths,
      });
    }
  }

  const operations: PrdJsonOperation[] = [];
  const oprRows = spec.prd_spec_opr_func_cfg;
  if (Array.isArray(oprRows)) {
    for (const rawRow of oprRows) {
      const row = asRecord(rawRow);
      if (!row) continue;
      const name = readString(row, 'opr_cntl_name');
      if (!name) continue;
      const configText = readString(row, 'opr_cntl_cfg_cont');
      const config = configText ? asRecord(parseJsonSafely(configText)) : null;
      const displays: string[] = [];
      if (config && Array.isArray(config.display_settings)) {
        for (const item of config.display_settings) {
          if (typeof item === 'string' && item.trim()) displays.push(item.trim());
        }
      }
      operations.push({
        seq: readNumber(row, 'seq') ?? operations.length + 1,
        name,
        availability: config ? readString(config, 'avail_cond') : null,
        preCheck: config ? readString(config, 'pre_check') : null,
        processing: config ? readString(config, 'processing') : null,
        postAction: config ? readString(config, 'post_action') : null,
        displaySettings: displays,
        raw: configText ?? '',
      });
    }
  }

  const changeLog: Array<{ version: string; date: string; remark: string }> = [];
  const logs = spec.prd_spec_chg_log;
  if (Array.isArray(logs)) {
    for (const rawRow of logs) {
      const row = asRecord(rawRow);
      if (!row) continue;
      changeLog.push({
        version: readString(row, 'chg_ver') ?? '',
        date: readString(row, 'chg_date') ?? '',
        remark: readString(row, 'chg_rmk') ?? '',
      });
    }
  }

  return {
    fileNo: readString(spec, 'prd_file_no'),
    fileName: readString(spec, 'prd_file_name'),
    bizModelNo: readString(spec, 'biz_model_no'),
    bizModelName: readString(spec, 'biz_model_name'),
    application: readString(spec, 'application'),
    version: readString(spec, 'biz_model_version'),
    attrs,
    operations,
    changeLog,
    nounList: readString(spec, 'noun_expl_list'),
    background: readString(spec, 'dem_bkg'),
  };
}
