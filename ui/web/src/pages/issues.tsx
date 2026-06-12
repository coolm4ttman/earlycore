import { Clock } from 'lucide-react'
import { OpenedResolvedCard } from '@/components/dashboard-cards'
import { IssuesTable } from '@/components/issues-table'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { severityCounts, useEarlyCore } from '@/lib/store'
import type { Severity } from '@/lib/types'

const CHIP: Record<Severity, { letter: string; cls: string }> = {
  critical: { letter: 'C', cls: 'bg-red-100 text-red-700' },
  high: { letter: 'H', cls: 'bg-orange-100 text-orange-700' },
  medium: { letter: 'M', cls: 'bg-amber-100 text-amber-700' },
  low: { letter: 'L', cls: 'bg-blue-100 text-blue-700' },
}

function IssueSeverityCard() {
  const { records } = useEarlyCore()
  const counts = severityCounts([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue Severity</CardTitle>
        <CardDescription>Current session</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {(Object.keys(counts) as Severity[]).map((sev) => (
          <div key={sev} className="flex items-center gap-3">
            <span
              className={`flex size-7 items-center justify-center rounded-md text-sm font-bold ${CHIP[sev].cls}`}
            >
              {CHIP[sev].letter}
            </span>
            <span className="text-xl font-bold tabular-nums">{counts[sev]}</span>
            <span className="text-muted-foreground text-sm capitalize">{sev} issues</span>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

function IssueAgeCard() {
  const { records } = useEarlyCore()
  // Real time-to-close: EarlyCore remediates autonomously, so this is seconds,
  // not days — that is the point.
  const closed = [...records.values()].filter((r) => r.closedAt)
  const avgSeconds = closed.length
    ? Math.round(
        closed.reduce(
          (sum, r) => sum + (new Date(r.closedAt!).getTime() - new Date(r.openedAt).getTime()) / 1000,
          0,
        ) / closed.length,
      )
    : null
  const stillOpen = [...records.values()].filter((r) => !r.closedAt).length
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Issue Age</CardTitle>
        <CardDescription>Time from detection to verified closure</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
            <Clock className="size-5" />
          </span>
          <div>
            <div className="text-2xl font-bold tabular-nums">
              {avgSeconds === null ? '—' : `${avgSeconds}s`}
            </div>
            <div className="text-muted-foreground text-sm">Average time to closure</div>
          </div>
        </div>
        <div className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Closed autonomously</span>
            <span className="tabular-nums">{closed.length} issues</span>
          </div>
          <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
            <div
              className="h-full rounded-full bg-green-500"
              style={{ width: `${records.size ? (closed.length / records.size) * 100 : 0}%` }}
            />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Still open</span>
            <span className="tabular-nums">{stillOpen} issues</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function IssuesPage() {
  const { records } = useEarlyCore()
  return (
    <div className="space-y-4 p-4 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-3">
        <IssueSeverityCard />
        <OpenedResolvedCard />
        <IssueAgeCard />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Security Issues ({records.size} total)</CardTitle>
        </CardHeader>
        <CardContent>
          <IssuesTable />
        </CardContent>
      </Card>
    </div>
  )
}
