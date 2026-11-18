import {
  DetailExpectation,
  DetailObservation,
  FieldObservation,
  ListExpectation,
  ListObservation,
  UiFinding,
  UiPageResult,
  UiRunSummary,
  UiSpec,
} from './types';

export function parseRgb(value: string): { r: number; g: number; b: number } | null {
  const match = /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(value);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

export function colorFamily(value: string): 'green' | 'blue' | 'yellow' | 'orange' | 'gray' | 'unknown' {
  const rgb = parseRgb(value);
  if (!rgb) return 'unknown';
  const { r, g, b } = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const spread = max - min;
  if (spread < 60 && max < 210) return 'gray';
  if (b > r + 40 && b > g + 20 && b >= 150) return 'blue';
  if (g > r + 30 && g > b + 20 && g >= 110) return 'green';
  if (r > 200 && g >= 150 && b < 140) return 'yellow';
  if (r > 200 && g >= 80 && b < 140) return 'orange';
  if (spread < 60 && max < 200) return 'gray';
  return 'unknown';
}

export function colorMatches(actual: string, expected: string): boolean {
  const family = colorFamily(actual);
  if (family === 'unknown') return false;
  if (family === expected) return true;
  return (family === 'orange' && expected === 'yellow') || (family === 'yellow' && expected === 'orange');
}

function join(values: string[]): string {
  return values.length === 0 ? '(空)' : values.join(' → ');
}

function missingFrom(expected: string[], actual: string[]): string[] {
  return expected.filter((item) => !actual.includes(item));
}

function extraFrom(expected: string[], actual: string[]): string[] {
  return actual.filter((item) => !expected.includes(item));
}

export function orderRelation(expected: string[], actual: string[]): 'equal' | 'subsequence' | 'mismatch' {
  if (expected.length === actual.length && expected.every((item, index) => item === actual[index])) return 'equal';
  let lastIndex = -1;
  for (const item of actual) {
    const index = expected.indexOf(item, lastIndex + 1);
    if (index < 0) return 'mismatch';
    lastIndex = index;
  }
  return expected.length === actual.length ? 'equal' : 'subsequence';
}

function orderFinding(
  rule: string,
  title: string,
  expectation: string,
  expected: string[],
  actual: string[],
  options: {
    allowExtra: boolean;
    severity: 'P0' | 'P1' | 'P2';
    emptyStatus?: 'fail' | 'unknown';
    missingAsUnknown?: boolean;
  } = {
    allowExtra: false,
    severity: 'P1',
  },
): UiFinding {
  if (actual.length === 0) {
    return {
      rule,
      title,
      expectation,
      observed: '(未观测到)',
      status: options.emptyStatus ?? 'fail',
      severity: options.severity,
    };
  }
  const comparable = options.allowExtra ? actual.filter((item) => expected.includes(item)) : actual;
  const missing = missingFrom(expected, actual);
  const extra = extraFrom(expected, actual);
  const relation = orderRelation(expected, comparable);
  const orderOk = relation !== 'mismatch';
  const setOk = missing.length === 0 && (options.allowExtra || extra.length === 0);
  const notes: string[] = [];
  if (missing.length > 0) notes.push(`缺少：${missing.join('、')}`);
  if (!options.allowExtra && extra.length > 0) notes.push(`多出：${extra.join('、')}`);
  if (!orderOk) notes.push('相对顺序与规范不一致');
  const onlyMissing = orderOk && missing.length > 0 && extra.length === 0;
  return {
    rule,
    title,
    expectation,
    observed: join(actual),
    status: orderOk && setOk ? 'pass' : onlyMissing && options.missingAsUnknown ? 'unknown' : 'fail',
    severity: options.severity,
    note: notes.length > 0 ? notes.join('；') : undefined,
  };
}

export function checkList(spec: ListExpectation, observed: ListObservation): UiFinding[] {
  const findings: UiFinding[] = [];

  const observedTabs = observed.tabs.filter((tab) => tab !== '+');
  const collapsible = ['作废', '未生效'];
  const missingTabs = missingFrom(spec.tabs.required, observedTabs);
  const collapseOk = observedTabs.includes('更多') && missingTabs.length > 0 && missingTabs.every((tab) => collapsible.includes(tab));
  findings.push({
    ...orderFinding(
      'L1-03',
      '状态标签组排列',
      `${join(spec.tabs.required)}（超出容量收进「更多」）`,
      spec.tabs.required,
      observedTabs,
      { allowExtra: true, severity: 'P1', missingAsUnknown: true },
    ),
    ...(collapseOk
      ? { status: 'pass' as const, note: `缺少 ${missingTabs.join('、')}，已按 L1-06 收进「更多」` }
      : {}),
  });

  findings.push({
    rule: 'L1-04',
    title: '允许新增标签',
    expectation: '标签组末尾存在「+」',
    observed: observed.tabs.includes('+') ? '存在「+」' : '未找到「+」',
    status: observed.tabs.includes('+') ? 'pass' : 'fail',
    severity: 'P2',
  });

  findings.push(
    orderFinding(
      'L1-10',
      '列表列顺序',
      join(spec.columns.order),
      spec.columns.order,
      observed.headers.map((header) => header.text).filter((text) => text !== ''),
      { allowExtra: spec.columns.allow_extra === true, severity: 'P1' },
    ),
  );

  const headerTexts = observed.headers.map((header) => header.text || '(勾选)');
  const statusIndex = headerTexts.indexOf('状态');
  const operateIndex = headerTexts.indexOf('操作');
  const tailOk = statusIndex >= 0 && operateIndex === statusIndex + 1 && operateIndex === headerTexts.length - 1;
  findings.push({
    rule: 'L1-11',
    title: '状态列与操作列收尾',
    expectation: '「状态」紧邻「操作」，且「操作」为最后一列',
    observed: `状态位置=${statusIndex >= 0 ? statusIndex + 1 : '未找到'}，操作位置=${operateIndex >= 0 ? operateIndex + 1 : '未找到'}，共 ${headerTexts.length} 列`,
    status: headerTexts.length === 0 || statusIndex < 0 ? 'unknown' : tailOk ? 'pass' : 'fail',
    severity: 'P1',
    note:
      headerTexts.length === 0
        ? '列表未渲染出列头，需检查页面是否就绪'
        : statusIndex < 0
          ? '该页未提供「状态」列，需确认是否适用单据/基础资料模板'
          : undefined,
  });

  const pairProblems: string[] = [];
  observed.headers.forEach((header, index) => {
    if (!header.text.endsWith('编号')) return;
    const base = header.text.slice(0, -2);
    if (/(单据|来源)$/.test(base)) return;
    const candidates = [`${base}名称`, `${base}简称`];
    const next = observed.headers[index + 1];
    if (next && candidates.includes(next.text)) return;
    const exists = observed.headers.some((item) => candidates.includes(item.text));
    pairProblems.push(exists ? `${header.text} 后未紧跟「${candidates[0]}」` : `${header.text} 缺少对应「${candidates[0]}」列`);
  });
  findings.push({
    rule: 'L1-12',
    title: '编号与名称成对且相邻',
    expectation: '编号列后紧跟同名「名称」列，列表页不做「名称（编号）」内含外显',
    observed: headerTexts.join(' | '),
    status: pairProblems.length === 0 ? 'pass' : 'fail',
    severity: 'P2',
    note: pairProblems.length > 0 ? pairProblems.join('；') : undefined,
  });

  findings.push(
    orderFinding(
      'L1-08',
      '批量操作按钮顺序',
      join(spec.batch_actions.order),
      spec.batch_actions.order,
      observed.batchActions,
      { allowExtra: false, severity: 'P1', emptyStatus: 'unknown', missingAsUnknown: true },
    ),
  );

  for (const [status, expectedActions] of Object.entries(spec.actions_by_status)) {
    const row = observed.rows.find((item) => item.status === status);
    if (!row) {
      findings.push({
        rule: 'L1-14',
        title: `行内按钮 · ${status}`,
        expectation: join(expectedActions),
        observed: '当前页无该状态数据',
        status: 'skipped',
        severity: 'P2',
      });
      continue;
    }
    const relation = orderRelation(expectedActions, row.actions);
    const missing = missingFrom(expectedActions, row.actions);
    const extra = extraFrom(expectedActions, row.actions);
    const isPrefix = row.actions.length < expectedActions.length && row.actions.every((action, index) => action === expectedActions[index]);
    findings.push({
      rule: 'L1-14',
      title: `行内按钮 · ${status}`,
      expectation: join(expectedActions),
      observed: join(row.actions),
      status: relation === 'equal' ? 'pass' : extra.length > 0 ? 'fail' : isPrefix ? 'unknown' : 'fail',
      severity: 'P1',
      note:
        relation === 'equal'
          ? undefined
          : `${missing.length > 0 ? `未见：${missing.join('、')}` : ''}${extra.length > 0 ? `${missing.length > 0 ? '；' : ''}多出：${extra.join('、')}` : ''}${isPrefix ? '（可能被列宽「…」收纳，需人工确认）' : ''}${relation === 'mismatch' && extra.length === 0 ? '顺序与规范不一致' : ''}`,
    });
  }

  const colorMap = spec.status_colors ?? {};
  const colorEntries = Object.entries(colorMap);
  if (colorEntries.length > 0) {
    const colorProblems: string[] = [];
    const colorDetails: string[] = [];
    for (const [status, expectedFamily] of colorEntries) {
      const row = observed.rows.find((item) => item.status === status);
      if (!row) {
        colorDetails.push(`${status}(无数据)`);
        continue;
      }
      const family = colorFamily(row.statusColor);
      colorDetails.push(`${status}(${family})`);
      if (!colorMatches(row.statusColor, expectedFamily)) {
        colorProblems.push(`${status}：期望 ${expectedFamily}，实测 ${family}（${row.statusColor}）`);
      }
    }
    findings.push({
      rule: 'L1-16',
      title: '状态列颜色',
      expectation: colorEntries.map(([status, family]) => `${status}-${family}`).join('、'),
      observed: colorDetails.join('、') || '(无状态数据)',
      status: colorProblems.length > 0 ? 'fail' : colorDetails.every((item) => item.endsWith('(无数据)')) ? 'skipped' : 'pass',
      severity: 'P1',
      note: colorProblems.length > 0 ? colorProblems.join('；') : undefined,
    });
  }

  const paginationRequired = spec.pagination?.required_text ?? [];
  const paginationMissing = paginationRequired.filter((token) => !observed.paginationText.includes(token));
  const hasSelected = /已选\s*\d+\s*条/.test(observed.paginationText);
  findings.push({
    rule: 'L1-19',
    title: '分页与条数统计',
    expectation: `存在「已选 N 条」与 ${paginationRequired.join('、') || '条/页'}`,
    observed: observed.paginationText || '(未找到分页区)',
    status: hasSelected && paginationMissing.length === 0 ? 'pass' : 'fail',
    severity: 'P2',
  });

  return findings;
}

function fieldsOfGroup(fields: FieldObservation[], title: string): FieldObservation[] {
  return fields.filter((field) => field.group === title);
}

export function checkDetail(spec: DetailExpectation, observed: DetailObservation): UiFinding[] {
  const findings: UiFinding[] = [];

  findings.push(
    orderFinding(
      'D2-05',
      '单头分组排列',
      join(spec.header_groups.order),
      spec.header_groups.order,
      observed.headerGroups,
      { allowExtra: spec.header_groups.allow_extra === true, severity: 'P2', emptyStatus: 'unknown' },
    ),
  );

  findings.push(
    orderFinding(
      'D2-06',
      '字段排列与顺序',
      join(spec.field_layout.order),
      spec.field_layout.order,
      observed.fields.map((field) => field.label),
      { allowExtra: true, severity: 'P1' },
    ),
  );

  for (const group of spec.field_layout.groups ?? []) {
    const observedFields = fieldsOfGroup(observed.fields, group.title);
    findings.push(
      orderFinding(
        'D2-14',
        `分组字段顺序 · ${group.title}`,
        `${group.title}：${join(group.fields)}`,
        group.fields,
        observedFields.map((field) => field.label),
        { allowExtra: true, severity: 'P1', emptyStatus: 'unknown' },
      ),
    );
  }

  const lookupFields = spec.field_layout.lookup_fields ?? [];
  if (lookupFields.length > 0) {
    const bad: string[] = [];
    const seen: string[] = [];
    for (const label of lookupFields) {
      const field = observed.fields.find((item) => item.label === label);
      if (!field) continue;
      const value = field.value.trim();
      if (value === '' || value === '请选择' || value === '请输入' || value === '--') continue;
      seen.push(label);
      if (!/^.+（.+）$/.test(value)) bad.push(`${label}：${value}`);
    }
    findings.push({
      rule: 'D2-08',
      title: '开窗字段显示格式',
      expectation: '名称（编号），名称在外、编号在内',
      observed: seen.length === 0 ? '(未找到开窗字段)' : `已检查 ${seen.length} 个：${bad.length === 0 ? '全部符合' : bad.join('；')}`,
      status: seen.length === 0 ? 'skipped' : bad.length === 0 ? 'pass' : 'fail',
      severity: 'P1',
    });
  }

  if (spec.banner.require_single_number) {
    const inBanner = /单号/.test(observed.banner.text);
    findings.push({
      rule: 'D2-02',
      title: 'Banner 单号字段',
      expectation: 'Banner 业务信息配置「单号」并支持复制',
      observed: observed.banner.found ? `Banner 文本：${observed.banner.text.slice(0, 120)}` : '未找到 Banner',
      status: inBanner ? 'pass' : 'fail',
      severity: 'P2',
      note: inBanner ? '复制入口属平台配置，需人工确认' : '单号未出现在 Banner，规范要求单号置于 Banner 业务信息',
    });
  }

  if (spec.banner.max_totals === 0) {
    findings.push({
      rule: 'D2-03',
      title: 'Banner 合计项',
      expectation: '基础资料详情不要求合计项',
      observed: observed.totals.length === 0 ? '(无)' : join(observed.totals),
      status: 'skipped',
      severity: 'P2',
    });
  } else {
    const totalProblems: string[] = [];
    if (observed.totals.length === 0) totalProblems.push('Banner 未配置合计项');
    if (observed.totals.length > spec.banner.max_totals) {
      totalProblems.push(`合计项 ${observed.totals.length} 个，超过上限 ${spec.banner.max_totals}`);
    }
    const expectedTotals = spec.banner.totals ?? [];
    const missingTotals = missingFrom(expectedTotals, observed.totals);
    if (expectedTotals.length > 0 && missingTotals.length > 0) totalProblems.push(`缺少合计项：${missingTotals.join('、')}`);
    findings.push({
      rule: 'D2-03',
      title: 'Banner 合计项',
      expectation: `1~${spec.banner.max_totals} 项${expectedTotals.length > 0 ? `，包含 ${expectedTotals.join('、')}` : ''}`,
      observed: join(observed.totals),
      status: totalProblems.length === 0 ? 'pass' : 'fail',
      severity: 'P2',
      note: totalProblems.length > 0 ? totalProblems.join('；') : undefined,
    });
  }

  const pattern = spec.grid.section_title_pattern ? new RegExp(spec.grid.section_title_pattern) : null;
  const sectionMatched = pattern ? observed.sectionTitles.some((title) => pattern.test(title)) : observed.sectionTitles.length > 0;
  const gridOk = !spec.grid.required || (observed.gridColumns.length > 0 && sectionMatched);
  findings.push({
    rule: 'D2-15',
    title: '明细区与明细表',
    expectation: spec.grid.section_title_pattern
      ? `存在匹配 /${spec.grid.section_title_pattern}/ 的明细区与明细表`
      : '存在明细表',
    observed: `分组：${join(observed.sectionTitles)}；明细列 ${observed.gridColumns.length} 个`,
    status: gridOk ? 'pass' : 'fail',
    severity: 'P1',
  });

  if (spec.grid.columns && spec.grid.columns.length > 0) {
    findings.push(
      orderFinding(
        'D2-16',
        '明细列排列',
        join(spec.grid.columns),
        spec.grid.columns,
        observed.gridColumns,
        { allowExtra: true, severity: 'P1' },
      ),
    );
  }

  const lookupConfig = spec.lookup_input ?? { require_manual_entry: true, require_fuzzy_query: true, max_fields: 3 };
  if (!lookupConfig.require_manual_entry && !lookupConfig.require_fuzzy_query) {
    findings.push({
      rule: 'D2-10',
      title: '开窗组件手动输入与模糊查询',
      expectation: '按配置不校验',
      observed: '(不适用)',
      status: 'skipped',
      severity: 'P2',
    });
  } else {
    const probes = observed.lookupProbes ?? [];
    if (probes.length === 0) {
      findings.push({
        rule: 'D2-10',
        title: '开窗组件手动输入与模糊查询',
        expectation: '开窗字段可手动输入，并支持按编号模糊查询',
        observed: '未探测到开窗字段（页面无新增入口或字段无已选值）',
        status: 'unknown',
        severity: 'P1',
        note: '需在新增/编辑表单中抽样验证',
      });
    } else {
      const problems: string[] = [];
      const skipped: string[] = [];
      const details: string[] = [];
      let judged = 0;
      for (const probe of probes) {
        if (!probe.found) {
          skipped.push(`${probe.label}：未找到可探测控件`);
          continue;
        }
        if (!probe.editable) {
          skipped.push(`${probe.label}：输入框只读或被禁用（可能依赖未满足）`);
          details.push(`${probe.label}(只读/禁用)`);
          continue;
        }
        if (probe.skippedReason) {
          skipped.push(`${probe.label}：${probe.skippedReason}`);
          details.push(`${probe.label}(${probe.skippedReason})`);
          continue;
        }
        if (lookupConfig.require_fuzzy_query) {
          judged += 1;
          if (!probe.fuzzy) problems.push(`${probe.label}：输入编号片段「${probe.keyword}」模糊查询返回 ${probe.resultCount} 条`);
        }
        details.push(`${probe.label}(${probe.editable ? '可输入' : '只读'}/${probe.fuzzy ? `模糊${probe.resultCount}条` : '模糊无结果'})`);
      }
      const status = problems.length > 0 ? 'fail' : judged === 0 ? 'unknown' : 'pass';
      findings.push({
        rule: 'D2-10',
        title: '开窗组件手动输入与模糊查询',
        expectation: '开窗字段可手动输入，并支持按编号模糊查询（按表单顺序抽样）',
        observed: `已探测 ${probes.length} 个：${details.join('、') || '(无可判定结果)'}`,
        status,
        severity: 'P1',
        note: [...problems, ...skipped].length > 0 ? [...problems, ...skipped].join('；') : undefined,
      });
    }
  }

  const bottomRelation = orderRelation(spec.bottom_actions.order, observed.bottomActions);
  findings.push({
    rule: 'D2-19',
    title: '底部按钮排列',
    expectation: join(spec.bottom_actions.order),
    observed: join(observed.bottomActions),
    status: observed.bottomActions.length === 0 ? 'fail' : bottomRelation === 'mismatch' ? 'fail' : 'pass',
    severity: 'P1',
    note: bottomRelation === 'subsequence' ? '仅展示当前状态可用按钮，相对顺序与规范一致' : undefined,
  });

  return findings;
}

export function emptyList(): ListObservation {
  return { tabs: [], headers: [], batchActions: [], rows: [], rowCount: 0, paginationText: '' };
}

export function emptyDetail(): DetailObservation {
  return {
    banner: { found: false, text: '' },
    totals: [],
    headerGroups: [],
    fields: [],
    sectionTitles: [],
    gridColumns: [],
    bottomActions: [],
    statusBadge: '',
    hasSingleNumber: false,
  };
}

export function checkPage(spec: UiSpec, list: ListObservation | undefined, detail: DetailObservation | undefined): UiFinding[] {
  return [...checkList(spec.expectations.list, list ?? emptyList()), ...checkDetail(spec.expectations.detail, detail ?? emptyDetail())];
}

export function summarize(results: UiPageResult[]): UiRunSummary {
  const findings = results.flatMap((result) => result.findings);
  const pagesWithFailure = results.filter((result) => result.findings.some((finding) => finding.status === 'fail') || result.error);
  return {
    total: results.length,
    passed: results.length - pagesWithFailure.length,
    failed: pagesWithFailure.length,
    unknown: findings.filter((finding) => finding.status === 'unknown').length,
    skipped: findings.filter((finding) => finding.status === 'skipped').length,
    rules: findings.length,
  };
}
