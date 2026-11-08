import fs from 'node:fs';
import path from 'node:path';
import { buildKnowledge, PipelineResult } from '../../prd/pipeline';
import { PrdModelingConfig } from '../../prd/config';
import { buildGlossary, GlossaryTerm } from './glossary';
import {
  buildModulePrdConfig,
  loadModuleSourceIndex,
  LoadedModuleSource,
} from './module-source';

export interface ScanModuleOptions {
  repoRoot?: string;
  moduleId?: string;
  sourcePath?: string;
  prdDirOverride?: string;
  outputDir?: string;
  incremental?: boolean;
  useCache?: boolean;
  env?: NodeJS.ProcessEnv;
}

export interface ModuleScanSummary {
  schema_version: '1.0';
  module_id: string;
  module_name: string;
  generated_at: string;
  mode: 'FULL' | 'INCREMENTAL';
  source_index: string;
  prd_root: string;
  counts: Record<string, number>;
  validation: {
    valid: boolean;
    errors: number;
    warnings: number;
  };
  coverage: {
    rules: number;
    covered_by_existing_cases: number;
    rate: number;
  };
  outputs: {
    knowledge_dir: string;
    report_dir: string;
    source_index_dir: string;
    glossary: string;
  };
}

export interface ScanModuleResult {
  moduleId: string;
  source: LoadedModuleSource;
  config: PrdModelingConfig;
  pipeline: PipelineResult;
  glossary: GlossaryTerm[];
  glossaryPath: string;
  summaryPath: string;
  summary: ModuleScanSummary;
}

function writeJson(filePath: string, value: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relative(repoRoot: string, filePath: string): string {
  return path.relative(repoRoot, filePath).replace(/\\/g, '/');
}

export function scanModuleKnowledge(options: ScanModuleOptions): ScanModuleResult {
  const repoRoot = path.resolve(options.repoRoot ?? process.cwd());
  const source = loadModuleSourceIndex({
    repoRoot,
    moduleId: options.moduleId,
    sourcePath: options.sourcePath,
    env: options.env,
  });
  const config = buildModulePrdConfig({
    repoRoot,
    source,
    prdDirOverride: options.prdDirOverride,
    outputDir: options.outputDir,
  });
  const mode = options.incremental ? 'INCREMENTAL' : 'FULL';
  const pipeline = buildKnowledge(config, mode, { useCache: options.useCache ?? options.incremental });
  const glossary = buildGlossary(pipeline.bundle);
  const glossaryPath = path.join(config.output.knowledgeDir, 'glossary.json');
  writeJson(glossaryPath, glossary);

  const summary: ModuleScanSummary = {
    schema_version: '1.0',
    module_id: source.index.module_id,
    module_name: source.index.module_name,
    generated_at: new Date().toISOString(),
    mode,
    source_index: relative(repoRoot, source.filePath),
    prd_root: relative(repoRoot, config.prd.inputDir),
    counts: {
      documents: pipeline.bundle.documents.length,
      entities: pipeline.bundle.entities.length,
      fields: pipeline.bundle.fields.length,
      rules: pipeline.bundle.rules.length,
      workflows: pipeline.bundle.workflows.length,
      dependencies: pipeline.bundle.dependencies.length,
      scenarios: pipeline.bundle.scenarios.length,
      open_questions: pipeline.bundle.openQuestions.length,
      glossary: glossary.length,
    },
    validation: {
      valid: pipeline.validation.valid,
      errors: pipeline.validation.errors.length,
      warnings: pipeline.validation.warnings.length,
    },
    coverage: {
      rules: pipeline.coverage.rules_considered,
      covered_by_existing_cases: pipeline.coverage.rules_considered === 0
        ? 0
        : pipeline.bundle.rules.filter((rule) => pipeline.coverage.covered_rule_ids.has(rule.id)).length,
      rate: pipeline.coverage.rules_considered === 0 ? 0 : Number(
        (pipeline.bundle.rules.filter((rule) => pipeline.coverage.covered_rule_ids.has(rule.id)).length /
          pipeline.coverage.rules_considered).toFixed(4),
      ),
    },
    outputs: {
      knowledge_dir: relative(repoRoot, config.output.knowledgeDir),
      report_dir: relative(repoRoot, config.output.reportDir),
      source_index_dir: relative(repoRoot, config.output.sourceIndexDir),
      glossary: relative(repoRoot, glossaryPath),
    },
  };
  const summaryPath = path.join(config.output.knowledgeDir, 'module-summary.json');
  writeJson(summaryPath, summary);
  return {
    moduleId: source.index.module_id,
    source,
    config,
    pipeline,
    glossary,
    glossaryPath,
    summaryPath,
    summary,
  };
}
