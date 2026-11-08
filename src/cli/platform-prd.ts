import fs from 'node:fs';
import path from 'node:path';
import { validateFile, validateModulePack } from '../platform/contracts/validator';
import { loadModuleSourceIndex } from '../platform/prd/module-source';
import { scanModuleKnowledge } from '../platform/prd/scan';

interface Args {
  [key: string]: string | boolean | undefined;
}

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
      'Athena PRD & Knowledge Engine',
      '',
      '用法：',
      '  node dist/cli/platform-prd.js modules',
      '  node dist/cli/platform-prd.js validate --module purchase',
      '  node dist/cli/platform-prd.js scan --module purchase',
      '  node dist/cli/platform-prd.js scan --module purchase --incremental',
      '  node dist/cli/platform-prd.js scan --module purchase --prd <dir> --out <dir>',
      '',
      '说明：扫描只读 PRD 文件，输出知识模型到 artifacts/modules/<module-id>/，不连接 ERP。',
    ].join('\n') + '\n',
  );
}

function listModules(root: string): string[] {
  const base = path.join(root, 'business-modules');
  if (!fs.existsSync(base)) return [];
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith('_'))
    .filter((entry) => fs.existsSync(path.join(base, entry.name, 'source-index', 'index.yaml')))
    .map((entry) => entry.name)
    .sort();
}

function main(): number {
  const { command, args } = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  if (command === 'modules') {
    process.stdout.write(`${JSON.stringify({ success: true, modules: listModules(root) }, null, 2)}\n`);
    return 0;
  }

  const moduleId = typeof args.module === 'string' ? args.module : '';
  if (!moduleId && !args.source) {
    process.stderr.write('必须提供 --module <id> 或 --source <file>\n');
    return 1;
  }

  try {
    if (command === 'validate') {
      const source = loadModuleSourceIndex({ repoRoot: root, moduleId, sourcePath: typeof args.source === 'string' ? args.source : undefined });
      const sourceResult = validateFile(source.filePath, 'source-index');
      const packResult = moduleId ? validateModulePack(`business-modules/${moduleId}`, { root }) : null;
      const success = sourceResult.valid && (packResult?.valid ?? true);
      process.stdout.write(
        `${JSON.stringify({ mode: 'READ_ONLY', command, success, source: sourceResult, pack: packResult }, null, 2)}\n`,
      );
      return success ? 0 : 2;
    }

    if (command === 'scan') {
      const result = scanModuleKnowledge({
        repoRoot: root,
        moduleId,
        sourcePath: typeof args.source === 'string' ? args.source : undefined,
        prdDirOverride: typeof args.prd === 'string' ? args.prd : undefined,
        outputDir: typeof args.out === 'string' ? args.out : undefined,
        incremental: args.incremental === true,
        useCache: args.incremental === true,
      });
      process.stdout.write(
        `${JSON.stringify(
          {
            mode: 'STATIC_SCAN',
            command,
            success: result.summary.validation.valid,
            summary: result.summary,
          },
          null,
          2,
        )}\n`,
      );
      return result.summary.validation.valid ? 0 : 2;
    }
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    return 2;
  }

  process.stderr.write(`未知命令: ${command}\n`);
  printHelp();
  return 1;
}

process.exitCode = main();
