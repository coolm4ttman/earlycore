// The cross-layer attack graph — the hero — rendered with React Flow.
// Same honesty contract as always: an edge lights up only when a real computed
// path traversed it; it goes grey-dashed only when the loop actually wrote the
// enforcement rule and the replay confirmed the block.

import { useMemo } from 'react'
import {
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useEarlyCore } from '@/lib/store'
import type { Layer, Severity } from '@/lib/types'

const LANES: Layer[] = ['agent', 'tool', 'cloud', 'data', 'gpu']
const LANE_H = 130
const WIDTH = 860

const SEV_COLOR: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
}

const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export default function GraphPage() {
  const { topology, paths, remediations, simulations, logs } = useEarlyCore()

  const { nodes, edges } = useMemo(() => {
    if (!topology) return { nodes: [] as Node[], edges: [] as Edge[] }

    // Edge / node state from real events.
    const edgeSeverity = new Map<string, Severity>()
    for (const path of paths.values()) {
      for (let i = 0; i < path.nodes.length - 1; i++) {
        const key = `${path.nodes[i]}--${path.nodes[i + 1]}`
        const existing = edgeSeverity.get(key)
        if (!existing || RANK[path.severity] > RANK[existing]) edgeSeverity.set(key, path.severity)
      }
    }
    const severed = new Set<string>()
    for (const r of remediations.values()) {
      if (r.severedEdge && simulations.get(r.findingId)?.blocked) {
        severed.add(`${r.severedEdge.from}--${r.severedEdge.to}`)
      }
    }
    const litNodes = new Map<string, Severity>()
    for (const path of paths.values()) {
      for (const id of path.nodes) {
        const existing = litNodes.get(id)
        if (!existing || RANK[path.severity] > RANK[existing]) litNodes.set(id, path.severity)
      }
    }

    const nodes: Node[] = []

    // Lane labels (non-interactive).
    LANES.forEach((lane, i) => {
      nodes.push({
        id: `lane-${lane}`,
        position: { x: -110, y: i * LANE_H + 28 },
        data: { label: lane.toUpperCase() },
        draggable: false,
        selectable: false,
        style: {
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          color: 'hsl(215.4 16.3% 46.9%)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          width: 90,
          textAlign: 'right' as const,
        },
      })
    })

    // Topology nodes positioned by lane.
    for (const lane of LANES) {
      const laneNodes = topology.nodes.filter((n) => n.layer === lane)
      laneNodes.forEach((n, i) => {
        const sev = litNodes.get(n.id)
        const border = sev
          ? `2.5px solid ${SEV_COLOR[sev]}`
          : n.trust === 'untrusted'
            ? '2px dashed #f59e0b'
            : '1.5px solid hsl(214.3 31.8% 91.4%)'
        nodes.push({
          id: n.id,
          position: {
            x: (WIDTH / (laneNodes.length + 1)) * (i + 1) - 70,
            y: LANES.indexOf(lane) * LANE_H + 20,
          },
          data: {
            label: `${n.trust === 'untrusted' ? '☣ ' : n.sensitivity === 'sensitive' ? '◆ ' : ''}${n.label}`,
          },
          style: {
            border,
            borderRadius: 10,
            background: 'white',
            fontSize: 12,
            fontWeight: 600,
            width: 140,
            boxShadow: sev ? `0 0 14px ${SEV_COLOR[sev]}55` : '0 1px 2px rgba(0,0,0,.05)',
          },
        })
      })
    }

    const edges: Edge[] = topology.edges.map((e) => {
      const key = `${e.from}--${e.to}`
      const isSevered = severed.has(key)
      const sev = edgeSeverity.get(key)
      const color = isSevered ? '#94a3b8' : sev ? SEV_COLOR[sev] : '#cbd5e1'
      return {
        id: key,
        source: e.from,
        target: e.to,
        label: isSevered ? '✂ severed' : e.relation,
        animated: Boolean(sev && !isSevered),
        style: {
          stroke: color,
          strokeWidth: sev && !isSevered ? 2.5 : 1.5,
          strokeDasharray: isSevered ? '6 5' : undefined,
        },
        labelStyle: { fontSize: 9, fill: isSevered ? '#64748b' : 'hsl(215.4 16.3% 46.9%)' },
        labelBgStyle: { fill: 'white', fillOpacity: 0.8 },
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 16, height: 16 },
      }
    })

    return { nodes, edges }
  }, [topology, paths, remediations, simulations])

  return (
    <div className="grid h-[calc(100vh-3rem)] gap-4 p-4 lg:grid-cols-[1fr_320px] lg:p-6">
      <Card className="flex flex-col">
        <CardHeader>
          <CardTitle>Cross-Layer Attack Graph</CardTitle>
          <p className="text-muted-foreground text-sm">
            A path lights only when a real finding traversed it — and goes grey when EarlyCore severs it.
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1">
          <div className="h-full min-h-[420px] rounded-lg border">
            <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: false }}>
              <Background gap={24} />
              <Controls showInteractive={false} />
            </ReactFlow>
          </div>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-red-600" /> critical path</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-orange-600" /> high path</span>
            <span className="flex items-center gap-1.5"><i className="size-2 rounded-full bg-slate-400" /> severed</span>
            <span>☣ untrusted source</span>
            <span>◆ sensitive sink</span>
          </div>
        </CardContent>
      </Card>
      <Card className="flex min-h-0 flex-col">
        <CardHeader>
          <CardTitle>Live feed</CardTitle>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            {logs.length === 0 && (
              <p className="text-muted-foreground text-sm">Run the autonomy loop to see live events.</p>
            )}
            {[...logs].reverse().map((l, i) => (
              <div
                key={i}
                className={`border-l-2 py-1 pl-2 text-xs ${
                  l.level === 'warn'
                    ? 'border-orange-400 text-foreground'
                    : l.level === 'error'
                      ? 'border-red-500 text-red-700'
                      : 'border-border text-muted-foreground'
                }`}
              >
                {l.message}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
