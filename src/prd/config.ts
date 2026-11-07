import fs from 'node:fs';
import path from 'node:path';

export interface ModuleRule {
  pattern: string;
  module: string;
}

export interface PrdSourceConfig {
  inputDir: string;
  includeExtensions: string[];
  reservedExtensions: string[];
  excludeDirectories: string[];
  moduleRules: ModuleRule[];
}

export interface ScenarioSourceConfig {
  name: string;
  inputDir: string;
  kind: 'TEST_CASE_LIBRARY';
}

export interface PrdModelingConfig {
  project: {
    name: string;
    schemaVersion: string;
    timezone: string;
  };
  prd: PrdSourceConfig;
  scenarioSources: ScenarioSourceConfig[];
  output: {
    artifactDir: string;
    reportDir: string;
    knowledgeDir: string;
    sourceIndexDir: string;
  };
  policy: {
    allowExternalModelCalls: boolean;
    allowErpConnectionInPhase1: boolean;
    scenarioDefaultStatus: 'DRAFT';
    requireEvidenceForExplicitRules: boolean;
    maxRulesPerDocument: number;
  };
}

export const DEFAULT_CONFIG_PATH = path.join('config', 'prd-modeling.config.json');
export const LOCAL_CONFIG_PATH = path.join('config', 'prd-modeling.config.local.json');

function expandEnv(value: string): string {
  return value.replace(/\$\{([A-Z0-9_]+)\}/g, (_match, name: string) => process.env[name] ?? '');
}

const DEFAULT_MODULE_RULES: ModuleRule[] = [
  { pattern: '^采购域$', module: '采购' },
  { pattern: '^应收', module: '应收' },
  { pattern: '^应付', module: '应付' },
  { pattern: '^财务', module: '财务' },
  { pattern: '^(基础资料域|供应商域|库存存货域|参数与单别域)$', module: '基础资料' },
  { pattern: '^采购取价策略$|^询价单$|^供应商品号价格$|^采购退货单$|^采购退货出库单$', module: '采购' },
  { pattern: '^应收|^其他应收单$', module: '应收' },
  { pattern: '^应付|^其他应付单$', module: '应付' },
  { pattern: '^结算|^会计期间|^设置核算参数$', module: '财务' },
  { pattern: '^批号编号规则$|^客户供应商关系$', module: '基础资料' },
  { pattern: '^(请购单|采购订单|采购到货单|采购入库单|到货单验收|运营单元采购参数)$', module: '采购' },
];

function emptyConfig(): PrdModelingConfig {
  return {
    project: {
      name: 'Athena ERP Test Platform',
      schemaVersion: '1.0.0',
      timezone: 'Asia/Shanghai',
    },
    prd: {
      inputDir: 'prd',
      includeExtensions: ['.md', '.markdown', '.txt', '.json'],
      reservedExtensions: ['.docx', '.xlsx', '.xls', '.pdf', '.png', '.jpg', '.jpeg'],
      excludeDirectories: ['.git', 'node_modules', '__pycache__', '.cache'],
      moduleRules: DEFAULT_MODULE_RULES,
    },
    scenarioSources: [],
    output: {
      artifactDir: 'artifacts',
      reportDir: 'reports',
      knowledgeDir: path.join('artifacts', 'knowledge'),
      sourceIndexDir: path.join('artifacts', 'source-index'),
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

function mergeConfig(base: PrdModelingConfig, patch: Partial<PrdModelingConfig>): PrdModelingConfig {
  return {
    project: { ...base.project, ...(patch.project ?? {}) },
    prd: {
      ...base.prd,
      ...(patch.prd ?? {}),
      moduleRules: patch.prd?.moduleRules ?? base.prd.moduleRules,
    },
    scenarioSources: patch.scenarioSources ?? base.scenarioSources,
    output: { ...base.output, ...(patch.output ?? {}) },
    policy: { ...base.policy, ...(patch.policy ?? {}) },
  };
}

export interface LoadConfigOptions {
  repoRoot: string;
  configPath?: string;
  prdDirOverride?: string;
  scenarioDirOverride?: string;
}

export function loadPrdConfig(options: LoadConfigOptions): PrdModelingConfig {
  const configPath = path.resolve(options.repoRoot, options.configPath ?? DEFAULT_CONFIG_PATH);
  let config = emptyConfig();
  if (fs.existsSync(configPath)) {
    const raw = fs.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrdModelingConfig>;
    config = mergeConfig(config, parsed);
  }
  const localPath = path.resolve(options.repoRoot, LOCAL_CONFIG_PATH);
  if (fs.existsSync(localPath)) {
    const raw = fs.readFileSync(localPath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<PrdModelingConfig>;
    config = mergeConfig(config, parsed);
  }
  const envPrdDir = process.env.PRD_INPUT_DIR;
  const prdDir = options.prdDirOverride ?? envPrdDir ?? expandEnv(config.prd.inputDir);
  config.prd.inputDir = path.isAbsolute(prdDir) ? prdDir : path.resolve(options.repoRoot, prdDir);
  if (options.scenarioDirOverride) {
    config.scenarioSources = [
      {
        name: '测试用例',
        inputDir: path.resolve(options.repoRoot, expandEnv(options.scenarioDirOverride)),
        kind: 'TEST_CASE_LIBRARY',
      },
    ];
  } else {
    config.scenarioSources = config.scenarioSources.map((source) => ({
      ...source,
      inputDir: (() => {
        const expanded = expandEnv(source.inputDir);
        return path.isAbsolute(expanded) ? expanded : path.resolve(options.repoRoot, expanded);
      })(),
    }));
  }
  config.output.artifactDir = path.resolve(options.repoRoot, config.output.artifactDir);
  config.output.reportDir = path.resolve(options.repoRoot, config.output.reportDir);
  config.output.knowledgeDir = path.resolve(options.repoRoot, config.output.knowledgeDir);
  config.output.sourceIndexDir = path.resolve(options.repoRoot, config.output.sourceIndexDir);
  return config;
}

export function resolveModuleName(moduleRules: ModuleRule[], directoryName: string): string {
  for (const rule of moduleRules) {
    if (new RegExp(rule.pattern).test(directoryName)) return rule.module;
  }
  return '其他';
}
