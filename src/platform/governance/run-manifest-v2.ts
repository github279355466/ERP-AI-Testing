import { ContractValidationResult, validateData } from '../contracts/validator';

export type RunOutcomeV2 = 'passed' | 'failed' | 'blocked' | 'skipped' | 'cancelled' | 'error';

export type FailureCategoryV2 =
  | 'none'
  | 'environment'
  | 'data_preparation'
  | 'step'
  | 'assertion'
  | 'platform'
  | 'manual';

export type RecipeRunStatus = 'passed' | 'failed' | 'blocked' | 'skipped' | 'not_run';

export interface ManifestModuleRef {
  module_id: string;
  version: string;
}

export interface ManifestIntegrationRef {
  integration_id: string;
  version: string;
}

export interface RunManifestEnvironmentV2 {
  name: string;
  type: 'development' | 'test' | 'staging';
  tenant_id: string;
}

export interface CreatedDocumentRef {
  document_type: string;
  identifier: string;
}

export interface DataRecipeRunRecord {
  recipe_id: string;
  status: RecipeRunStatus;
}

export interface RunManifestV2 {
  schema_version: '2.0';
  run_id: string;
  platform_version: string;
  module_packs: ManifestModuleRef[];
  integration_packs: ManifestIntegrationRef[];
  environment: RunManifestEnvironmentV2;
  operator: string;
  test_case_id: string;
  started_at: string;
  finished_at: string | null;
  outcome: RunOutcomeV2;
  failure_category: FailureCategoryV2;
  created_documents: CreatedDocumentRef[];
  data_recipe_runs: DataRecipeRunRecord[];
  cleanup_status: RecipeRunStatus;
  evidence_files: string[];
}

export interface RunManifestV1Like {
  runId: string;
  startedAt: string;
  finishedAt: string | null;
  environmentName: string;
  environmentType: 'development' | 'test' | 'staging';
  testCaseId: string;
  operator: string | null;
  createdDocumentIdentifiers: string[];
  outcome: 'passed' | 'failed' | 'blocked' | 'not_run';
  evidenceFiles: string[];
}

export interface RunManifestV1AdapterOptions {
  platformVersion: string;
  tenantId?: string;
  modulePacks?: ManifestModuleRef[];
  integrationPacks?: ManifestIntegrationRef[];
  testCaseId?: string;
}

const V1_OUTCOME_MAP: Record<RunManifestV1Like['outcome'], { outcome: RunOutcomeV2; failure: FailureCategoryV2 }> = {
  passed: { outcome: 'passed', failure: 'none' },
  failed: { outcome: 'failed', failure: 'step' },
  blocked: { outcome: 'blocked', failure: 'manual' },
  not_run: { outcome: 'skipped', failure: 'none' },
};

export function validateRunManifestV2(
  manifest: unknown,
  target = 'run-manifest-v2',
): ContractValidationResult {
  return validateData('run-manifest-v2', manifest, { target });
}

export function createRunManifestV2(
  input: Pick<
    RunManifestV2,
    'run_id' | 'platform_version' | 'environment' | 'operator' | 'test_case_id' | 'started_at' | 'outcome'
  > &
    Partial<
      Pick<
        RunManifestV2,
        | 'module_packs'
        | 'integration_packs'
        | 'finished_at'
        | 'failure_category'
        | 'created_documents'
        | 'data_recipe_runs'
        | 'cleanup_status'
        | 'evidence_files'
      >
    >,
): RunManifestV2 {
  return {
    schema_version: '2.0',
    run_id: input.run_id,
    platform_version: input.platform_version,
    module_packs: input.module_packs ?? [],
    integration_packs: input.integration_packs ?? [],
    environment: input.environment,
    operator: input.operator,
    test_case_id: input.test_case_id,
    started_at: input.started_at,
    finished_at: input.finished_at ?? null,
    outcome: input.outcome,
    failure_category: input.failure_category ?? (input.outcome === 'passed' ? 'none' : 'step'),
    created_documents: input.created_documents ?? [],
    data_recipe_runs: input.data_recipe_runs ?? [],
    cleanup_status: input.cleanup_status ?? 'not_run',
    evidence_files: input.evidence_files ?? [],
  };
}

export function fromRunManifestV1(
  legacy: RunManifestV1Like,
  options: RunManifestV1AdapterOptions,
): RunManifestV2 {
  const mapping = V1_OUTCOME_MAP[legacy.outcome];
  return {
    schema_version: '2.0',
    run_id: legacy.runId,
    platform_version: options.platformVersion,
    module_packs: options.modulePacks ?? [],
    integration_packs: options.integrationPacks ?? [],
    environment: {
      name: legacy.environmentName,
      type: legacy.environmentType,
      tenant_id: options.tenantId ?? 'UNKNOWN',
    },
    operator: legacy.operator ?? 'UNKNOWN',
    test_case_id: options.testCaseId ?? legacy.testCaseId,
    started_at: legacy.startedAt,
    finished_at: legacy.finishedAt,
    outcome: mapping.outcome,
    failure_category: mapping.failure,
    created_documents: legacy.createdDocumentIdentifiers.map((identifier) => ({
      document_type: 'UNKNOWN',
      identifier,
    })),
    data_recipe_runs: [],
    cleanup_status: 'not_run',
    evidence_files: legacy.evidenceFiles,
  };
}
