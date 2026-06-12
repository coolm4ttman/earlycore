// Dashboard cards mirroring the production layout: Open Issues stats,
// Issues-by-severity chart, Opened & Resolved chart, AI Compliance gauges.
// Every value derives from real session events (see lib/store.tsx).

import { TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { buildSeries } from '@/lib/series'
import { severityCounts, useEarlyCore } from '@/lib/store'
import type { Severity } from '@/lib/types'

const SEVERITY_ACCENT: Record<Severity, string> = {
  critical: 'border-red-500',
  high: 'border-orange-500',
  medium: 'border-amber-400',
  low: 'border-blue-400',
}

export function OpenIssuesCard() {
  const { records } = useEarlyCore()
  const counts = severityCounts([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Open Findings</CardTitle>
        <CardDescription>Across all monitored agents</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3.5">
        {(Object.keys(counts) as Severity[]).map((sev) => (
          <div key={sev} className={`flex items-center border-l-4 pl-3 ${SEVERITY_ACCENT[sev]}`}>
            <div className="flex-1">
              <div className="text-2xl font-bold tabular-nums">{counts[sev]}</div>
              <div className="text-muted-foreground text-sm capitalize">{sev}</div>
            </div>
            {counts[sev] > 0 && (
              <div className="flex items-center gap-1 text-xs text-red-600">
                <TrendingUp className="size-3.5" />
                detected
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

const severityChartConfig = {
  critical: { label: 'Critical', color: 'var(--chart-1)' },
  high: { label: 'High', color: 'var(--chart-2)' },
  medium: { label: 'Medium', color: 'var(--chart-3)' },
} satisfies ChartConfig

export function SeverityChartCard() {
  const { records } = useEarlyCore()
  const data = buildSeries([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Findings by severity</CardTitle>
        <CardDescription>Cumulative, in detection order</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={severityChartConfig} className="h-[200px] w-full">
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} />
              <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area isAnimationActive={false} dataKey="medium" stackId="s" type="monotone" fill="var(--color-medium)" fillOpacity={0.85} stroke="var(--color-medium)" strokeWidth={1.5} />
              <Area isAnimationActive={false} dataKey="high" stackId="s" type="monotone" fill="var(--color-high)" fillOpacity={0.9} stroke="var(--color-high)" strokeWidth={1.5} />
              <Area isAnimationActive={false} dataKey="critical" stackId="s" type="monotone" fill="var(--color-critical)" fillOpacity={0.95} stroke="var(--color-critical)" strokeWidth={1.5} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const openedResolvedConfig = {
  opened: { label: 'Detected', color: 'var(--chart-1)' },
  resolved: { label: 'Auto-resolved', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function OpenedResolvedCard() {
  const { records } = useEarlyCore()
  const data = buildSeries([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Detected vs auto-resolved</CardTitle>
        <CardDescription>Cumulative, in detection order</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={openedResolvedConfig} className="h-[200px] w-full">
            <AreaChart data={data} margin={{ left: -16, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="step" tickLine={false} axisLine={false} tickMargin={8} minTickGap={40} />
              <YAxis allowDecimals={false} width={32} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area isAnimationActive={false} dataKey="opened" type="monotone" fill="var(--color-opened)" fillOpacity={0.15} stroke="var(--color-opened)" strokeWidth={2.5} dot={false} />
              <Area isAnimationActive={false} dataKey="resolved" type="monotone" fill="var(--color-resolved)" fillOpacity={0.25} stroke="var(--color-resolved)" strokeWidth={2.5} dot={false} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm">
      Scanning… findings will appear here.
    </div>
  )
}

// ── Compliance gauges ─────────────────────────────────────────────────────────

function ringColor(score: number): string {
  if (score >= 90) return 'stroke-green-500'
  if (score >= 80) return 'stroke-blue-500'
  if (score >= 70) return 'stroke-orange-400'
  return 'stroke-red-500'
}

export function Gauge({ score, size = 72 }: { score: number; size?: number }) {
  const mid = size / 2
  const r = mid - 6
  const c = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={mid} cy={mid} r={r} fill="none" className="stroke-muted" strokeWidth={7} />
      <circle
        cx={mid}
        cy={mid}
        r={r}
        fill="none"
        className={ringColor(score)}
        strokeWidth={7}
        strokeLinecap="round"
        strokeDasharray={`${(score / 100) * c} ${c}`}
        transform={`rotate(-90 ${mid} ${mid})`}
      />
      <text
        x={mid}
        y={mid}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={size >= 64 ? 14 : 12}
        fontWeight={700}
        className="fill-foreground"
      >
        {score}%
      </text>
    </svg>
  )
}

export function ComplianceCard() {
  const { scores } = useEarlyCore()
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Compliance Posture</CardTitle>
        <CardDescription>
          Residual-risk score per framework — detection plus autonomous closure raises posture
        </CardDescription>
      </CardHeader>
      <CardContent>
        {scores.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Scoring as the scan completes…
          </div>
        ) : (
          <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-center">
            <div className="grid flex-1 grid-cols-3 gap-x-4 gap-y-5 sm:grid-cols-6">
              {scores.map((s) => (
                <div key={s.framework} className="flex flex-col items-center text-center">
                  <Gauge score={s.score} />
                  <div className="mt-2 text-sm font-medium">{s.framework}</div>
                  <div className="text-muted-foreground text-xs tabular-nums">
                    {s.closedFindings} mitigated · {s.openFindings} open
                  </div>
                </div>
              ))}
            </div>
            {avg !== null && (
              <div className="flex items-center gap-3 border-t pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
                <Gauge score={avg} size={64} />
                <div>
                  <div className="text-2xl font-bold">{avg}%</div>
                  <div className="text-muted-foreground text-xs">Overall posture</div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
