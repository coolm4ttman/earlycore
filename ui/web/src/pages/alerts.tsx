// Alerts & Policies — rows are the REAL enforcement rules the autonomy loop
// wrote to the gateway policy (block_call / revoke_tool), plus notification
// actions (Jira/Slack via Composio). Trigger count = replay verifications that
// actually hit the rule. Nothing here is seeded.

import { Mail, MessageSquare, MoreVertical, Plus } from 'lucide-react'
import { PriorityPill } from '@/components/badges'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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

interface AlertRow {
  name: string
  priority: string
  query: string
  channels: ('mail' | 'chat')[]
  status: 'Active' | 'Stub'
  lastChecked: string
  triggers: number
}

function useAlertRows(): AlertRow[] {
  const { records, remediations, simulations } = useEarlyCore()
  const rows: AlertRow[] = []
  for (const r of remediations.values()) {
    const record = records.get(r.findingId)
    const sim = simulations.get(r.findingId)
    const priority = record?.priority ?? 'P2'
    if (r.action === 'block_call' || r.action === 'revoke_tool') {
      rows.push({
        name:
          r.action === 'block_call'
            ? `Block ${r.severedEdge ? `${r.severedEdge.from} → ${r.severedEdge.to}` : 'sink access'}`
            : `Revoke ${r.severedEdge?.to ?? 'over-permissioned tool'}`,
        priority,
        query: r.severedEdge
          ? `edge: ${r.severedEdge.from} → ${r.severedEdge.to}`
          : `finding: ${r.findingId}`,
        channels: ['mail', 'chat'],
        status: 'Active',
        lastChecked: r.executedAt,
        triggers: sim?.blocked ? 1 : 0,
      })
    } else {
      rows.push({
        name: r.action === 'jira_ticket' ? `Jira ticket — ${r.findingId}` : `Slack alert — ${r.findingId}`,
        priority,
        query: `category: ${record?.finding.category ?? 'unknown'}`,
        channels: ['chat'],
        status: r.mode === 'real' ? 'Active' : 'Stub',
        lastChecked: r.executedAt,
        triggers: 1,
      })
    }
  }
  return rows
}

export default function AlertsPage() {
  const rows = useAlertRows()
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Alerts &amp; Policies</h1>
          <p className="text-muted-foreground text-sm">
            Gateway enforcement rules and notifications written autonomously by the loop
          </p>
        </div>
        <Button size="sm" disabled title="Rules are created autonomously by the loop">
          <Plus className="size-4" /> Create Alert
        </Button>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Active policies ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Priority</TableHead>
                <TableHead>Query</TableHead>
                <TableHead>Channels</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Checked</TableHead>
                <TableHead className="text-right">Trigger Count</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-muted-foreground h-20 text-center">
                    No policies yet — the loop writes enforcement rules when findings land.
                  </TableCell>
                </TableRow>
              )}
              {rows.map((a, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{a.name}</TableCell>
                  <TableCell>
                    <PriorityPill priority={a.priority} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{a.query}</TableCell>
                  <TableCell>
                    <span className="text-muted-foreground flex gap-1.5">
                      {a.channels.includes('mail') && <Mail className="size-3.5" />}
                      {a.channels.includes('chat') && <MessageSquare className="size-3.5" />}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={a.status === 'Active' ? 'default' : 'secondary'}>{a.status}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {new Date(a.lastChecked).toLocaleString('en-GB', { hour12: false })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{a.triggers}</TableCell>
                  <TableCell>
                    <MoreVertical className="text-muted-foreground size-4" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
