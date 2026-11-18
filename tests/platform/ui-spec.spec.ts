import { describe, expect, test } from '@playwright/test';
import { checkDetail, checkList, orderRelation, summarize } from '../../src/platform/ui-spec/check';
import {
  DetailExpectation,
  DetailObservation,
  FieldObservation,
  ListExpectation,
  ListObservation,
  UiPageResult,
} from '../../src/platform/ui-spec/types';
import { buildSpec, DOCUMENT_BATCH, DOCUMENT_TABS, MASTER_TABS_THREE, MASTER_TABS_TWO } from '../../src/platform/ui-spec/capture';

const listSpec: ListExpectation = {
  tabs: { required: ['全部', '已审核', '审核中', '未审核', '更多'], allow_extra: true },
  columns: { order: ['序号', '单据编号', '供应商编号', '供应商名称', '状态', '操作'], allow_extra: true },
  batch_actions: { order: ['提交', '审核', '驳回', '撤审', '作废', '删除'] },
  actions_by_status: { 已审核: ['查看', '撤审'], 未审核: ['查看', '编辑'] },
  pagination: { required_text: ['条/页'] },
};

const listObserved: ListObservation = {
  tabs: ['全部', '已审核', '审核中', '未审核', '更多', '+'],
  headers: [
    { id: 'cb', text: '', pinned: 'left' },
    { id: 'no', text: '序号', pinned: 'left' },
    { id: 'doc', text: '单据编号', pinned: 'center' },
    { id: 'supp', text: '供应商编号', pinned: 'center' },
    { id: 'suppName', text: '供应商名称', pinned: 'center' },
    { id: 'status', text: '状态', pinned: 'right' },
    { id: 'operate', text: '操作', pinned: 'right' },
  ],
  batchActions: ['提交', '审核', '驳回', '撤审', '作废', '删除'],
  rows: [
    { status: '已审核', actions: ['查看', '撤审'] },
    { status: '未审核', actions: ['查看', '编辑'] },
  ],
  rowCount: 2,
  paginationText: '已选 0 条 / 共 2 条 20 条/页',
};

const detailSpec: DetailExpectation = {
  banner: { require_single_number: true, max_totals: 3, totals: ['价税合计', '无税金额', '税额'] },
  header_groups: { order: ['基本信息', '管理信息'], allow_extra: true },
  field_layout: {
    order: ['运营单元', '单别', '供应商', '采购员'],
    groups: [{ title: '基本信息', fields: ['运营单元', '单别', '供应商', '采购员'] }],
    lookup_fields: ['运营单元', '供应商'],
  },
  grid: { required: true, section_title_pattern: '明细$', columns: ['序号', '品号'] },
  bottom_actions: { order: ['删除', '作废', '复制', '新增', '撤审', '编辑', '保存'] },
};

function field(label: string, value: string, group = '基本信息'): FieldObservation {
  return { label, value, group, required: false, isLookup: true, top: 0, left: 0 };
}

const detailObserved: DetailObservation = {
  banner: { found: true, text: '采购到货单 单号 PO001 价税合计 100 无税金额 88 税额 12' },
  totals: ['价税合计', '无税金额', '税额'],
  headerGroups: ['基本信息', '管理信息', '业务信息'],
  fields: [field('运营单元', '玄鸟公司（000W1）'), field('单别', '一般到货（PO0603）'), field('供应商', '梨柳科技（GT-TB-001）'), field('采购员', '胡居辉（17169）')],
  sectionTitles: ['基本信息', '到货单明细'],
  gridColumns: ['序号', '品号', '品名'],
  bottomActions: ['复制', '新增', '编辑', '保存'],
  statusBadge: '未审核',
  hasSingleNumber: true,
};

function statuses(findings: Array<{ rule: string; status: string }>, rule: string): string[] {
  return findings.filter((finding) => finding.rule === rule).map((finding) => finding.status);
}

describe('UI 规范：顺序判定', () => {
  test('完全一致 / 子序列 / 顺序错误', () => {
    expect(orderRelation(['a', 'b', 'c'], ['a', 'b', 'c'])).toBe('equal');
    expect(orderRelation(['a', 'b', 'c'], ['b', 'c'])).toBe('subsequence');
    expect(orderRelation(['a', 'b', 'c'], ['c', 'a'])).toBe('mismatch');
  });

  test('批量按钮顺序正确时通过', () => {
    const findings = checkList(listSpec, listObserved);
    expect(statuses(findings, 'L1-08')).toEqual(['pass']);
  });

  test('批量按钮乱序时判不符合', () => {
    const findings = checkList(listSpec, { ...listObserved, batchActions: ['删除', '提交', '审核', '撤审'] });
    expect(statuses(findings, 'L1-08')).toEqual(['fail']);
  });

  test('批量按钮缺失时列为待确认', () => {
    const findings = checkList(listSpec, { ...listObserved, batchActions: ['提交', '审核'] });
    expect(statuses(findings, 'L1-08')).toEqual(['unknown']);
  });
});

describe('UI 规范：列表列', () => {
  test('列顺序与状态/操作收尾同时通过', () => {
    const findings = checkList(listSpec, listObserved);
    expect(statuses(findings, 'L1-10')).toEqual(['pass']);
    expect(statuses(findings, 'L1-11')).toEqual(['pass']);
  });

  test('状态与操作之间有其他列时判不符合', () => {
    const observed = {
      ...listObserved,
      headers: [
        ...listObserved.headers.slice(0, 6),
        { id: 'remark', text: '备注', pinned: 'center' as const },
        { id: 'operate', text: '操作', pinned: 'right' as const },
      ],
    };
    const findings = checkList(listSpec, observed);
    expect(statuses(findings, 'L1-11')).toEqual(['fail']);
  });

  test('编号缺少名称列时判不符合', () => {
    const observed = {
      ...listObserved,
      headers: listObserved.headers.map((header) => (header.text === '供应商名称' ? { ...header, text: '供应商简称' } : header)),
    };
    const findings = checkList(listSpec, observed);
    expect(statuses(findings, 'L1-12')).toEqual(['pass']);
    const missing = { ...observed, headers: observed.headers.filter((header) => header.text !== '供应商简称') };
    expect(statuses(checkList(listSpec, missing), 'L1-12')).toEqual(['fail']);
  });

  test('标签组缺少「更多」时列为待确认，不再判失败', () => {
    const findings = checkList(listSpec, { ...listObserved, tabs: ['全部', '已审核', '审核中', '未审核'] });
    expect(statuses(findings, 'L1-03')).toEqual(['unknown']);
  });
});

describe('UI 规范：状态色', () => {
  const withColors = (colors: Record<string, 'green' | 'blue' | 'yellow' | 'orange' | 'gray'>) => ({
    ...listSpec,
    status_colors: colors,
  });

  test('状态色符合规范时通过', () => {
    const observed = {
      ...listObserved,
      rows: [
        { status: '已审核', statusColor: 'rgb(0, 176, 66)', actions: ['查看', '撤审'] },
        { status: '未审核', statusColor: 'rgb(255, 127, 0)', actions: ['查看', '编辑'] },
      ],
    };
    const findings = checkList(withColors({ 已审核: 'green', 未审核: 'yellow' }), observed);
    expect(statuses(findings, 'L1-16')).toEqual(['pass']);
  });

  test('作废/失效的灰蓝色识别为灰色', () => {
    const observed = {
      ...listObserved,
      rows: [{ status: '已审核', statusColor: 'rgb(109, 126, 156)', actions: ['查看'] }],
    };
    const findings = checkList(withColors({ 已审核: 'gray' }), observed);
    expect(statuses(findings, 'L1-16')).toEqual(['pass']);
  });

  test('状态色不符时判不符合', () => {
    const observed = {
      ...listObserved,
      rows: [{ status: '已审核', statusColor: 'rgb(255, 127, 0)', actions: ['查看', '撤审'] }],
    };
    const findings = checkList(withColors({ 已审核: 'green' }), observed);
    expect(statuses(findings, 'L1-16')).toEqual(['fail']);
  });
});

describe('UI 规范：行内按钮', () => {
  test('集合与顺序完全匹配时通过', () => {
    const findings = checkList(listSpec, listObserved);
    expect(statuses(findings, 'L1-14')).toEqual(['pass', 'pass']);
  });

  test('折叠为「…」的前缀视为待确认', () => {
    const observed = { ...listObserved, rows: [{ status: '已审核', actions: ['查看'] }] };
    const findings = checkList(listSpec, observed).filter((finding) => finding.status !== 'skipped');
    expect(statuses(findings, 'L1-14')).toEqual(['unknown']);
  });

  test('出现规范外按钮时判不符合', () => {
    const observed = { ...listObserved, rows: [{ status: '已审核', actions: ['查看', '删除'] }] };
    const findings = checkList(listSpec, observed).filter((finding) => finding.status !== 'skipped');
    expect(statuses(findings, 'L1-14')).toEqual(['fail']);
  });
});

describe('UI 规范：详情字段', () => {
  test('字段顺序、开窗格式、明细与底部按钮均通过', () => {
    const findings = checkDetail(detailSpec, detailObserved);
    expect(statuses(findings, 'D2-06')).toEqual(['pass']);
    expect(statuses(findings, 'D2-08')).toEqual(['pass']);
    expect(statuses(findings, 'D2-15')).toEqual(['pass']);
    expect(statuses(findings, 'D2-19')).toEqual(['pass']);
  });

  test('开窗字段只显示编号时判不符合', () => {
    const observed = {
      ...detailObserved,
      fields: detailObserved.fields.map((item) => (item.label === '供应商' ? { ...item, value: 'GT-TB-001' } : item)),
    };
    const findings = checkDetail(detailSpec, observed);
    expect(statuses(findings, 'D2-08')).toEqual(['fail']);
  });

  test('字段顺序颠倒时判不符合', () => {
    const observed = { ...detailObserved, fields: [...detailObserved.fields].reverse() };
    expect(statuses(checkDetail(detailSpec, observed), 'D2-06')).toEqual(['fail']);
  });

  test('Banner 缺少单号时判不符合', () => {
    const observed = { ...detailObserved, banner: { found: true, text: '采购到货单 价税合计 100' } };
    expect(statuses(checkDetail(detailSpec, observed), 'D2-02')).toEqual(['fail']);
  });

  test('合计项超过上限时判不符合', () => {
    const observed = { ...detailObserved, totals: ['价税合计', '无税金额', '税额', '折扣'] };
    expect(statuses(checkDetail(detailSpec, observed), 'D2-03')).toEqual(['fail']);
  });
});

describe('UI 规范：开窗手动输入与模糊查询', () => {
  const withProbes = (probes: DetailObservation['lookupProbes']): DetailObservation => ({ ...detailObserved, lookupProbes: probes });

  test('可输入且编号模糊可查时通过', () => {
    const findings = checkDetail(detailSpec, withProbes([
      { label: '运营单元', keyword: 'QN0', found: true, editable: true, fuzzy: true, resultCount: 2 },
    ]));
    expect(statuses(findings, 'D2-10')).toEqual(['pass']);
  });

  test('编号模糊查询为 0 条时判不符合', () => {
    const findings = checkDetail(detailSpec, withProbes([
      { label: '运营单元', keyword: 'QN0', found: true, editable: true, fuzzy: false, resultCount: 0 },
    ]));
    expect(statuses(findings, 'D2-10')).toEqual(['fail']);
    expect(findings.find((finding) => finding.rule === 'D2-10')?.note).toContain('QN0');
  });

  test('输入框只读或禁用时记为待确认，不直接判失败', () => {
    const findings = checkDetail(detailSpec, withProbes([
      { label: '供应商', keyword: 'SUPP', found: true, editable: false, fuzzy: false, resultCount: 0 },
    ]));
    expect(statuses(findings, 'D2-10')).toEqual(['unknown']);
  });

  test('无候选数据时记为跳过而非失败', () => {
    const findings = checkDetail(detailSpec, withProbes([
      { label: '供应商', keyword: '', found: true, editable: true, fuzzy: false, resultCount: 0, skippedReason: '无候选数据（可能依赖未满足）' },
    ]));
    expect(statuses(findings, 'D2-10')).toEqual(['unknown']);
  });

  test('未探测到字段时记为待确认', () => {
    expect(statuses(checkDetail(detailSpec, detailObserved), 'D2-10')).toEqual(['unknown']);
  });
});

describe('UI 规范：汇总与采集', () => {
  test('汇总统计页面与规则数', () => {
    const results: UiPageResult[] = [
      { module_id: 'm', page_key: 'p1', page_name: '页1', page_type: 'document', source_ref: { document_id: 'd', file_path: 'f', source_type: 'UI_OBSERVED' }, findings: checkList(listSpec, listObserved) },
      { module_id: 'm', page_key: 'p2', page_name: '页2', page_type: 'document', source_ref: { document_id: 'd', file_path: 'f', source_type: 'UI_OBSERVED' }, findings: [{ rule: 'X', title: 't', expectation: 'e', observed: 'o', status: 'fail', severity: 'P1' }] },
    ];
    const summary = summarize(results);
    expect(summary.total).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.rules).toBeGreaterThan(0);
  });

  test('采集按模块推断页面类型并写入模板期望', () => {
    const masterList: ListObservation = {
      ...listObserved,
      tabs: ['全部', '生效', '失效', '未生效', '更多'],
      batchActions: ['生效', '失效', '删除'],
      rows: [{ status: '生效', actions: ['查看', '编辑'] }],
    };
    const spec = buildSpec({
      module_id: 'foundation',
      page_key: 'currency',
      page_name: '货币信息',
      source_ref: { document_id: 'd', file_path: 'f', source_type: 'UI_OBSERVED' },
      list: masterList,
      detail: detailObserved,
    }) as { page_type: string; expectations: { list: ListExpectation; detail: DetailExpectation } };
    expect(spec.page_type).toBe('master');
    expect(spec.expectations.list.tabs.required).toEqual(MASTER_TABS_THREE);
    expect(spec.expectations.list.batch_actions.order).toEqual(['生效', '取消生效', '失效', '重新生效', '删除']);

    const docSpec = buildSpec({
      module_id: 'purchase',
      page_key: 'purchase-return',
      page_name: '采购退货单',
      source_ref: { document_id: 'd', file_path: 'f', source_type: 'UI_OBSERVED' },
      list: listObserved,
      detail: detailObserved,
    }) as { page_type: string; expectations: { list: ListExpectation } };
    expect(docSpec.page_type).toBe('document');
    expect(docSpec.expectations.list.tabs.required).toEqual(DOCUMENT_TABS);
    expect(docSpec.expectations.list.batch_actions.order).toEqual(DOCUMENT_BATCH);
  });
});
