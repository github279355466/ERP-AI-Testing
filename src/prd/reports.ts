import { CoverageResult } from './link';
import { ValidationResult } from './validate';
import { KnowledgeBundle, OpenQuestion, RuleType } from './types';

function table(headers: string[], rows: string[][]): string {
  const escape = (value: string): string => value.replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
  const lines = [`| ${headers.map(escape).join(' | ')} |`, `| ${headers.map(() => '---').join(' | ')} |`];
  for (const row of rows) lines.push(`| ${row.map(escape).join(' | ')} |`);
  return lines.join('\n');
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

function groupCount<T>(items: T[], key: (item: T) => string): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const value = key(item);
    map.set(value, (map.get(value) ?? 0) + 1);
  }
  return map;
}

function topEntries(map: Map<string, number>, limit: number): Array<[string, number]> {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function renderPrdIndex(bundle: KnowledgeBundle): string {
  const rows = bundle.documents
    .filter((document) => document.source_role === 'PRD')
    .sort((left, right) => left.relative_path.localeCompare(right.relative_path, 'zh-CN'))
    .map((document) => [
      document.id,
      document.relative_path,
      document.module,
      document.title,
      document.doc_version ?? 'UNKNOWN',
      document.doc_date ?? 'UNKNOWN',
      document.biz_model_no ?? 'UNKNOWN',
      document.is_latest ? '是' : '否',
      String(document.section_count),
      String(document.table_count),
    ]);
  const totalSize = bundle.documents.reduce((sum, document) => sum + document.size_bytes, 0);
  return [
    '# PRD 文档索引',
    '',
    `- 生成时间：${bundle.scan.scanned_at}`,
    `- 扫描目录：\`${bundle.scan.source_root}\``,
    `- 文档总数：${bundle.documents.length}（PRD ${bundle.documents.filter((item) => item.source_role === 'PRD').length}，测试用例库 ${bundle.documents.filter((item) => item.source_role === 'TEST_CASE_LIBRARY').length}）`,
    `- 总字节数：${totalSize}`,
    `- 解析器版本：${bundle.documents[0]?.created_by_parser_version ?? '1.0.0'}`,
    '',
    '## 文档清单',
    '',
    table(['document_id', '文件', '模块', '标题', '版本', '日期', 'bizModelNo', '最新版', '章节', '表格'], rows),
    '',
  ].join('\n');
}

export function renderAnalysisReport(bundle: KnowledgeBundle, validation: ValidationResult): string {
  const moduleStats = [...groupCount(bundle.rules, (rule) => rule.module).entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([module, ruleCount]) => {
      const docs = bundle.documents.filter((document) => document.module === module && document.source_role === 'PRD').length;
      const fields = bundle.fields.filter((field) => field.module === module).length;
      const entities = bundle.entities.filter((entity) => entity.module === module).length;
      const scenarios = bundle.scenarios.filter((scenario) => scenario.module === module).length;
      return [module, String(docs), String(entities), String(fields), String(ruleCount), String(scenarios)];
    });

  const ruleTypeStats = topEntries(groupCount(bundle.rules, (rule) => rule.rule_type), 20).map(([type, count]) => {
    const share = pct(count, bundle.rules.length);
    return [type, String(count), share];
  });

  const documentWithoutEntity = bundle.documents.filter(
    (document) => document.source_role === 'PRD' && document.entity_names.length === 0
  ).length;
  const fieldWithoutEntity = bundle.fields.filter((field) => !field.entity_id).length;
  const scenariosWithoutAssertion = bundle.scenarios.filter((scenario) => scenario.assertions.length === 0).length;
  const pendingRules = bundle.rules.filter((rule) => rule.confidence !== 'CONFIRMED').length;

  return [
    '# PRD 分析报告',
    '',
    `生成时间：${bundle.scan.scanned_at}`,
    '',
    '## 一、总体',
    '',
    table(
      ['指标', '数值'],
      [
        ['文档总数', String(bundle.documents.length)],
        ['业务实体', String(bundle.entities.length)],
        ['页面/页签', String(bundle.pages.length)],
        ['字段', String(bundle.fields.length)],
        ['控件', String(bundle.controls.length)],
        ['规则', String(bundle.rules.length)],
        ['动作', String(bundle.actions.length)],
        ['流程', String(bundle.workflows.length)],
        ['依赖关系', String(bundle.dependencies.length)],
        ['场景草案', String(bundle.scenarios.length)],
        ['测试用例库记录', String(bundle.existingCases.length)],
        ['待确认问题', String(bundle.openQuestions.length)],
        ['解析问题', String(bundle.issues.length)],
      ]
    ),
    '',
    '## 二、按模块',
    '',
    table(['模块', 'PRD 文档', '实体', '字段', '规则', '场景'], moduleStats),
    '',
    '## 三、规则类型分布',
    '',
    table(['rule_type', '数量', '占比'], ruleTypeStats),
    '',
    '## 四、质量指标',
    '',
    table(
      ['指标', '数值', '说明'],
      [
        ['明确规则占比', pct(bundle.rules.length - pendingRules, bundle.rules.length), 'confidence=CONFIRMED'],
        ['待确认/歧义规则', String(pendingRules), 'confidence != CONFIRMED'],
        ['文档未识别实体', String(documentWithoutEntity), '缺少业务对象/数据模型'],
        ['历史/差异文档', String(bundle.documents.filter((document) => /\/_(history|diff|review)\//.test(document.relative_path)).length), '仅登记与溯源，不参与场景生成'],
        ['最新版文档', String(bundle.documents.filter((document) => document.source_role === 'PRD' && document.is_latest).length), '参与场景与覆盖率统计'],
        ['字段未归属实体', String(fieldWithoutEntity), 'entity_id 为空'],
        ['无断言场景', String(scenariosWithoutAssertion), '应标记 NEEDS_CONFIRMATION'],
        ['Schema 校验错误', String(validation.errors.length), '见 PARSE_ERRORS.md 与校验输出'],
        ['Schema 校验告警', String(validation.warnings.length), '不阻断但需关注'],
      ]
    ),
    '',
    '## 五、结论与限制',
    '',
    '- 本报告只基于本地 PRD 与测试用例库静态解析，未连接 ERP、未启动浏览器、未执行任何业务操作。',
    '- 规则来自 PRD 表格与字段属性，`PRD_DERIVED` 与 `PENDING` 不得当作已确认业务规则。',
    '- 场景全部为 `DRAFT`，未经评审不得执行。',
    '- 控件类型由「填值方式」推断，未与页面实际 DOM 核对，属候选信息。',
    '',
  ].join('\n');
}

export function renderCoverageMatrix(bundle: KnowledgeBundle, coverage: CoverageResult): string {
  const considered = bundle.rules.filter((rule) => coverage.considered_rule_ids.has(rule.id));
  const ruleTypeRows: string[][] = [];
  const types = [...new Set(considered.map((rule) => rule.rule_type))].sort();
  for (const type of types) {
    const rules = considered.filter((rule) => rule.rule_type === (type as RuleType));
    const covered = rules.filter((rule) => coverage.covered_rule_ids.has(rule.id)).length;
    const scenarioCount = bundle.scenarios.filter((scenario) =>
      scenario.rule_ids.some((ruleId) => rules.some((rule) => rule.id === ruleId))
    ).length;
    ruleTypeRows.push([type, String(rules.length), String(scenarioCount), String(covered), pct(covered, rules.length)]);
  }

  const moduleRows = [...new Set(considered.map((rule) => rule.module))].sort().map((module) => {
    const rules = considered.filter((rule) => rule.module === module);
    const covered = rules.filter((rule) => coverage.covered_rule_ids.has(rule.id)).length;
    const scenarios = bundle.scenarios.filter((scenario) => scenario.module === module).length;
    return [module, String(rules.length), String(scenarios), String(covered), pct(covered, rules.length)];
  });

  const totalCovered = considered.filter((rule) => coverage.covered_rule_ids.has(rule.id)).length;
  return [
    '# 覆盖率矩阵',
    '',
    `生成时间：${bundle.scan.scanned_at}`,
    '',
    '## 一、总览',
    '',
    table(
      ['指标', '数值'],
      [
        ['规则总数（最新版文档）', String(considered.length)],
        ['规则总数（含历史版本）', String(bundle.rules.length)],
        ['场景草案数', String(bundle.scenarios.length)],
        ['已有用例可匹配的规则数', String(totalCovered)],
        ['规则覆盖率（按已有用例）', pct(totalCovered, considered.length)],
        ['已有用例总数', String(bundle.existingCases.length)],
        ['可匹配到规则的用例', String(coverage.matched_case_ids.size)],
        ['用例匹配率', pct(coverage.matched_case_ids.size, bundle.existingCases.length)],
        ['未能匹配到规则的用例', String(coverage.unmatched_cases.length)],
      ]
    ),
    '',
    '说明：规则覆盖率按「对象字段 + 规则类型」与测试用例库做语义匹配，不是规则 ID 直接对应；匹配结果用于发现缺口，不作为用例正确性证据。',
    '',
    '## 二、按规则类型',
    '',
    table(['rule_type', '规则数', '场景数', '已有用例覆盖', '覆盖率'], ruleTypeRows),
    '',
    '## 三、按模块',
    '',
    table(['模块', '规则数', '场景数', '已有用例覆盖', '覆盖率'], moduleRows),
    '',
    '## 四、用例分类分布',
    '',
    table(
      ['category', '用例数'],
      topEntries(groupCount(bundle.existingCases, (item) => item.category), 30).map(([key, value]) => [key, String(value)])
    ),
    '',
    '## 五、未匹配用例（前 50）',
    '',
    coverage.unmatched_cases.length === 0
      ? '无'
      : coverage.unmatched_cases.slice(0, 50).map((caseId) => `- ${caseId}`).join('\n'),
    '',
    '## 六、测试用例库与 PRD 目录对应关系',
    '',
    ...(() => {
      const folders = new Set(
        bundle.documents
          .filter((document) => document.source_role === 'PRD')
          .map((document) => document.relative_path.split('/')[0])
      );
      const modules = [...new Set(bundle.existingCases.map((item) => item.module))].sort();
      const missing = modules.filter((module) => !folders.has(module));
      const rows = missing.map((module) => [
        module,
        String(bundle.existingCases.filter((item) => item.module === module).length),
        'PRD 目录无同名作业',
      ]);
      return rows.length === 0
        ? ['所有用例作业在 PRD 目录中均有同名目录。', '']
        : [
            `共 ${modules.length} 个用例作业，其中 ${missing.length} 个未匹配到同名 PRD 目录（按目录名粗匹配，可能存在命名差异）：`,
            '',
            table(['用例作业', '用例数', '说明'], rows),
            '',
          ];
    })(),
  ].join('\n');
}

function renderQuestionSection(title: string, questions: OpenQuestion[]): string[] {
  if (questions.length === 0) return [`## ${title}`, '', '无', ''];
  const weight: Record<OpenQuestion['severity'], number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  const ordered = [...questions].sort((left, right) => weight[left.severity] - weight[right.severity]);
  return [
    `## ${title}`,
    '',
    table(
      ['ID', '问题', '严重度', '影响', '建议确认对象', '证据'],
      ordered.slice(0, 100).map((question) => [
        question.id,
        question.question,
        question.severity,
        question.impact,
        question.suggested_owner,
        question.evidence.slice(0, 2).join('；'),
      ])
    ),
    questions.length > 100 ? `\n> 仅显示前 100 条，共 ${questions.length} 条；完整清单见 artifacts/knowledge/open-questions.json。` : '',
    '',
  ];
}

export function renderOpenQuestions(bundle: KnowledgeBundle): string {
  const byCategory = groupCount(bundle.openQuestions, (question) => question.category);
  const bySeverity = groupCount(bundle.openQuestions, (question) => question.severity);
  return [
    '# 待确认问题清单',
    '',
    `生成时间：${bundle.scan.scanned_at}`,
    `问题总数：${bundle.openQuestions.length}`,
    '',
    '## 分布',
    '',
    table(['维度', '值', '数量'], [
      ...[...bySeverity.entries()].map(([key, value]) => ['严重度', key, String(value)]),
      ...[...byCategory.entries()].map(([key, value]) => ['类别', key, String(value)]),
    ]),
    '',
    ...renderQuestionSection(
      '版本冲突',
      bundle.openQuestions.filter((question) => question.category === 'VERSION_CONFLICT')
    ),
    ...renderQuestionSection(
      '规则冲突与重复定义',
      bundle.openQuestions.filter((question) => question.category === 'RULE_CONFLICT')
    ),
    ...renderQuestionSection(
      '缺失与歧义',
      bundle.openQuestions.filter((question) =>
        ['MISSING_DEFINITION', 'MISSING_EVIDENCE', 'AMBIGUOUS_RULE', 'INCOMPLETE_STATE_MACHINE'].includes(question.category)
      )
    ),
    ...renderQuestionSection(
      '流程断链',
      bundle.openQuestions.filter((question) => question.category === 'BROKEN_FLOW')
    ),
    ...renderQuestionSection(
      '解析与格式问题',
      bundle.openQuestions.filter((question) => ['PARSE_ERROR', 'UNSUPPORTED_FORMAT'].includes(question.category))
    ),
  ].join('\n');
}

export function renderVersionConflicts(bundle: KnowledgeBundle): string {
  const conflicts = bundle.openQuestions.filter((question) => question.category === 'VERSION_CONFLICT');
  const rows = conflicts.map((question) => [
    question.question,
    question.document_ids.length.toString(),
    question.severity,
    question.suggested_owner,
  ]);
  return [
    '# 版本冲突',
    '',
    `生成时间：${bundle.scan.scanned_at}`,
    '',
    conflicts.length === 0
      ? '未识别到同一业务对象的多个文档版本。'
      : table(['冲突描述', '涉及文档数', '严重度', '建议确认'], rows),
    '',
    '## 版本明细',
    '',
    ...conflicts.map((question) => [`### ${question.question}`, '', ...question.evidence.map((item) => `- ${item}`), ''].join('\n')),
  ].join('\n');
}

export function renderParseErrors(bundle: KnowledgeBundle, unsupportedFiles: string[]): string {
  const rows = bundle.issues.map((issue) => [issue.file_path, issue.parser, issue.stage, issue.message, String(issue.line ?? '')]);
  return [
    '# 解析错误与不支持格式',
    '',
    `生成时间：${bundle.scan.scanned_at}`,
    '',
    `解析问题：${bundle.issues.length}`,
    `不支持格式：${unsupportedFiles.length}`,
    '',
    '## 解析问题',
    '',
    rows.length === 0 ? '无' : table(['文件', '解析器', '阶段', '信息', '行号'], rows),
    '',
    '## 不支持格式',
    '',
    unsupportedFiles.length === 0
      ? '无'
      : unsupportedFiles.map((file) => `- ${file}（当前阶段未实现解析器，未静默忽略）`).join('\n'),
    '',
  ].join('\n');
}

export function renderScanReport(
  bundle: KnowledgeBundle,
  unsupportedFiles: string[],
  skippedFiles: string[]
): string {
  return [
    '# PRD 扫描报告',
    '',
    `- 扫描时间：${bundle.scan.scanned_at}`,
    `- 模式：${bundle.scan.mode}`,
    `- 源目录：\`${bundle.scan.source_root}\``,
    '',
    table(
      ['指标', '数值'],
      [
        ['文件总数', String(bundle.scan.total_files)],
        ['支持格式', String(bundle.scan.supported_files)],
        ['不支持格式', String(bundle.scan.unsupported_files)],
        ['新增', String(bundle.scan.new_documents)],
        ['修改', String(bundle.scan.modified_documents)],
        ['未变化', String(bundle.scan.unchanged_documents)],
        ['源文件缺失', String(bundle.scan.missing_documents)],
        ['解析错误', String(bundle.issues.length)],
      ]
    ),
    '',
    '## 不支持的文件',
    '',
    unsupportedFiles.length === 0 ? '无' : unsupportedFiles.map((file) => `- ${file}`).join('\n'),
    '',
    '## 未参与建模的辅助文件',
    '',
    skippedFiles.length === 0
      ? '无'
      : skippedFiles.map((file) => `- ${file}（辅助资料，当前阶段只登记不建模）`).join('\n'),
    '',
  ].join('\n');
}

export function renderAllReports(
  bundle: KnowledgeBundle,
  validation: ValidationResult,
  coverage: CoverageResult,
  unsupportedFiles: string[],
  skippedFiles: string[]
): Record<string, string> {
  return {
    'PRD_INDEX.md': renderPrdIndex(bundle),
    'PRD_ANALYSIS_REPORT.md': renderAnalysisReport(bundle, validation),
    'COVERAGE_MATRIX.md': renderCoverageMatrix(bundle, coverage),
    'OPEN_QUESTIONS.md': renderOpenQuestions(bundle),
    'VERSION_CONFLICTS.md': renderVersionConflicts(bundle),
    'PARSE_ERRORS.md': renderParseErrors(bundle, unsupportedFiles),
    'scan-report.md': renderScanReport(bundle, unsupportedFiles, skippedFiles),
  };
}
