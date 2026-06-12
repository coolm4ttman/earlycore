// The cross-layer attack graph — the hero. Clean React Flow: layered lane
// bands (agent → tool → cloud → data → gpu), restrained edges, and lit attack
// paths that animate then grey out when EarlyCore severs them. Honest as ever:
// an edge lights only when a real computed path traversed it; it greys only
// when the loop wrote the enforcement rule AND the replay confirmed the block.

import { useMemo } from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  ReactFlow,
  type Edge,
  type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AutonomousActivity } from '@/components/autonomous-activity'
import { useEarlyCore } from '@/lib/store'
import type { Layer, Severity } from '@/lib/types'

const LANES: { id: Layer; label: string }[] = [
  { id: 'agent', label: 'AGENT' },
  { id: 'tool', label: 'TOOL' },
  { id: 'cloud', label: 'CLOUD' },
  { id: 'data', label: 'DATA' },
  { id: 'gpu', label: 'GPU' },
]
const LANE_H = 116
const LANE_LABEL_W = 92
const CONTENT_W = 760
const GRAPH_W = LANE_LABEL_W + CONTENT_W
const NODE_W = 150

const SEV_COLOR: Record<Severity, string> = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
}
const RANK: Record<Severity, number> = { critical: 4, high: 3, medium: 2, low: 1 }

export default function GraphPage() {
  const { topology, paths, remediations, simulations } = useEarlyCore()

  const { nodes, edges } = useMemo(() => {
    if (!topology) return { nodes: [] as Node[], edges: [] as Edge[] }

    // Real edge/node state.
    const edgeSeverity = new Map<string, Severity>()
    for (const path of paths.values()) {
      for (let i = 0; i < path.nodes.length - 1; i++) {
        const key = `${path.nodes[i]}--${path.nodes[i + 1]}`
        const cur = edgeSeverity.get(key)
        if (!cur || RANK[path.severity] > RANK[cur]) edgeSeverity.set(key, path.severity)
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
        const cur = litNodes.get(id)
        if (!cur || RANK[path.severity] > RANK[cur]) litNodes.set(id, path.severity)
      }
    }

    const nodes: Node[] = []

    // Lane bands (behind everything) + lane labels.
    LANES.forEach((lane, i) => {
      nodes.push({
        id: `band-${lane.id}`,
        position: { x: 0, y: i * LANE_H },
        data: { label: '' },
        draggable: false,
        selectable: false,
        zIndex: -1,
        style: {
          width: GRAPH_W,
          height: LANE_H,
          background: i % 2 === 0 ? 'var(--muted)' : 'transparent',
          opacity: 0.5,
          border: 'none',
          borderRadius: 0,
          pointerEvents: 'none',
        },
      })
      nodes.push({
        id: `lane-${lane.id}`,
        position: { x: 10, y: i * LANE_H + LANE_H / 2 - 10 },
        data: { label: lane.label },
        draggable: false,
        selectable: false,
        style: {
          width: LANE_LABEL_W - 16,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          color: 'var(--muted-foreground)',
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: 2,
          textAlign: 'left' as const,
        },
      })
    })

    // Topology nodes positioned by lane.
    for (let li = 0; li < LANES.length; li++) {
      const laneNodes = topology.nodes.filter((n) => n.layer === LANES[li].id)
      laneNodes.forEach((n, i) => {
        const sev = litNodes.get(n.id)
        const x = LANE_LABEL_W + (CONTENT_W / (laneNodes.length + 1)) * (i + 1) - NODE_W / 2
        const y = li * LANE_H + LANE_H / 2 - 21
        const border = sev
          ? `2px solid ${SEV_COLOR[sev]}`
          : n.trust === 'untrusted'
            ? '2px dashed #f59e0b'
            : '1px solid var(--border)'
        const tag =
          n.trust === 'untrusted' ? '⚠ untrusted' : n.sensitivity === 'sensitive' ? '◆ sensitive' : ''
        nodes.push({
          id: n.id,
          position: { x, y },
          data: {
            label: (
              <div className="flex flex-col gap-0.5 leading-tight">
                <span className="text-[12px] font-semibold">{n.label}</span>
                {tag && (
                  <span className={n.trust === 'untrusted' ? 'text-amber-600' : 'text-blue-600'} style={{ fontSize: 9 }}>
                    {tag}
                  </span>
                )}
              </div>
            ),
          },
          draggable: false,
          style: {
            width: NODE_W,
            padding: '8px 10px',
            border,
            borderRadius: 10,
            background: sev ? `color-mix(in srgb, ${SEV_COLOR[sev]} 7%, white)` : 'white',
            boxShadow: sev ? `0 0 0 3px color-mix(in srgb, ${SEV_COLOR[sev]} 18%, transparent)` : '0 1px 2px rgba(0,0,0,.06)',
            textAlign: 'left' as const,
          },
        })
      })
    }

    const edges: Edge[] = topology.edges.map((e) => {
      const key = `${e.from}--${e.to}`
      const isSevered = severed.has(key)
      const sev = edgeSeverity.get(key)
      const lit = Boolean(sev) && !isSevered
      const color = isSevered ? '#94a3b8' : sev ? SEV_COLOR[sev] : '#d1d5db'
      return {
        id: key,
        source: e.from,
        target: e.to,
        type: 'smoothstep',
        animated: lit,
        label: isSevered ? '✂ severed' : lit ? e.relation : undefined,
        style: {
          stroke: color,
          strokeWidth: lit ? 2.5 : 1.25,
          strokeDasharray: isSevered ? '6 4' : undefined,
          opacity: sev || isSevered ? 1 : 0.55,
        },
        labelStyle: { fontSize: 9, fill: isSevered ? '#64748b' : color, fontWeight: 600 },
        labelBgStyle: { fill: 'white', fillOpacity: 0.9 },
        labelBgPadding: [3, 1] as [number, number],
        markerEnd: { type: MarkerType.ArrowClosed, color, width: 14, height: 14 },
      }
    })

    return { nodes, edges }
  }, [topology, paths, remediations, simulations])

  const litCount = useMemo(() => {
    const n = new Set<string>()
    for (const p of paths.values()) p.nodes.forEach((id) => n.add(id))
    return n.size
  }, [paths])

  if (!topology) {
    return <div className="text-muted-foreground p-10 text-center text-sm">Loading topology…</div>
  }

  return (
    <div className="grid h-[calc(100vh-3rem)] gap-4 p-4 lg:grid-cols-[1fr_340px] lg:p-6">
      <Card className="flex min-h-[460px] flex-col">
        <CardHeader className="pb-3">
          <CardTitle>Cross-Layer Attack Graph</CardTitle>
          <p className="text-muted-foreground text-sm">
            {litCount > 0
              ? `${litCount} nodes on live attack paths. Red = traversed by a real finding · dashed grey = severed by EarlyCore.`
              : 'Edges light up as findings traverse the stack, then grey out when EarlyCore severs the path.'}
          </p>
        </CardHeader>
        <CardContent className="min-h-0 flex-1 pt-0">
          <div className="bg-card h-full min-h-[420px] overflow-hidden rounded-lg border">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              fitView
              fitViewOptions={{ padding: 0.12 }}
              nodesDraggable={false}
              nodesConnectable={false}
              proOptions={{ hideAttribution: true }}
              minZoom={0.4}
              maxZoom={1.5}
            >
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="var(--border)" />
              <Controls showInteractive={false} position="bottom-right" />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>

      <AutonomousActivity />
    </div>
  )
}
