import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, test } from '@playwright/test';
import {
  createRunManifestV2,
  fromRunManifestV1,
  RunManifestV1Like,
  validateRunManifestV2,
} from '../../src/platform/governance/run-manifest-v2';

const root = process.cwd();

function loadExample(): Record<string, unknown> {
  return JSON.parse(
    fs.readFileSync(path.join(root, 'platform/contracts/examples/run-manifest-v2.valid.json'), 'utf8'),
  ) as Record<string, unknown>;
}

function legacyManifest(outcome: RunManifestV1Like['outcome']): RunManifestV1Like {
  return {
    runId: 'ATN-RO-20261108-OLD',
    startedAt: '2026-11-08T10:00:00+08:00',
    finishedAt: '2026-11-08T10:00:01+08:00',
    environmentName: 'athena-test',
    environmentType: 'test',
    testCaseId: 'TC-DEMO-001',
    operator: 'qa-demo',
    createdDocumentIdentifiers: ['DOC-001'],
    outcome,
    evidenceFiles: ['artifacts/old/results.json'],
  };
}

describe('运行清单 v2', () => {
  test('示例通过契约校验', () => {
    const result = validateRunManifestV2(loadExample());
    expect(result.issues).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('缺少必填字段被拒绝', () => {
    const manifest = loadExample();
    delete manifest.test_case_id;
    expect(validateRunManifestV2(manifest).valid).toBe(false);
  });

  test('未知字段被拒绝', () => {
    const manifest = loadExample();
    manifest.__unexpected__ = true;
    expect(validateRunManifestV2(manifest).valid).toBe(false);
  });

  test('非法 outcome 被拒绝', () => {
    const manifest = loadExample();
    manifest.outcome = 'not_run';
    expect(validateRunManifestV2(manifest).valid).toBe(false);
  });

  test('工厂创建的清单通过校验', () => {
    const manifest = createRunManifestV2({
      run_id: 'ATN-RO-20261108-002',
      platform_version: '1.0.0',
      environment: { name: 'athena-test', type: 'test', tenant_id: 'tenant-demo' },
      operator: 'qa-demo',
      test_case_id: 'TC-DEMO-002',
      started_at: '2026-11-08T10:00:00+08:00',
      outcome: 'passed',
    });
    expect(manifest.failure_category).toBe('none');
    expect(manifest.cleanup_status).toBe('not_run');
    expect(validateRunManifestV2(manifest).valid).toBe(true);
  });

  test('v1 适配器映射六状态并保持可校验', () => {
    const mapping = [
      ['passed', 'passed', 'none'],
      ['failed', 'failed', 'step'],
      ['blocked', 'blocked', 'manual'],
      ['not_run', 'skipped', 'none'],
    ] as const;
    for (const [legacyOutcome, outcome, failure] of mapping) {
      const manifest = fromRunManifestV1(legacyManifest(legacyOutcome), {
        platformVersion: '1.0.0',
        tenantId: 'tenant-demo',
        modulePacks: [{ module_id: 'purchase', version: '0.1.0' }],
      });
      expect(manifest.outcome).toBe(outcome);
      expect(manifest.failure_category).toBe(failure);
      expect(manifest.environment.tenant_id).toBe('tenant-demo');
      expect(manifest.created_documents).toEqual([{ document_type: 'UNKNOWN', identifier: 'DOC-001' }]);
      const result = validateRunManifestV2(manifest);
      expect(result.valid, result.issues.map((issue) => issue.message).join('\n')).toBe(true);
    }
  });

  test('v1 缺失租户与操作者时显式标记 UNKNOWN', () => {
    const legacy = legacyManifest('passed');
    legacy.operator = null;
    const manifest = fromRunManifestV1(legacy, { platformVersion: '1.0.0' });
    expect(manifest.environment.tenant_id).toBe('UNKNOWN');
    expect(manifest.operator).toBe('UNKNOWN');
  });
});
