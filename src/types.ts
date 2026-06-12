// Shared domain types for EarlyCore.
// The cross-layer graph data model is the differentiator — keep it precise.

export type Severity = 'critical' | 'high' | 'medium' | 'low';

export const SEVERITY_RANK: Record<Severity, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

export function maxSeverity(a: Severity, b: Severity): Severity {
  return SEVERITY_RANK[a] >= SEVERITY_RANK[b] ? a : b;
}

// ── Topology / cross-layer graph ─────────────────────────────────────────────
// Nodes live in LAYERS — the graph spans the whole stack, not just the agent.

export type Layer = 'agent' | 'tool' | 'cloud' | 'data' | 'gpu';
export type Trust = 'trusted' | 'untrusted';
export type Sensitivity = 'public' | 'sensitive';
export type Relation =
  | 'can_invoke'
  | 'can_reach'
  | 'ingests'
  | 'calls_agent'
  | 'runs_on'
  | 'reads_from';

export interface Node {
  id: string;
  label: string;
  layer: Layer;
  // Finer-grained kind within the layer (e.g. 'datasource', 's3_bucket', 'database').
  type: string;
  trust: Trust;
  sensitivity?: Sensitivity;
}

export interface Edge {
  from: string;
  to: string;
  relation: Relation;
}

export interface Topology {
  nodes: Node[];
  edges: Edge[];
}

// An attack path is a chain from an untrusted ingestion point to a sensitive
// sink that a real finding actually traversed — possibly crossing layers
// (agent → tool → cloud → data). Computed from findings + topology, never
// hardcoded. A layer appears in `layersCrossed` only if a node on the path
// belongs to it, and nodes only enter the path when a real signal put them there.
export interface AttackPath {
  nodes: string[];
  layersCrossed: Layer[];
  severity: Severity;
  findingId: string;
}

// ── Findings (normalized from Promptfoo / live probes / runtime) ─────────────

// The category drives the autonomous remediation decision.
export type FindingCategory =
  | 'prompt-injection'
  | 'indirect-injection'
  | 'pii-leak'
  | 'excessive-agency'
  | 'bfla' // broken function-level authorization
  | 'bola' // broken object-level authorization
  | 'ssrf'
  | 'hijacking'
  | 'data-exfiltration'
  | 'other';

export type FindingPhase = 'preprod' | 'runtime';

export interface Finding {
  id: string;
  category: FindingCategory;
  severity: Severity;
  // Pre-prod red team or live runtime interception.
  phase: FindingPhase;
  // Where the malicious instruction entered (an untrusted node id).
  source: string;
  // The sensitive node id the finding reached / tried to reach.
  sink: string;
  // Node ids the attack was OBSERVED to touch (tool calls, reads). The graph
  // only routes a path through nodes backed by one of these real signals.
  observedNodes: string[];
  // Human-readable description of what the probe demonstrated.
  description: string;
  // The probe input that landed, and the agent output that proved the leak.
  probe: string;
  evidence: string;
  // The exact request payload, kept so simulate/ can replay the attack chain
  // after remediation and prove it is now blocked.
  replay?: { message: string; ingested: string };
  // Whether the attack actually succeeded against the target agent.
  landed: boolean;
}

// ── Finding lifecycle ─────────────────────────────────────────────────────────

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';
export type FindingStatus = 'open' | 'remediating' | 'closed' | 'verified-closed';

export interface FindingRecord {
  finding: Finding;
  priority: Priority;
  status: FindingStatus;
  owner: string;
  openedAt: string;
  closedAt?: string;
  jiraKey?: string; // set by the Jira round-trip sync
}

// ── Remediation (Composio) ────────────────────────────────────────────────────

export type RemediationAction =
  | 'block_call'
  | 'revoke_tool'
  | 'jira_ticket'
  | 'slack_alert';

export interface Remediation {
  findingId: string;
  action: RemediationAction;
  // The graph edge severed by the action (now enforced at the gateway), if any.
  severedEdge?: Edge;
  detail: string;
  executedAt: string;
  // Did we hit a real SDK, or a marked stub?
  mode: 'real' | 'stub';
}

// Result of replaying the attack chain after remediation.
export interface SimulationResult {
  findingId: string;
  replayed: boolean; // did we actually re-send the original probe?
  blocked: boolean; // did the gateway stop it this time?
  detail: string;
}

// ── Compliance (PROVE) ────────────────────────────────────────────────────────

export type Framework =
  | 'GDPR'
  | 'SOC 2'
  | 'ISO 42001'
  | 'NIST AI RMF'
  | 'EU AI Act'
  | 'IEEE 7000';

export interface ComplianceScore {
  framework: Framework;
  score: number; // 0–100, computed transparently from findings + actions
  openFindings: number;
  closedFindings: number;
  // The deductions that produced the score, so the number is auditable.
  deductions: { findingId: string; points: number; mitigated: boolean }[];
}

// ── Evidence (Senso) ──────────────────────────────────────────────────────────

export interface ControlMapping {
  findingId: string;
  framework: Framework;
  clause: string; // e.g. "Article 15"
  clauseText: string;
  mode: 'real' | 'stub';
}

export interface AuditorPack {
  generatedAt: string;
  scores: ComplianceScore[];
  mappings: ControlMapping[];
  records: FindingRecord[];
  remediations: Remediation[];
  simulations: SimulationResult[];
}

// ── Agentless ingestion (SEE) ─────────────────────────────────────────────────

// Common event shape every adapter normalizes into.
export interface AgentActivityEvent {
  ts: string;
  adapter: 'api-gateway' | 'langchain' | 'logfire' | 'bedrock';
  // Topology node the activity maps to (resolved from the raw telemetry).
  node: string;
  kind: 'request' | 'response' | 'tool_call' | 'ingestion' | 'llm_call';
  detail: string;
  raw?: unknown;
}

// ── Events streamed to the UI ─────────────────────────────────────────────────

export type EarlyCoreEvent =
  | { kind: 'topology'; topology: Topology }
  | { kind: 'activity'; events: AgentActivityEvent[] }
  | { kind: 'finding'; finding: Finding; record: FindingRecord }
  | { kind: 'path'; path: AttackPath }
  | { kind: 'remediation'; remediation: Remediation }
  | { kind: 'simulation'; result: SimulationResult }
  | { kind: 'compliance'; scores: ComplianceScore[] }
  | { kind: 'evidence'; mapping: ControlMapping }
  | { kind: 'lifecycle'; record: FindingRecord }
  | { kind: 'log'; level: 'info' | 'warn' | 'error'; message: string }
  | { kind: 'stage'; stage: 'see' | 'stop' | 'trace' | 'fix' | 'prove'; detail: string }
  | { kind: 'summary'; bySeverity: Record<Severity, number>; actions: number };
