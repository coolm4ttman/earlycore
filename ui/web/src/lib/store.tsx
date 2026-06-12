// Single SSE-backed store. The backend replays its full event buffer on
// connect, so this reducer rebuilds the complete picture mid-run and stays
// live afterwards. Every number on every page derives from these real events.

/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useReducer, type ReactNode } from 'react'
import type {
  AgentActivityEvent,
  AttackPath,
  ComplianceScore,
  ControlMapping,
  EarlyCoreEvent,
  FindingRecord,
  Remediation,
  Severity,
  SimulationResult,
  Topology,
} from './types'

export interface LogLine {
  level: 'info' | 'warn' | 'error'
  message: string
}

export interface EarlyCoreState {
  connected: boolean
  topology: Topology | null
  records: Map<string, FindingRecord>
  paths: Map<string, AttackPath>
  remediations: Map<string, Remediation>
  simulations: Map<string, SimulationResult>
  mappings: Map<string, ControlMapping>
  scores: ComplianceScore[]
  activity: AgentActivityEvent[]
  logs: LogLine[]
  stage: string | null
  actions: number
}

const initial: EarlyCoreState = {
  connected: false,
  topology: null,
  records: new Map(),
  paths: new Map(),
  remediations: new Map(),
  simulations: new Map(),
  mappings: new Map(),
  scores: [],
  activity: [],
  logs: [],
  stage: null,
  actions: 0,
}

type Action = { type: 'event'; event: EarlyCoreEvent } | { type: 'connected'; value: boolean }

function reducer(state: EarlyCoreState, action: Action): EarlyCoreState {
  if (action.type === 'connected') return { ...state, connected: action.value }
  const ev = action.event
  switch (ev.kind) {
    case 'topology':
      // A new run starts with a topology broadcast — reset run-scoped state.
      return {
        ...initial,
        connected: state.connected,
        topology: ev.topology,
      }
    case 'activity':
      return { ...state, activity: [...state.activity, ...ev.events] }
    case 'finding':
    case 'lifecycle': {
      const records = new Map(state.records)
      records.set(ev.record.finding.id, ev.record)
      return { ...state, records }
    }
    case 'path': {
      const paths = new Map(state.paths)
      paths.set(ev.path.findingId, ev.path)
      return { ...state, paths }
    }
    case 'remediation': {
      const remediations = new Map(state.remediations)
      remediations.set(ev.remediation.findingId, ev.remediation)
      return { ...state, remediations }
    }
    case 'simulation': {
      const simulations = new Map(state.simulations)
      simulations.set(ev.result.findingId, ev.result)
      return { ...state, simulations }
    }
    case 'evidence': {
      const mappings = new Map(state.mappings)
      mappings.set(ev.mapping.findingId, ev.mapping)
      return { ...state, mappings }
    }
    case 'compliance':
      return { ...state, scores: ev.scores }
    case 'stage':
      return { ...state, stage: ev.stage }
    case 'summary':
      return { ...state, actions: ev.actions, stage: null }
    case 'log':
      return { ...state, logs: [...state.logs.slice(-199), { level: ev.level, message: ev.message }] }
    default:
      return state
  }
}

const StoreContext = createContext<EarlyCoreState>(initial)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initial)

  useEffect(() => {
    fetch('/api/topology')
      .then((r) => r.json())
      .then((topology: Topology) => dispatch({ type: 'event', event: { kind: 'topology', topology } }))
      .catch(() => {})

    const sse = new EventSource('/api/stream')
    sse.onopen = () => dispatch({ type: 'connected', value: true })
    sse.onerror = () => dispatch({ type: 'connected', value: false })
    sse.onmessage = (m) => {
      try {
        dispatch({ type: 'event', event: JSON.parse(m.data) })
      } catch {
        // ignore malformed frames
      }
    }
    return () => sse.close()
  }, [])

  return <StoreContext.Provider value={state}>{children}</StoreContext.Provider>
}

export function useEarlyCore() {
  return useContext(StoreContext)
}

export async function runLoop(): Promise<void> {
  await fetch('/api/run', { method: 'POST' })
}

// ── Derivations shared across pages ──────────────────────────────────────────

// Presentation of real severity as the product's 0–100 "risk score". A flat,
// documented mapping — not a measurement: critical 94, high 82, medium 61,
// low 38; +2 when the finding came from live runtime interception.
export function riskScore(record: FindingRecord): number {
  const base: Record<Severity, number> = { critical: 94, high: 82, medium: 61, low: 38 }
  return Math.min(97, base[record.finding.severity] + (record.finding.phase === 'runtime' ? 2 : 0))
}

export type DisplayStatus = 'OPEN' | 'IN REVIEW' | 'RESOLVED' | 'VERIFIED'

export function displayStatus(record: FindingRecord): DisplayStatus {
  switch (record.status) {
    case 'open':
      return 'OPEN'
    case 'remediating':
      return 'IN REVIEW'
    case 'closed':
      return 'RESOLVED'
    case 'verified-closed':
      return 'VERIFIED'
  }
}

export function severityCounts(records: FindingRecord[]): Record<Severity, number> {
  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0 }
  for (const r of records) counts[r.finding.severity]++
  return counts
}

export function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime()
  const s = Math.round(delta / 1000)
  if (s < 5) return 'just now'
  if (s < 60) return `${s}s ago`
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.round(h / 24)}d ago`
}
