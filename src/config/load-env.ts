import fs from 'node:fs';
import path from 'node:path';

export interface LoadEnvResult {
  file: string;
  loadedKeys: string[];
  skippedKeys: string[];
}

/**
 * 读取项目根 .env。只填充尚未存在的环境变量，不覆盖调用方已显式设置的值。
 * 返回值不包含任何变量值，便于安全打印或写入日志。
 */
export function loadDotEnv(file = path.resolve(process.cwd(), '.env')): LoadEnvResult {
  if (!fs.existsSync(file)) {
    return { file, loadedKeys: [], skippedKeys: [] };
  }

  const loadedKeys: string[] = [];
  const skippedKeys: string[] = [];
  const lines = fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const withoutExport = line.startsWith('export ') ? line.slice(7).trim() : line;
    const separator = withoutExport.indexOf('=');
    if (separator <= 0) continue;
    const key = withoutExport.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    const value = unquote(withoutExport.slice(separator + 1).trim());
    if (Object.prototype.hasOwnProperty.call(process.env, key)) {
      skippedKeys.push(key);
      continue;
    }
    process.env[key] = value;
    loadedKeys.push(key);
  }

  return { file, loadedKeys, skippedKeys };
}

function unquote(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      return value.slice(1, -1);
    }
  }
  return value;
}
