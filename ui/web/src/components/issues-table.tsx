// The Security Issues table used on the Dashboard (compact) and the Issues
// page (full). Rows are real finding lifecycle records.

import { Link } from 'react-router-dom'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { RiskBar, SeverityPill, StatusPill } from '@/components/badges'
import { displayStatus, riskScore, useEarlyCore } from '@/lib/store'

function titleFor(category: string, phase: string, id?: string): string {
  const names: Record<string, string> = {
    'prompt-injection': 'Prompt Injection Detected in LLM Interaction',
    'indirect-injection': 'Indirect Prompt Injection via Untrusted Web Content',
    'pii-leak': 'Customer PII Disclosure Detected in Agent Reply',
    'excessive-agency': 'Unauthorized Privileged Tool Invocation (Excessive Agency)',
    bfla: 'Broken Function-Level Authorization on Payments Tool',
    bola: 'Broken Object-Level Authorization Detected',
    ssrf: 'Server-Side Request Forgery via Agent Tooling',
    hijacking: 'Agent Goal Hijacking Detected',
  }
  let base = names[category]
  if (!base && id) {
    // Derive from the red-team plugin slug in the finding id, e.g.
    // rt-harmful-cybercrime-3 → "Harmful Cybercrime Detected in LLM Interaction".
    const slug = id.replace(/^(rt-|pf-)/, '').replace(/-\d+$/, '')
    const words = slug.split(/[-:]/).filter(Boolean)
    if (words.length) {
      base = `${words.map((w) => w[0].toUpperCase() + w.slice(1)).join(' ')} Detected in LLM Interaction`
    }
  }
  base = base ?? 'Security Finding in Agent Interaction'
  return phase === 'runtime' ? `${base} (Live Intercept)` : base
}

export { titleFor }

export function IssuesTable({ limit }: { limit?: number }) {
  const { records } = useEarlyCore()
  const rows = [...records.values()].slice(0, limit)
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Title</TableHead>
          <TableHead>Severity</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Risk Score</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="text-muted-foreground h-20 text-center">
              No issues yet — run the autonomy loop to red-team the target.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => (
          <TableRow key={r.finding.id}>
            <TableCell>
              <Link to={`/issues/${r.finding.id}`} className="font-medium hover:underline">
                {titleFor(r.finding.category, r.finding.phase, r.finding.id)}
              </Link>
            </TableCell>
            <TableCell>
              <SeverityPill severity={r.finding.severity} />
            </TableCell>
            <TableCell>
              <StatusPill status={displayStatus(r)} />
            </TableCell>
            <TableCell>
              <RiskBar score={riskScore(r)} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

export function SecurityIssuesCard() {
  const { records } = useEarlyCore()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Security Issues ({records.size})</CardTitle>
      </CardHeader>
      <CardContent>
        <IssuesTable limit={6} />
      </CardContent>
    </Card>
  )
}
