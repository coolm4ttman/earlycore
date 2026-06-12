// Builds the cross-layer attack graph and computes attack paths from REAL
// findings. An attack path = a chain through the topology from a finding's
// untrusted source to its sensitive sink, restricted to nodes the attack was
// actually OBSERVED to touch (tool calls / reads reported by the target or the
// gateway). BFS over the directed edges — never hardcoded, and a layer only
// appears in a path if a really-observed node belongs to it.

import type { AttackPath, Edge, Finding, Layer, Topology } from '../types.js';
import { SEVERITY_RANK } from '../types.js';

export class AttackGraph {
  constructor(private topology: Topology) {}

  private neighbors(from: string): Edge[] {
    return this.topology.edges.filter((e) => e.from === from);
  }

  private nodeExists(id: string): boolean {
    return this.topology.nodes.some((n) => n.id === id);
  }

  layerOf(id: string): Layer | undefined {
    return this.topology.nodes.find((n) => n.id === id)?.layer;
  }

  /**
   * Shortest directed path from `source` to `sink` over the topology edges,
   * visiting only nodes in `allowed`. Returns the node ids, or null if the
   * sink is unreachable through observed nodes — meaning the finding did not
   * actually traverse this topology and gets no path.
   */
  shortestPath(source: string, sink: string, allowed?: Set<string>): string[] | null {
    if (!this.nodeExists(source) || !this.nodeExists(sink)) return null;
    if (source === sink) return [source];

    const permitted = (id: string) => !allowed || allowed.has(id) || id === sink;
    const visited = new Set<string>([source]);
    const queue: string[][] = [[source]];

    while (queue.length > 0) {
      const path = queue.shift()!;
      const tail = path[path.length - 1];
      for (const edge of this.neighbors(tail)) {
        if (visited.has(edge.to) || !permitted(edge.to)) continue;
        const next = [...path, edge.to];
        if (edge.to === sink) return next;
        visited.add(edge.to);
        queue.push(next);
      }
    }
    return null;
  }

  /** Ordered, de-duplicated layers traversed by a node chain. */
  layersCrossed(nodes: string[]): Layer[] {
    const layers: Layer[] = [];
    for (const id of nodes) {
      const layer = this.layerOf(id);
      if (layer && layers[layers.length - 1] !== layer) layers.push(layer);
    }
    return layers;
  }

  /**
   * Compute the attack path for a single landed finding. Returns null if the
   * finding did not land, or if its source→sink chain isn't reachable through
   * the nodes the attack was observed to touch (we never invent a path the
   * evidence doesn't support).
   */
  pathForFinding(finding: Finding): AttackPath | null {
    if (!finding.landed) return null;
    // The attack is only allowed to route through nodes it really touched.
    const allowed = new Set<string>([finding.source, ...finding.observedNodes]);
    const nodes = this.shortestPath(finding.source, finding.sink, allowed);
    if (!nodes) return null;
    return {
      nodes,
      layersCrossed: this.layersCrossed(nodes),
      severity: finding.severity,
      findingId: finding.id,
    };
  }

  /**
   * All attack paths for a batch of findings. Identical node chains are merged
   * to the max severity on the path (path severity = max finding severity).
   */
  attackPaths(findings: Finding[]): AttackPath[] {
    const byChain = new Map<string, AttackPath>();
    for (const f of findings) {
      const p = this.pathForFinding(f);
      if (!p) continue;
      const key = p.nodes.join('→');
      const existing = byChain.get(key);
      if (!existing || SEVERITY_RANK[p.severity] > SEVERITY_RANK[existing.severity]) {
        byChain.set(key, p);
      }
    }
    return [...byChain.values()];
  }

  /**
   * The edge to sever to break a given path: the last hop into the sink. This
   * is what remediation disables (e.g. crm_tool→customer_db). Returns null for
   * trivial paths.
   */
  severingEdge(path: AttackPath): Edge | null {
    if (path.nodes.length < 2) return null;
    const a = path.nodes[path.nodes.length - 2];
    const b = path.nodes[path.nodes.length - 1];
    return this.topology.edges.find((e) => e.from === a && e.to === b) ?? null;
  }
}
