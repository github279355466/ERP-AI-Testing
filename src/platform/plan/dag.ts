export type NodeStatus = 'pending' | 'passed' | 'failed' | 'blocked' | 'skipped' | 'cancelled' | 'error';

export interface DagNode {
  id: string;
  depends_on: string[];
}

export interface DagAnalysis {
  order: string[];
  missing: Array<{ node: string; dependency: string }>;
  cycles: string[][];
  acyclic: boolean;
}

export function analyzeDag(nodes: DagNode[]): DagAnalysis {
  const byId = new Map<string, DagNode>();
  for (const node of nodes) {
    if (byId.has(node.id)) throw new Error(`[DAG_DUPLICATE_NODE] ${node.id}`);
    byId.set(node.id, node);
  }
  const missing: Array<{ node: string; dependency: string }> = [];
  for (const node of nodes) {
    for (const dependency of node.depends_on) {
      if (!byId.has(dependency)) missing.push({ node: node.id, dependency });
    }
  }

  const indegree = new Map<string, number>();
  const outgoing = new Map<string, string[]>();
  for (const node of nodes) {
    indegree.set(node.id, node.depends_on.filter((id) => byId.has(id)).length);
    outgoing.set(node.id, []);
  }
  for (const node of nodes) {
    for (const dependency of node.depends_on) {
      if (!byId.has(dependency)) continue;
      outgoing.get(dependency)?.push(node.id);
    }
  }

  const queue = [...indegree.entries()].filter(([, degree]) => degree === 0).map(([id]) => id).sort();
  const order: string[] = [];
  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);
    for (const next of outgoing.get(id) ?? []) {
      const degree = (indegree.get(next) ?? 0) - 1;
      indegree.set(next, degree);
      if (degree === 0) {
        queue.push(next);
        queue.sort();
      }
    }
  }

  const cycles: string[][] = [];
  const remaining = nodes.filter((node) => !order.includes(node.id)).map((node) => node.id);
  if (remaining.length > 0) {
    cycles.push(remaining);
  }
  return {
    order,
    missing,
    cycles,
    acyclic: remaining.length === 0 && missing.length === 0,
  };
}

export interface ExecutionResultNode {
  id: string;
  status: NodeStatus;
}

export function propagateFailure(
  nodes: DagNode[],
  results: ExecutionResultNode[],
  policy: 'block_downstream' | 'skip_downstream' | 'continue',
): ExecutionResultNode[] {
  if (policy === 'continue') return results;
  const statusById = new Map(results.map((result) => [result.id, result.status]));
  const children = new Map<string, string[]>();
  for (const node of nodes) {
    for (const dependency of node.depends_on) {
      const list = children.get(dependency) ?? [];
      list.push(node.id);
      children.set(dependency, list);
    }
  }
  const queue = results
    .filter((result) => result.status === 'failed' || result.status === 'blocked' || result.status === 'error')
    .map((result) => result.id);
  const propagated = new Map<string, NodeStatus>();
  while (queue.length > 0) {
    const current = queue.shift() as string;
    for (const child of children.get(current) ?? []) {
      if (propagated.has(child)) continue;
      const next: NodeStatus = policy === 'skip_downstream' ? 'skipped' : 'blocked';
      propagated.set(child, next);
      statusById.set(child, next);
      queue.push(child);
    }
  }
  return results.map((result) => ({
    ...result,
    status: propagated.get(result.id) ?? result.status,
  }));
}
