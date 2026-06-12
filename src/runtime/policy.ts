// The enforcement policy the runtime gateway consults on every exchange.
// Remediation WRITES rules here; the gateway READS them — so an autonomous
// action has a real, observable effect: the same attack replayed after
// remediation is actually blocked. File-backed so enforcement survives across
// the orchestrator / gateway / simulate processes.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Edge } from '../types.js';

export interface Policy {
  // Edges severed by block_call: traffic that traverses from→to is withheld.
  blockedEdges: { from: string; to: string }[];
  // Tool nodes revoked by revoke_tool: any exchange that invoked them is withheld.
  revokedTools: string[];
  updatedAt: string;
}

const POLICY_FILE = process.env.EARLYCORE_POLICY_FILE ?? '.earlycore/policy.json';

const EMPTY: Policy = { blockedEdges: [], revokedTools: [], updatedAt: new Date(0).toISOString() };

export function loadPolicy(): Policy {
  try {
    return { ...EMPTY, ...JSON.parse(readFileSync(POLICY_FILE, 'utf8')) };
  } catch {
    return { ...EMPTY };
  }
}

function save(policy: Policy) {
  policy.updatedAt = new Date().toISOString();
  mkdirSync(dirname(POLICY_FILE), { recursive: true });
  writeFileSync(POLICY_FILE, JSON.stringify(policy, null, 2));
}

export function blockEdge(edge: Edge): Policy {
  const policy = loadPolicy();
  if (!policy.blockedEdges.some((e) => e.from === edge.from && e.to === edge.to)) {
    policy.blockedEdges.push({ from: edge.from, to: edge.to });
  }
  save(policy);
  return policy;
}

export function revokeTool(node: string): Policy {
  const policy = loadPolicy();
  if (!policy.revokedTools.includes(node)) policy.revokedTools.push(node);
  save(policy);
  return policy;
}

export function resetPolicy(): void {
  save({ ...EMPTY });
}

/**
 * Does this exchange violate the current policy? `touchedNodes` is the ordered
 * list of topology nodes the agent's tool calls actually traversed.
 */
export function policyVerdict(touchedNodes: string[]): { blocked: boolean; rule?: string } {
  const policy = loadPolicy();
  for (const tool of policy.revokedTools) {
    if (touchedNodes.includes(tool)) {
      return { blocked: true, rule: `revoke_tool:${tool}` };
    }
  }
  for (const edge of policy.blockedEdges) {
    const fromIdx = touchedNodes.indexOf(edge.from);
    if (fromIdx !== -1 && touchedNodes.slice(fromIdx + 1).includes(edge.to)) {
      return { blocked: true, rule: `block_call:${edge.from}→${edge.to}` };
    }
  }
  return { blocked: false };
}
