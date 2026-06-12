// Mirrors src/types.ts in the EarlyCore backend — the SSE event contract.

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Layer = 'agent' | 'tool' | 'cloud' | 'data' | 'gpu'

export interface TopoNode {
  id: string
  label: string
  layer: Layer
  type: string
  trust: 'trusted' | 'untrusted'
  sensitivity?: 'public' | 'sensitive'
}

export interface TopoEdge {
  from: string
  to: string
  relation: string
}

export interface Topology {
  nodes: TopoNode[]
  edges: TopoEdge[]
}

export interface Finding {
  id: string
  category: string
  severity: Severity
  phase: 'preprod' | 'runtime'
  source: string
  sink: string
  observedNodes: string[]
  description: string
  probe: string
  evidence: string
  replay?: { message: string; ingested: string }
  landed: boolean
}

export type FindingStatus = 'open' | 'remediating' | 'closed' | 'verified-closed'

export interface FindingRecord {
  finding: Finding
  priority: 'P0' | 'P1' | 'P2' | 'P3'
  status: FindingStatus
  owner: string
  openedAt: string
  closedAt?: string
  jiraKey?: string
}

export interface AttackPath {
  nodes: string[]
  layersCrossed: Layer[]
  severity: Severity
  findingId: string
}

export interface Remediation {
  findingId: string
  action: 'block_call' | 'revoke_tool' | 'jira_ticket' | 'slack_alert'
  severedEdge?: TopoEdge
  detail: string
  executedAt: string
  mode: 'real' | 'stub'
}

export interface SimulationResult {
  findingId: string
  replayed: boolean
  blocked: boolean
  detail: string
}

export interface ComplianceScore {
  framework: string
  score: number
  openFindings: number
  closedFindings: number
  deductions: { findingId: string; points: number; mitigated: boolean }[]
}

export interface ControlMapping {
  findingId: string
  framework: string
  clause: string
  clauseText: string
  mode: 'real' | 'stub'
}

export interface AgentActivityEvent {
  ts: string
  adapter: string
  node: string
  kind: string
  detail: string
}

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
  | { kind: 'summary'; bySeverity: Record<Severity, number>; actions: number }
