import fs from 'node:fs';
import path from 'node:path';
import { validateModulePack } from '../platform/contracts/validator';
import { loadPageMappings, PageMappingRegistry } from '../platform/pages/mapping';
import { loadRecipes, planRecipe } from '../platform/data/recipe';
import { writeRecipePlan } from '../platform/data/executor';

interface Args {
  [key: string]: string | boolean | undefined;
}

interface Check {
  name: string;
  ok: boolean;
  detail: string;
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
      'Athena Runtime Inspection (默认只读)',
      '',
      '用法：',
      '  node dist/cli/platform-runtime.js doctor --module purchase',
      '  node dist/cli/platform-runtime.js pages --module purchase',
      '  node dist/cli/platform-runtime.js recipes --module purchase [--run-id <id>] [--write-plan]',
      '',
      '说明：doctor/pages/recipes 均为静态检查，不连接 ERP。浏览器联通验证见 tests/smoke/platform-browser.spec.ts。',
    ].join('\n') + '\n',
  );
}

function main(): number {
  const { command, args } = parseArgs(process.argv.slice(2));
  const root = process.cwd();
  if (command === 'help' || command === '--help' || command === '-h') {
    printHelp();
    return 0;
  }
  const moduleId = typeof args.module === 'string' ? args.module : '';
  if (!moduleId) {
    process.stderr.write('必须提供 --module <id>\n');
    return 1;
  }

  if (command === 'pages') {
    const result = loadPageMappings(root, moduleId);
    const fields = result.mappings.reduce((sum, mapping) => sum + mapping.fields.length, 0);
    const verified = result.mappings.reduce((sum, mapping) => sum + mapping.fields.filter((field) => field.verified).length, 0);
    const success = result.issues.length === 0;
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'READ_ONLY',
          command,
          success,
          module_id: moduleId,
          directory: result.directory,
          pages: result.mappings.map((mapping) => ({
            page_key: mapping.page_key,
            page_name: mapping.page_name,
            status: mapping.status,
            review_status: mapping.review_status,
            fields: mapping.fields.length,
            verified_fields: mapping.fields.filter((field) => field.verified).length,
          })),
          fields,
          verified_fields: verified,
          unverified_fields: fields - verified,
          issues: result.issues,
        },
        null,
        2,
      )}\n`,
    );
    return success ? 0 : 2;
  }

  if (command === 'recipes') {
    const result = loadRecipes(root, moduleId);
    const runId = typeof args['run-id'] === 'string' ? args['run-id'] : `RECIPE-PLAN-${Date.now()}`;
    const plans = result.recipes.map((recipe) => planRecipe(recipe, { runId }));
    const files = args['write-plan'] === true
      ? plans.map((plan) => writeRecipePlan(root, runId, moduleId, plan))
      : [];
    const success = result.issues.length === 0;
    process.stdout.write(
      `${JSON.stringify(
        {
          mode: 'PLAN_ONLY',
          command,
          success,
          module_id: moduleId,
          run_id: runId,
          write_executed: false,
          recipes: plans.map((plan) => ({
            recipe_id: plan.recipe_id,
            steps: plan.steps.map((step) => ({ entity_id: step.entity_id, unique_value: step.unique_value, depends_on: step.depends_on })),
            cleanup: plan.cleanup,
          })),
          plan_files: files,
          issues: result.issues,
        },
        null,
        2,
      )}\n`,
    );
    return success ? 0 : 2;
  }

  if (command === 'doctor') {
    const checks: Check[] = [];
    const modulePack = validateModulePack(`business-modules/${moduleId}`, { root });
    checks.push({ name: 'module-pack', ok: modulePack.valid, detail: modulePack.valid ? '模块清单通过契约校验' : JSON.stringify(modulePack.issues) });

    try {
      const registry = PageMappingRegistry.load(root, moduleId);
      const mappings = registry.all();
      const fields = mappings.reduce((sum, mapping) => sum + mapping.fields.length, 0);
      checks.push({ name: 'page-mappings', ok: mappings.length > 0, detail: `${mappings.length} 个页面，${fields} 个字段` });
    } catch (error) {
      checks.push({ name: 'page-mappings', ok: false, detail: error instanceof Error ? error.message : String(error) });
    }

    try {
      const recipes = loadRecipes(root, moduleId);
      checks.push({
        name: 'data-recipes',
        ok: recipes.issues.length === 0,
        detail: `${recipes.recipes.length} 个配方${recipes.issues.length > 0 ? `，${recipes.issues.length} 个问题` : ''}`,
      });
    } catch (error) {
      checks.push({ name: 'data-recipes', ok: false, detail: error instanceof Error ? error.message : String(error) });
    }

    const knowledge = path.join(root, 'artifacts', 'modules', moduleId, 'knowledge', 'module-summary.json');
    const knowledgeCheck = fs.existsSync(knowledge)
      ? (() => {
          const summary = JSON.parse(fs.readFileSync(knowledge, 'utf8')) as { counts?: { scenarios?: number }; validation?: { valid?: boolean } };
          return { ok: summary.validation?.valid === true, detail: `scenarios=${summary.counts?.scenarios ?? 0}` };
        })()
      : { ok: false, detail: '缺少 module-summary.json，请先运行 platform:prd:scan' };
    checks.push({ name: 'knowledge', ...knowledgeCheck });

    const planFile = path.join(root, 'artifacts', 'modules', moduleId, 'compiled', 'execution-plan.json');
    checks.push({
      name: 'execution-plan',
      ok: fs.existsSync(planFile),
      detail: fs.existsSync(planFile) ? planFile.replace(`${root}${path.sep}`, '') : '缺少 execution-plan.json，请先运行 platform:plan:compile',
    });

    const config = path.join(root, 'config', 'athena.config.json');
    checks.push({ name: 'runtime-config', ok: fs.existsSync(config), detail: fs.existsSync(config) ? 'config/athena.config.json' : '缺少运行配置' });
    checks.push({
      name: 'ui-gate',
      ok: process.env.ALLOW_ERP_UI_TEST === 'true',
      detail: process.env.ALLOW_ERP_UI_TEST === 'true' ? 'ALLOW_ERP_UI_TEST=true' : '未设置 ALLOW_ERP_UI_TEST=true（只读静态检查可用，连接 ERP 会被拒绝）',
    });

    const success = checks.filter((check) => check.name !== 'ui-gate').every((check) => check.ok);
    process.stdout.write(`${JSON.stringify({ mode: 'READ_ONLY', command, success, module_id: moduleId, checks }, null, 2)}\n`);
    return success ? 0 : 2;
  }

  process.stderr.write(`未知命令: ${command}\n`);
  printHelp();
  return 1;
}

process.exitCode = main();
