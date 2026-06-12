// AI Agents inventory — rows are the agent-layer nodes of the real topology;
// counts come from findings whose observed chain touched that agent.

import { TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useEarlyCore } from '@/lib/store'

export interface AgentRow {
  id: string
  name: string
  description: string
  critical: number
  high: number
}

export function useAgentRows(): AgentRow[] {
  const { topology, records } = useEarlyCore()
  if (!topology) return []
  return topology.nodes
    .filter((n) => n.layer === 'agent')
    .map((n) => {
      const touched = [...records.values()].filter((r) => r.finding.observedNodes.includes(n.id))
      return {
        id: n.id,
        name: n.label,
        description: `${n.trust === 'trusted' ? 'Trusted' : 'Untrusted'} ${n.type} behind the EarlyCore gateway`,
        critical: touched.filter((r) => r.finding.severity === 'critical').length,
        high: touched.filter((r) => r.finding.severity === 'high').length,
      }
    })
}

export function AgentsTable({ rows }: { rows: AgentRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Agent</TableHead>
          <TableHead>Description</TableHead>
          <TableHead className="text-right">Critical</TableHead>
          <TableHead className="text-right">High</TableHead>
          <TableHead className="text-right">Trend</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((a) => (
          <TableRow key={a.id}>
            <TableCell>
              <div className="font-medium">{a.name}</div>
              <div className="text-muted-foreground text-xs">{a.id}</div>
            </TableCell>
            <TableCell className="text-muted-foreground">{a.description}</TableCell>
            <TableCell className={`text-right tabular-nums ${a.critical ? 'font-semibold text-red-600' : ''}`}>
              {a.critical}
            </TableCell>
            <TableCell className={`text-right tabular-nums ${a.high ? 'font-semibold text-orange-600' : ''}`}>
              {a.high}
            </TableCell>
            <TableCell className="text-right">
              {a.critical + a.high > 0 ? (
                <span className="inline-flex items-center gap-1 text-sm text-red-600">
                  <TrendingUp className="size-3.5" /> 100%
                </span>
              ) : (
                <span className="text-muted-foreground text-sm">—</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function AgentsCard() {
  const rows = useAgentRows()
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Agents ({rows.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <AgentsTable rows={rows} />
      </CardContent>
    </Card>
  )
}
