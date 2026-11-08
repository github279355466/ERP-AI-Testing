import { BaseAdapter } from './base/base-adapter';

export interface TreeOptions {
  rootSelector: string;
  nodeSelector: string;
  switcherSelector: string;
}

export class TreeAdapter extends BaseAdapter {
  async expand(nodeText: string, options: TreeOptions): Promise<boolean> {
    this.ensurePolicy('read');
    const node = this.node(nodeText, options);
    if ((await node.count()) === 0) throw new Error(`[TREE_NODE_NOT_FOUND] 未找到节点「${nodeText}」`);
    const className = (await node.getAttribute('class')) ?? '';
    if (!className.includes('ant-tree-treenode-switcher-open')) {
      const switcher = node.locator(options.switcherSelector).first();
      if ((await switcher.count()) > 0) {
        await switcher.click({ timeout: this.ctx.timeoutMs });
        await this.settle(300);
        return true;
      }
    }
    return false;
  }

  async select(nodeText: string, options: TreeOptions): Promise<void> {
    this.ensurePolicy('select');
    const node = this.node(nodeText, options);
    if ((await node.count()) === 0) throw new Error(`[TREE_NODE_NOT_FOUND] 未找到节点「${nodeText}」`);
    await node.click({ timeout: this.ctx.timeoutMs });
    await this.settle(300);
  }

  async readNodes(options: TreeOptions): Promise<string[]> {
    return this.ctx.page.evaluate((args) => {
      return Array.from(document.querySelectorAll(args.nodeSelector))
        .map((node) => (node.textContent ?? '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    }, options);
  }

  async isExpanded(nodeText: string, options: TreeOptions): Promise<boolean> {
    const node = this.node(nodeText, options);
    const className = (await node.getAttribute('class').catch(() => '')) ?? '';
    return className.includes('ant-tree-treenode-switcher-open');
  }

  private node(nodeText: string, options: TreeOptions) {
    return this.ctx.page.locator(options.nodeSelector).filter({ hasText: nodeText }).first();
  }
}
