import fs from 'node:fs';
import path from 'node:path';
import { PrdModelingConfig, ModuleRule } from '../../prd/config';
import { readStructured, validateFile } from '../contracts/validator';

export interface ModuleScenarioSource {
  name: string;
  path: string;
  kind: 'TEST_CASE_LIBRARY';
  include_paths?: string[];
}

export interface ModuleSourceIndex {
  schema_version: '1.0';
  module_id: string;
  module_name: string;
  prd_roots: string[];
  include_paths: string[];
  scenario_sources: ModuleScenarioSource[];
  module_rules: ModuleRule[];
  notes?: string;
}

export interface LoadedModuleSource {
  filePath: string;
  index: ModuleSourceIndex;
  prdRoots: string[];
  scenarioSources: Array<ModuleScenarioSource & { resolvedPath: string }>;
}

export interface LoadModuleSourceOptions {
  repoRoot: string;
  moduleId?: string;
  sourcePath?: string;
  env?: NodeJS.ProcessEnv;
}

function expand(value: string, env: NodeJS.ProcessEnv): string {
  const missing: string[] = [];
  const expanded = value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => {
    if (!env[name]) missing.push(name);
    return env[name] ?? '';
  });
  if (missing.length > 0 || expanded.trim() === '' || /\$\{[A-Z0-9_]+\}/.test(expanded)) {
    throw new Error(`来源路径包含未解析变量: ${value}`);
  }
  return expanded;
}

function resolvePath(repoRoot: string, value: string, env: NodeJS.ProcessEnv): string {
  const expanded = expand(value, env);
  return path.isAbsolute(expanded) ? path.normalize(expanded) : path.resolve(repoRoot, expanded);
}

export function defaultSourceIndexPath(repoRoot: string, moduleId: string): string {
  return path.join(repoRoot, 'business-modules', moduleId, 'source-index', 'index.yaml');
}

export function loadModuleSourceIndex(options: LoadModuleSourceOptions): LoadedModuleSource {
  const filePath = options.sourcePath
    ? path.resolve(options.repoRoot, options.sourcePath)
    : options.moduleId
      ? defaultSourceIndexPath(options.repoRoot, options.moduleId)
      : '';
  if (!filePath) throw new Error('必须提供 moduleId 或 sourcePath');
  if (!fs.existsSync(filePath)) throw new Error(`模块来源索引不存在: ${filePath}`);

  const validation = validateFile(filePath, 'source-index');
  if (!validation.valid) {
    throw new Error(
      `模块来源索引校验失败: ${validation.issues.map((issue) => `${issue.path} ${issue.message}`).join('; ')}`,
    );
  }
  const index = readStructured(filePath) as ModuleSourceIndex;
  if (options.moduleId && index.module_id !== options.moduleId) {
    throw new Error(`来源索引 module_id=${index.module_id} 与请求模块 ${options.moduleId} 不一致`);
  }
  const env = options.env ?? defaultEnv(options.repoRoot);
  const prdRoots = index.prd_roots.map((root) => resolvePath(options.repoRoot, root, env));
  const scenarioSources = index.scenario_sources.map((source) => ({
    ...source,
    resolvedPath: resolvePath(options.repoRoot, source.path, env),
  }));
  return { filePath, index, prdRoots, scenarioSources };
}

function defaultEnv(repoRoot: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  if (env.PRD_WORKSPACE) return env;
  const localConfig = path.join(repoRoot, 'config', 'prd-modeling.config.local.json');
  if (!fs.existsSync(localConfig)) return env;
  try {
    const parsed = JSON.parse(fs.readFileSync(localConfig, 'utf8')) as {
      prd?: { inputDir?: string };
    };
    const inputDir = parsed.prd?.inputDir;
    if (!inputDir) return env;
    const normalized = inputDir.replace(/\\/g, '/').replace(/\/+$/, '');
    env.PRD_WORKSPACE = /\/prd$/i.test(normalized) ? normalized.slice(0, -4) : path.dirname(normalized);
  } catch {
    return env;
  }
  return env;
}

export interface BuildModuleConfigOptions {
  repoRoot: string;
  source: LoadedModuleSource;
  prdDirOverride?: string;
  outputDir?: string;
}

export function buildModulePrdConfig(options: BuildModuleConfigOptions): PrdModelingConfig {
  const { repoRoot, source } = options;
  if (!options.prdDirOverride && source.prdRoots.length !== 1) {
    throw new Error(
      `模块 ${source.index.module_id} 配置了 ${source.prdRoots.length} 个 PRD 根目录，当前版本请合并为 1 个或传 --prd`,
    );
  }
  const outputDir = options.outputDir
    ? path.resolve(repoRoot, options.outputDir)
    : path.join(repoRoot, 'artifacts', 'modules', source.index.module_id);
  return {
    project: {
      name: `Athena ${source.index.module_name}`,
      schemaVersion: '1.0.0',
      timezone: 'Asia/Shanghai',
    },
    prd: {
      inputDir: options.prdDirOverride
        ? path.resolve(repoRoot, options.prdDirOverride)
        : source.prdRoots[0],
      includeExtensions: ['.md', '.markdown', '.txt', '.json'],
      reservedExtensions: ['.docx', '.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg'],
      excludeDirectories: ['.git', 'node_modules', '__pycache__', '.cache'],
      includePaths: source.index.include_paths,
      moduleRules: source.index.module_rules,
    },
    scenarioSources: source.scenarioSources.map((item) => ({
      name: item.name,
      inputDir: item.resolvedPath,
      kind: item.kind,
      includePaths: item.include_paths ?? [],
    })),
    output: {
      artifactDir: outputDir,
      knowledgeDir: path.join(outputDir, 'knowledge'),
      reportDir: path.join(outputDir, 'reports'),
      sourceIndexDir: path.join(outputDir, 'source-index'),
    },
    policy: {
      allowExternalModelCalls: false,
      allowErpConnectionInPhase1: false,
      scenarioDefaultStatus: 'DRAFT',
      requireEvidenceForExplicitRules: true,
      maxRulesPerDocument: 400,
    },
  };
}
