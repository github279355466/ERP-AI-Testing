import fs from 'node:fs';
import path from 'node:path';

export interface PrdField {
  label: string;
  name: string;
}

export interface PrdEntry {
  workItem: string;
  pageId: string | null;
  testPlanIds: string[];
  fileName: string;
  relativePath: string;
  prdVersion: string;
  modifiedAt: string;
  title: string;
  prdType: string;
  entity: string;
  entityLabel: string;
  application: string;
  sections: string[];
  subsections: string[];
  fieldCount: number;
  fields: PrdField[];
  versionCount: number;
}

export interface PrdIndex {
  version: 1;
  sourceRoot: string;
  generatedAt: string;
  entries: PrdEntry[];
}

export interface PrdCandidateFile {
  name: string;
  mtimeMs: number;
}

export interface TestPlanRef {
  id: string;
  name: string;
  file: string;
}

const VERSION_PATTERN = /PRD\.v(\d+(?:\.\d+)*)(?:-[A-Za-z0-9]+)?\.md$/i;

export function parsePrdVersion(fileName: string): string | null {
  const match = VERSION_PATTERN.exec(fileName);
  return match ? match[1] : null;
}

export function comparePrdVersions(left: string, right: string): number {
  const leftParts = left.split('.').map(Number);
  const rightParts = right.split('.').map(Number);
  const length = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < length; index += 1) {
    const a = leftParts[index] ?? 0;
    const b = rightParts[index] ?? 0;
    if (a !== b) return a - b;
  }
  return 0;
}

export function selectLatestPrd<T extends PrdCandidateFile>(
  files: readonly T[],
): { file: T; version: string } | null {
  let best: { file: T; version: string } | null = null;
  for (const file of files) {
    const version = parsePrdVersion(file.name);
    if (!version) continue;
    if (!best) {
      best = { file, version };
      continue;
    }
    const comparison = comparePrdVersions(version, best.version);
    if (comparison > 0 || (comparison === 0 && file.mtimeMs > best.file.mtimeMs)) {
      best = { file, version };
    }
  }
  return best;
}

export function extractPrdMetadata(content: string): {
  title: string;
  prdType: string;
  entity: string;
  entityLabel: string;
  application: string;
  sections: string[];
  subsections: string[];
  fields: PrdField[];
} {
  const lines = content.split(/\r?\n/);
  const title = lines.find((line) => /^#\s+/.test(line))?.replace(/^#\s+/, '').trim() ?? '';

  const readMeta = (label: string): string => {
    const line = lines.find((item) => item.includes(`**${label}**`));
    if (!line) return '';
    return line.replace(/^.*?\*\*[^*]+\*\*\s*[:：]\s*/, '').trim();
  };

  const objectRaw = readMeta('业务对象');
  const entityMatch = /[（(]\s*`?([A-Za-z0-9_.]+)`?\s*[）)]/.exec(objectRaw);
  const entity = entityMatch ? entityMatch[1] : '';
  const entityLabel = objectRaw.replace(/[（(].*?[）)]\s*$/, '').trim();

  const sections: string[] = [];
  const subsections: string[] = [];
  const fields: PrdField[] = [];
  for (const line of lines) {
    const section = /^##\s+(.+?)\s*$/.exec(line);
    if (section) sections.push(section[1]);

    const subsection = /^###\s+(.+?)\s*$/.exec(line);
    if (subsection) subsections.push(subsection[1]);

    const field = /^#{4,5}\s+(.+?)\s*[（(]\s*`?([A-Za-z0-9_.]+)`?\s*[）)]\s*$/.exec(line);
    if (field) fields.push({ label: field[1].trim(), name: field[2] });
  }

  return {
    title,
    prdType: readMeta('PRD类型').replace(/^[:：]\s*/, '').trim(),
    entity,
    entityLabel,
    application: readMeta('所属应用').trim(),
    sections,
    subsections,
    fields,
  };
}

export function scanTestPlans(rootDir: string): TestPlanRef[] {
  if (!rootDir || !fs.existsSync(rootDir)) return [];
  const result: TestPlanRef[] = [];
  const walk = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const match = /^(TP-\d+)-(.+)-测试计划\.md$/.exec(entry.name);
      if (match) result.push({ id: match[1], name: match[2], file: full });
    }
  };
  walk(rootDir);
  return result;
}

export function buildPrdIndex(options: {
  rootDir: string;
  testPlanRoot?: string;
  pageMap?: { pages?: Array<{ id: string; name: string }> };
}): PrdIndex {
  const rootDir = path.resolve(options.rootDir);
  if (!fs.existsSync(rootDir)) {
    throw new Error(`PRD 目录不存在: ${rootDir}`);
  }

  const plans = scanTestPlans(options.testPlanRoot ?? '');
  const pages = options.pageMap?.pages ?? [];
  const entries: PrdEntry[] = [];

  for (const directory of fs.readdirSync(rootDir, { withFileTypes: true })) {
    if (!directory.isDirectory()) continue;
    const workItem = directory.name;
    const dirPath = path.join(rootDir, workItem);
    const files = fs
      .readdirSync(dirPath, { withFileTypes: true })
      .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith('.md'))
      .map((entry) => {
        const full = path.join(dirPath, entry.name);
        return { name: entry.name, mtimeMs: fs.statSync(full).mtimeMs, full };
      });
    const versioned = files.filter((file) => parsePrdVersion(file.name));
    const latest = selectLatestPrd(versioned);
    if (!latest) continue;

    const content = fs.readFileSync(latest.file.full, 'utf8');
    const meta = extractPrdMetadata(content);
    const matchedPlans = plans.filter((plan) => plan.name === workItem || plan.name === meta.title);
    const matchedPage = pages.find((page) => page.name === workItem || page.name === meta.title);

    entries.push({
      workItem,
      pageId: matchedPage?.id ?? null,
      testPlanIds: matchedPlans.map((plan) => plan.id),
      fileName: latest.file.name,
      relativePath: path.relative(rootDir, latest.file.full).split(path.sep).join('/'),
      prdVersion: latest.version,
      modifiedAt: new Date(latest.file.mtimeMs).toISOString(),
      title: meta.title,
      prdType: meta.prdType,
      entity: meta.entity,
      entityLabel: meta.entityLabel,
      application: meta.application,
      sections: meta.sections,
      subsections: meta.subsections,
      fieldCount: meta.fields.length,
      fields: meta.fields,
      versionCount: versioned.length,
    });
  }

  entries.sort((left, right) => left.workItem.localeCompare(right.workItem, 'zh-CN'));
  return {
    version: 1,
    sourceRoot: rootDir,
    generatedAt: new Date().toISOString(),
    entries,
  };
}

export function validatePrdIndex(raw: unknown): string[] {
  const errors: string[] = [];
  const index = raw as Partial<PrdIndex> | null;
  if (!Array.isArray(index?.entries) || index.entries.length === 0) {
    return ['prd-index.entries 必须是非空数组'];
  }

  const seen = new Set<string>();
  for (const entry of index.entries) {
    if (!entry?.workItem) {
      errors.push('PRD 条目缺少 workItem');
    } else if (seen.has(entry.workItem)) {
      errors.push(`PRD 条目重复: ${entry.workItem}`);
    } else {
      seen.add(entry.workItem);
    }
    if (!entry?.prdVersion) errors.push(`PRD ${entry?.workItem ?? '(unknown)'} 缺少 prdVersion`);
    if (!entry?.relativePath || !entry.relativePath.endsWith('.md')) {
      errors.push(`PRD ${entry?.workItem ?? '(unknown)'} relativePath 非法`);
    }
    if (!Array.isArray(entry?.testPlanIds)) {
      errors.push(`PRD ${entry?.workItem ?? '(unknown)'} testPlanIds 必须是数组`);
    }
    if (!Array.isArray(entry?.subsections)) {
      errors.push(`PRD ${entry?.workItem ?? '(unknown)'} subsections 必须是数组`);
    }
    if (typeof entry?.fieldCount !== 'number' || entry.fieldCount !== (entry.fields?.length ?? -1)) {
      errors.push(`PRD ${entry?.workItem ?? '(unknown)'} fieldCount 与 fields 不一致`);
    }
  }
  return errors;
}

export function readPrdIndex(filePath: string): PrdIndex {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8')) as PrdIndex;
  const errors = validatePrdIndex(raw);
  if (errors.length > 0) {
    throw new Error(`PRD 索引校验失败:\n- ${errors.join('\n- ')}`);
  }
  return raw;
}

export function writePrdIndex(filePath: string, index: PrdIndex): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(index, null, 2)}\n`, 'utf8');
}

export function findPrdEntry(
  index: PrdIndex,
  criteria: { workItem?: string; pageId?: string; testPlanId?: string },
): PrdEntry | undefined {
  return index.entries.find((entry) => {
    if (criteria.workItem && entry.workItem !== criteria.workItem && entry.title !== criteria.workItem) return false;
    if (criteria.pageId && entry.pageId !== criteria.pageId) return false;
    if (criteria.testPlanId && !entry.testPlanIds.includes(criteria.testPlanId)) return false;
    return true;
  });
}

/**
 * 按标题片段读取 PRD 章节原文（含子章节），用于执行计划前读取业务逻辑。
 */
export function readPrdSection(content: string, section: string): string | null {
  const lines = content.split(/\r?\n/);
  const needle = section.trim();
  if (!needle) return null;

  const start = lines.findIndex((line) => {
    const match = /^(#{2,4})\s+(.+?)\s*$/.exec(line);
    return Boolean(match && match[2].includes(needle));
  });
  if (start < 0) return null;

  const heading = /^(#{2,4})\s+/.exec(lines[start]);
  const level = heading ? heading[1].length : 2;
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    const match = /^(#{1,6})\s+/.exec(lines[index]);
    if (match && match[1].length <= level) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join('\n').trim();
}
