import fs from 'node:fs';
import path from 'node:path';
import { AthenaConfig, resolveProjectPath } from '../config/athena-config';
import { PrdEntry, PrdIndex, validatePrdIndex } from './prd-index';

export type KnowledgeStatus = 'confirmed' | 'candidate' | 'deprecated';

export interface KnowledgePage {
  id: string;
  name: string;
  type: string;
  status: KnowledgeStatus;
  source: string;
  verifiedAt: string;
  menuPath?: string[];
  workItemCode?: string;
  entity?: string;
  fields?: Array<{ name: string; label: string; type: string; options?: string[] }>;
  notes?: string[];
}

export interface KnowledgeComponent {
  selector?: string;
  row?: string;
  cell?: string;
  verified?: boolean;
  [key: string]: unknown;
}

export interface KnowledgeRule {
  id: string;
  page: string;
  rule: string;
  status: KnowledgeStatus;
  source: string;
  verifiedAt: string | null;
}

export interface KnowledgeBundle {
  pages: KnowledgePage[];
  components: Record<string, KnowledgeComponent>;
  rules: KnowledgeRule[];
  prdIndex?: PrdIndex;
}

const STATUSES: KnowledgeStatus[] = ['confirmed', 'candidate', 'deprecated'];

export function validateKnowledge(raw: { pageMap?: any; componentMap?: any; rules?: any }): string[] {
  const errors: string[] = [];

  const pages = raw.pageMap?.pages ?? [];
  if (!Array.isArray(pages) || pages.length === 0) errors.push('page-map.pages 必须是非空数组');
  const seen = new Set<string>();
  for (const page of pages) {
    if (!page?.id) {
      errors.push('页面条目缺少 id');
      continue;
    }
    if (seen.has(page.id)) errors.push(`页面 id 重复: ${page.id}`);
    seen.add(page.id);
    if (!STATUSES.includes(page.status)) errors.push(`页面 ${page.id} status 非法: ${page.status}`);
    if (page.status === 'confirmed' && !page.verifiedAt) errors.push(`页面 ${page.id} 为 confirmed 但缺少 verifiedAt`);
  }

  const components = raw.componentMap?.controls ?? {};
  if (Object.keys(components).length === 0) errors.push('component-map.controls 不能为空');
  for (const [name, component] of Object.entries<KnowledgeComponent>(components)) {
    if (!(component.selector || (component.row && component.cell))) {
      errors.push(`控件 ${name} 缺少 selector 或 row/cell`);
    }
    if (typeof component.verified !== 'boolean') errors.push(`控件 ${name} 缺少 verified 布尔值`);
  }

  const rules = raw.rules?.rules ?? [];
  const ruleIds = new Set<string>();
  for (const rule of rules) {
    if (!rule?.id) {
      errors.push('业务规则缺少 id');
      continue;
    }
    if (ruleIds.has(rule.id)) errors.push(`业务规则 id 重复: ${rule.id}`);
    ruleIds.add(rule.id);
    if (!STATUSES.includes(rule.status)) errors.push(`业务规则 ${rule.id} status 非法: ${rule.status}`);
    if (rule.status === 'confirmed' && !rule.verifiedAt) errors.push(`业务规则 ${rule.id} 为 confirmed 但缺少 verifiedAt`);
  }

  return errors;
}

export class KnowledgeBase {
  private constructor(readonly bundle: KnowledgeBundle) {}

  static load(config: AthenaConfig): KnowledgeBase {
    const dir = resolveProjectPath(config, config.paths.knowledge);
    const pageMap = JSON.parse(fs.readFileSync(path.join(dir, 'athena-page-map.json'), 'utf8'));
    const componentMap = JSON.parse(fs.readFileSync(path.join(dir, 'athena-component-map.json'), 'utf8'));
    const rules = JSON.parse(fs.readFileSync(path.join(dir, 'athena-business-rules.json'), 'utf8'));

    const errors = validateKnowledge({ pageMap, componentMap, rules });
    if (errors.length > 0) {
      throw new Error(`知识库校验失败:\n- ${errors.join('\n- ')}`);
    }

    const prdFile = path.join(dir, 'athena-prd-map.json');
    let prdIndex: PrdIndex | undefined;
    if (fs.existsSync(prdFile)) {
      const raw = JSON.parse(fs.readFileSync(prdFile, 'utf8'));
      const prdErrors = validatePrdIndex(raw);
      if (prdErrors.length > 0) {
        throw new Error(`PRD 索引校验失败:\n- ${prdErrors.join('\n- ')}`);
      }
      prdIndex = raw as PrdIndex;
    }

    return new KnowledgeBase({
      pages: pageMap.pages,
      components: componentMap.controls,
      rules: rules.rules,
      prdIndex,
    });
  }

  findPage(idOrName: string): KnowledgePage | undefined {
    return this.bundle.pages.find((page) => page.id === idOrName || page.name === idOrName);
  }

  confirmedRules(pageId: string): KnowledgeRule[] {
    return this.bundle.rules.filter((rule) => rule.page === pageId && rule.status === 'confirmed');
  }

  findPrdForPage(pageId: string): PrdEntry | undefined {
    return this.bundle.prdIndex?.entries.find((entry) => entry.pageId === pageId);
  }

  findPrdForWorkItem(workItem: string): PrdEntry | undefined {
    return this.bundle.prdIndex?.entries.find((entry) => entry.workItem === workItem || entry.title === workItem);
  }
}
