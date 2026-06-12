// Autonomous Activity — a meaningful timeline of what EarlyCore did on its own,
// built from the real remediation + verification records (not a raw log dump).
// Each entry: an attack EarlyCore caught, the autonomous action it took, and
// whether replaying the attack proved the chain closed.

import { Ban, CheckCircle2, ShieldOff, Ticket, Bell, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { relativeTime, useEarlyCore } from '@/lib/store'
import type { Remediation } from '@/lib/types'

const ACTION_META: Record<
  Remediation['action'],
  { icon: typeof Ban; verb: string; tint: string }
> = {
  block_call: { icon: Ban, verb: 'Blocked exfil path', tint: 'text-red-600 bg-red-50' },
  revoke_tool: { icon: ShieldOff, verb: 'Revoked tool access', tint: 'text-orange-600 bg-orange-50' },
  jira_ticket: { icon: Ticket, verb: 'Opened Jira ticket', tint: 'text-blue-600 bg-blue-50' },
  slack_alert: { icon: Bell, verb: 'Raised Slack alert', tint: 'text-violet-600 bg-violet-50' },
}

export function AutonomousActivity() {
  const { remediations, simulations, records, scanning } = useEarlyCore()

  const items = [...remediations.values()]
    .sort((a, b) => b.executedAt.localeCompare(a.executedAt))
    .map((r) => ({
      remediation: r,
      sim: simulations.get(r.findingId),
      record: records.get(r.findingId),
    }))

  const enforced = items.filter(
    (i) => i.remediation.action === 'block_call' || i.remediation.action === 'revoke_tool',
  ).length
  const verified = items.filter((i) => i.sim?.blocked).length

  return (
    <Card className="flex min-h-0 flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          {scanning && <Loader2 className="size-4 animate-spin text-amber-500" />}
          Autonomous Activity
        </CardTitle>
        <p className="text-muted-foreground text-sm">
          {items.length} actions taken with no human approval · {enforced} enforced · {verified}{' '}
          replay-verified
        </p>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        {items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            {scanning ? 'Scanning — actions will stream in…' : 'No actions yet.'}
          </p>
        ) : (
          <ol className="space-y-3">
            {items.map(({ remediation, sim, record }) => {
              const meta = ACTION_META[remediation.action]
              const Icon = meta.icon
              const closed = sim?.blocked
              return (
                <li key={remediation.findingId} className="flex gap-3">
                  <span className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full ${meta.tint}`}>
                    <Icon className="size-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-sm font-medium">{meta.verb}</span>
                      <span className="text-muted-foreground shrink-0 text-xs">
                        {relativeTime(remediation.executedAt)}
                      </span>
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                      {record?.finding.category ?? remediation.findingId}
                      {remediation.severedEdge &&
                        ` · ${remediation.severedEdge.from} → ${remediation.severedEdge.to}`}
                    </div>
                    {closed !== undefined && (
                      <div
                        className={`mt-1 inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          closed ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        <CheckCircle2 className="size-3" />
                        {closed ? 'Replay verified — chain closed' : 'Tracked'}
                      </div>
                    )}
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  )
}
