import path from 'node:path';
import {
  ContractSchemaName,
  ContractValidationResult,
  validateAll,
  validateFile,
  validateIntegrationPack,
  validateModulePack,
} from '../platform/contracts/validator';

interface Args {
  [key: string]: string | boolean | undefined;
}

const SCHEMA_NAMES: ContractSchemaName[] = [
  'module-manifest',
  'scenario',
  'test-case',
  'page-mapping',
  'data-recipe',
  'execution-report',
  'run-manifest-v2',
  'integration-pack',
  'action-registry',
  'test-suite',
  'execution-plan',
  'run-config',
  'environment-profile',
  'user-profile',
];

function parseArgs(argv: string[]): { command: string; args: Args } {
  const [command = 'help', ...rest] = argv;
  const args: Args = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = rest[index + 1];
    if (next && !next.startsWith('--')) {
      args[key] = next;
      index += 1;
    } else {
      args[key] = true;
    }
  }
  return { command, args };
}

function printHelp(): void {
  process.stdout.write(
    [
      'Athena Platform Contracts',
      '',
      '用法：',
      '  node dist/cli/platform.js validate',
      '  node dist/cli/platform.js module --path business-modules/purchase',
      '  node dist/cli/platform.js integration --path integration-tests/purchase-to-ap',
      '  node dist/cli/platform.js file --path platform/contracts/examples/testcase.valid.json --schema test-case',
      '',
      `可用 schema: ${SCHEMA_NAMES.join(', ')}`,
    ].join('\n') + '\n',
  );
}

function summarize(results: ContractValidationResult[]): {
  total: number;
  passed: number;
  failed: number;
  warnings: number;
} {
  return {
    total: results.length,
    passed: results.filter((result) => result.valid).length,
    failed: results.filter((result) => !result.valid).length,
    warnings: results.reduce((sum, result) => sum + result.warnings.length, 0),
  };
}

function main(): number {
  const { command, args } = parseArgs(process.argv.slice(2));
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }

  let results: ContractValidationResult[] = [];
  if (command === 'validate') {
    results = validateAll();
  } else if (command === 'module') {
    const target = String(args.path ?? '');
    if (!target) {
      process.stderr.write('用法: module --path <module-dir>\n');
      return 1;
    }
    results = [validateModulePack(target)];
  } else if (command === 'integration') {
    const target = String(args.path ?? '');
    if (!target) {
      process.stderr.write('用法: integration --path <integration-dir>\n');
      return 1;
    }
    results = [validateIntegrationPack(target)];
  } else if (command === 'file') {
    const target = String(args.path ?? '');
    const schema = String(args.schema ?? '');
    if (!target || !SCHEMA_NAMES.includes(schema as ContractSchemaName)) {
      process.stderr.write(`用法: file --path <file> --schema <${SCHEMA_NAMES.join('|')}>\n`);
      return 1;
    }
    results = [validateFile(path.resolve(target), schema as ContractSchemaName)];
  } else {
    process.stderr.write(`未知命令: ${command}\n`);
    printHelp();
    return 1;
  }

  const summary = summarize(results);
  process.stdout.write(
    `${JSON.stringify(
      {
        mode: 'READ_ONLY',
        command,
        success: summary.failed === 0,
        summary,
        results,
      },
      null,
      2,
    )}\n`,
  );
  return summary.failed === 0 ? 0 : 2;
}

process.exitCode = main();
