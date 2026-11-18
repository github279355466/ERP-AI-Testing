import { DetailObservation, FieldObservation, ListObservation, UiPageType } from './types';

export const DOCUMENT_TABS = ['全部', '已审核', '审核中', '未审核', '作废'];
export const MASTER_TABS_THREE = ['全部', '生效', '失效', '未生效'];
export const MASTER_TABS_TWO = ['全部', '生效', '失效'];
export const DOCUMENT_BATCH = ['提交', '审核', '驳回', '撤审', '作废', '删除'];
export const MASTER_BATCH_THREE = ['生效', '取消生效', '失效', '重新生效', '删除'];
export const MASTER_BATCH_TWO = ['生效', '失效', '删除'];
export const DOCUMENT_ACTIONS: Record<string, string[]> = {
  已审核: ['查看', '撤审'],
  审核中: ['查看', '审核', '驳回'],
  未审核: ['查看', '编辑'],
  作废: ['查看'],
};
export const MASTER_ACTIONS_THREE: Record<string, string[]> = {
  生效: ['查看', '编辑', '取消生效', '失效', '删除'],
  未生效: ['查看', '编辑', '生效', '删除'],
  失效: ['查看', '重新生效', '删除'],
};
export const MASTER_ACTIONS_TWO: Record<string, string[]> = {
  生效: ['查看', '编辑', '失效', '删除'],
  失效: ['查看', '生效', '删除'],
};
export const DOCUMENT_BOTTOM = ['删除', '作废', '复制', '新增', '撤审', '驳回', '审核', '提交', '编辑', '取消', '保存并新增', '保存'];
export const MASTER_BOTTOM_THREE = ['删除', '重新生效', '失效', '取消生效', '生效', '复制', '新增', '编辑', '取消', '保存并新增', '保存'];
export const MASTER_BOTTOM_TWO = ['删除', '失效', '生效', '复制', '新增', '编辑', '取消', '保存并新增', '保存'];
export const DOCUMENT_STATUS_COLORS = { 已审核: 'green', 审核中: 'blue', 未审核: 'yellow', 作废: 'gray' } as const;
export const MASTER_STATUS_COLORS = { 生效: 'green', 未生效: 'yellow', 失效: 'gray' } as const;

export function inferPageType(list: ListObservation, moduleId: string): UiPageType {
  const hasMasterTab = list.tabs.some((tab) => ['生效', '未生效', '失效'].includes(tab));
  const hasDocTab = list.tabs.some((tab) => ['已审核', '审核中', '未审核'].includes(tab));
  if (hasMasterTab || list.batchActions.includes('取消生效')) return 'master';
  if (hasDocTab) return 'document';
  const statuses = list.rows.map((row) => row.status);
  if (statuses.some((status) => ['生效', '未生效', '失效'].includes(status))) return 'master';
  if (statuses.some((status) => ['已审核', '审核中', '未审核', '作废'].includes(status))) return 'document';
  return moduleId === 'purchase' ? 'document' : 'master';
}

function groupFields(fields: FieldObservation[]): Array<{ title: string; fields: string[] }> {
  const groups = new Map<string, string[]>();
  for (const field of fields) {
    if (!field.group) continue;
    const bucket = groups.get(field.group) ?? [];
    if (!bucket.includes(field.label)) bucket.push(field.label);
    groups.set(field.group, bucket);
  }
  return [...groups.entries()]
    .filter(([, labels]) => labels.length > 0)
    .map(([title, labels]) => ({ title, fields: labels }));
}

export interface CaptureInput {
  module_id: string;
  page_key: string;
  page_name: string;
  source_ref: { document_id: string; file_path: string; source_type: string; excerpt: string };
  list: ListObservation;
  detail: DetailObservation;
}

export function buildSpec(input: CaptureInput): Record<string, unknown> {
  const type = inferPageType(input.list, input.module_id);
  const isMaster = type === 'master';
  const observedStatuses = [...new Set(input.list.rows.map((row) => row.status))];
  const threeState = observedStatuses.includes('未生效') || input.list.tabs.includes('未生效');

  const templateActions = isMaster ? (threeState ? MASTER_ACTIONS_THREE : MASTER_ACTIONS_TWO) : DOCUMENT_ACTIONS;
  const actionsByStatus: Record<string, string[]> = {};
  for (const status of observedStatuses) {
    if (templateActions[status]) actionsByStatus[status] = templateActions[status];
  }
  if (Object.keys(actionsByStatus).length === 0) {
    for (const [status, actions] of Object.entries(templateActions)) actionsByStatus[status] = actions;
  }

  const columns = input.list.headers.map((header) => header.text).filter((text) => text !== '');
  const fields = input.detail.fields.filter((field) => field.label !== '');
  const fieldOrder = fields.map((field) => field.label).filter((label, index, all) => all.indexOf(label) === index);
  const groups = groupFields(fields);
  const lookupFields = fields
    .filter((field) => field.isLookup && field.value && !/^请选择$/.test(field.value))
    .filter((field) => !/(编号|单号|代码)$/.test(field.label))
    .map((field) => field.label);

  const headerGroups = [...new Set(input.detail.headerGroups.filter((group) => group !== ''))];
  const expectedGroups = isMaster ? headerGroups : ['基本信息', '管理信息', ...headerGroups.filter((group) => group !== '基本信息' && group !== '管理信息')];

  return {
    schema_version: '1.0',
    module_id: input.module_id,
    page_key: input.page_key,
    page_name: input.page_name,
    page_type: type,
    source_ref: input.source_ref,
    expectations: {
      list: {
        tabs: {
          required: isMaster ? (threeState ? MASTER_TABS_THREE : MASTER_TABS_TWO) : DOCUMENT_TABS,
          allow_extra: true,
        },
        columns: { order: columns.length > 0 ? columns : ['序号', '状态', '操作'], allow_extra: true },
        batch_actions: {
          order: isMaster ? (threeState ? MASTER_BATCH_THREE : MASTER_BATCH_TWO) : DOCUMENT_BATCH,
        },
        actions_by_status: actionsByStatus,
        status_colors: isMaster ? { ...MASTER_STATUS_COLORS } : { ...DOCUMENT_STATUS_COLORS },
        pagination: { required_text: ['条/页'] },
      },
      detail: {
        banner: {
          require_single_number: !isMaster,
          max_totals: isMaster ? 0 : 3,
          totals: isMaster ? [] : input.detail.totals,
        },
        header_groups: { order: expectedGroups.length > 0 ? expectedGroups : ['基本信息'], allow_extra: true },
        field_layout: {
          order: fieldOrder.length > 0 ? fieldOrder : ['单号'],
          groups,
          lookup_fields: [...new Set(lookupFields)],
        },
        grid: {
          required: input.detail.gridColumns.length > 0,
          ...(isMaster ? {} : { section_title_pattern: '明细$' }),
          columns: input.detail.gridColumns,
        },
        lookup_input: { require_manual_entry: true, require_fuzzy_query: true, max_fields: 3 },
        bottom_actions: {
          order: isMaster ? (threeState ? MASTER_BOTTOM_THREE : MASTER_BOTTOM_TWO) : DOCUMENT_BOTTOM,
        },
      },
    },
  };
}
