import fs from 'node:fs';
import path from 'node:path';
import { PrdModelingConfig } from './config';
import { documentId, sha256 } from './ids';
import { ScanStatus, ScanSummary } from './types';

export interface ScannedFile {
  absolute_path: string;
  relative_path: string;
  file_name: string;
  directory_name: string;
  job_directory: string;
  domain_name: string;
  extension: string;
  size_bytes: number;
  modified_at: string;
  sha256: string;
  supported: boolean;
  unsupported_reason: 'RESERVED_FORMAT' | 'NOT_INCLUDED' | null;
  role: 'PRD' | 'TEST_CASE_LIBRARY';
  document_id: string;
  status: ScanStatus;
}

export interface ScanStateEntry {
  sha256: string;
  document_id: string;
  scanned_at: string;
}

export interface ScanState {
  version: 1;
  updated_at: string;
  files: Record<string, ScanStateEntry>;
}

export interface ScanResult {
  files: ScannedFile[];
  unsupported: ScannedFile[];
  missing: ScanStateEntry[];
  summary: ScanSummary;
  state: ScanState;
}

function walk(
  root: string,
  current: string,
  config: PrdModelingConfig,
  output: Array<{ absolute: string; relative: string }>
): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(current, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.name.startsWith('.') || entry.name.startsWith('~$')) continue;
    if (/^(thumbs\.db|desktop\.ini)$/i.test(entry.name)) continue;
    if (entry.isDirectory()) {
      if (config.prd.excludeDirectories.includes(entry.name)) continue;
      walk(root, absolute, config, output);
      continue;
    }
    if (!entry.isFile()) continue;
    output.push({ absolute, relative: path.relative(root, absolute).replace(/\\/g, '/') });
  }
}

function readState(config: PrdModelingConfig): ScanState {
  const file = path.join(config.output.sourceIndexDir, '.scan-state.json');
  if (!fs.existsSync(file)) return { version: 1, updated_at: new Date().toISOString(), files: {} };
  try {
    const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as ScanState;
    if (parsed.version !== 1 || typeof parsed.files !== 'object') {
      return { version: 1, updated_at: new Date().toISOString(), files: {} };
    }
    return parsed;
  } catch {
    return { version: 1, updated_at: new Date().toISOString(), files: {} };
  }
}

export function writeScanState(config: PrdModelingConfig, state: ScanState): void {
  fs.mkdirSync(config.output.sourceIndexDir, { recursive: true });
  fs.writeFileSync(
    path.join(config.output.sourceIndexDir, '.scan-state.json'),
    `${JSON.stringify(state, null, 2)}\n`,
    'utf8'
  );
}

const AUXILIARY_SEGMENT = /^_/;
const DOMAIN_SEGMENT = /域$/;

function jobDirectoryOf(relative: string): string {
  const parts = relative.split('/').slice(0, -1);
  const meaningful = parts.filter((part) => !AUXILIARY_SEGMENT.test(part) && !DOMAIN_SEGMENT.test(part));
  return meaningful.length > 0 ? meaningful[meaningful.length - 1] : '';
}

function domainNameOf(relative: string): string {
  return relative.split('/').slice(0, -1).find((part) => DOMAIN_SEGMENT.test(part)) ?? '';
}

function toScannedFile(
  config: PrdModelingConfig,
  absolute: string,
  relative: string,
  role: 'PRD' | 'TEST_CASE_LIBRARY',
  state: ScanState
): ScannedFile {
  const stat = fs.statSync(absolute);
  const buffer = fs.readFileSync(absolute);
  const hash = sha256(buffer);
  const extension = path.extname(absolute).toLowerCase();
  const key = `${role}:${relative}`;
  const previous = state.files[key];
  const status: ScanStatus = !previous ? 'NEW' : previous.sha256 === hash ? 'UNCHANGED' : 'MODIFIED';
  const supported = config.prd.includeExtensions.includes(extension);
  const reserved = config.prd.reservedExtensions.includes(extension);
  return {
    absolute_path: absolute,
    relative_path: relative,
    file_name: path.basename(absolute),
    directory_name: relative.includes('/') ? relative.split('/')[0] : path.basename(path.dirname(absolute)),
    job_directory: jobDirectoryOf(relative),
    domain_name: domainNameOf(relative),
    extension,
    size_bytes: stat.size,
    modified_at: stat.mtime.toISOString(),
    sha256: hash,
    supported,
    unsupported_reason: supported ? null : reserved ? 'RESERVED_FORMAT' : 'NOT_INCLUDED',
    role,
    document_id: documentId(`${role}:${relative}`),
    status,
  };
}

const PRD_ORIGINAL_NAME = /\/DOC\d+_[^/]+_V\d+(?:\.\d+)*\.md$/i;

export function isPrdOriginal(relativePath: string): boolean {
  return PRD_ORIGINAL_NAME.test(`/${relativePath.replace(/\\/g, '/')}`);
}

export function scanSources(
  config: PrdModelingConfig,
  mode: 'FULL' | 'INCREMENTAL'
): ScanResult {
  const previous = mode === 'INCREMENTAL'
    ? readState(config)
    : { version: 1 as const, updated_at: new Date().toISOString(), files: {} as Record<string, ScanStateEntry> };

  const collected: Array<{ absolute: string; relative: string; role: 'PRD' | 'TEST_CASE_LIBRARY' }> = [];
  if (fs.existsSync(config.prd.inputDir)) {
    const buffer: Array<{ absolute: string; relative: string }> = [];
    walk(config.prd.inputDir, config.prd.inputDir, config, buffer);
    for (const item of buffer) collected.push({ ...item, role: 'PRD' });
  }
  for (const source of config.scenarioSources) {
    if (!fs.existsSync(source.inputDir)) continue;
    const buffer: Array<{ absolute: string; relative: string }> = [];
    walk(source.inputDir, source.inputDir, config, buffer);
    for (const item of buffer) {
      const role = isPrdOriginal(item.relative) ? 'PRD' : 'TEST_CASE_LIBRARY';
      collected.push({ ...item, role });
    }
  }

  const files: ScannedFile[] = [];
  const unsupported: ScannedFile[] = [];
  const nextFiles: Record<string, ScanStateEntry> = { ...previous.files };
  const now = new Date().toISOString();

  for (const item of collected) {
    const file = toScannedFile(config, item.absolute, item.relative, item.role, previous);
    files.push(file);
    if (file.supported) {
      nextFiles[`${file.role}:${file.relative_path}`] = {
        sha256: file.sha256,
        document_id: file.document_id,
        scanned_at: now,
      };
    } else {
      unsupported.push(file);
    }
  }

  const presentKeys = new Set(files.map((file) => `${file.role}:${file.relative_path}`));
  const missing = Object.entries(previous.files)
    .filter(([key]) => !presentKeys.has(key))
    .map(([, entry]) => entry);

  const summary: ScanSummary = {
    scanned_at: now,
    source_root: config.prd.inputDir,
    total_files: files.length,
    supported_files: files.length - unsupported.length,
    unsupported_files: unsupported.length,
    new_documents: files.filter((file) => file.status === 'NEW' && file.supported).length,
    modified_documents: files.filter((file) => file.status === 'MODIFIED').length,
    unchanged_documents: files.filter((file) => file.status === 'UNCHANGED').length,
    missing_documents: missing.length,
    parse_errors: 0,
    mode,
  };

  return {
    files,
    unsupported,
    missing,
    summary,
    state: { version: 1, updated_at: now, files: nextFiles },
  };
}
