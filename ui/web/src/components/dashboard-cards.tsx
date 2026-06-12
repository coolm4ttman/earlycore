// Dashboard cards mirroring the production layout: Open Issues stats,
// Issues-by-severity chart, Opened & Resolved chart, AI Compliance gauges.
// Every value derives from real session events (see lib/store.tsx).

import { TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
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
        <CardTitle>Open Issues</CardTitle>
        <CardDescription>This session versus previous run</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(Object.keys(counts) as Severity[]).map((sev) => (
          <div key={sev} className={`flex items-center border-l-4 pl-3 ${SEVERITY_ACCENT[sev]}`}>
            <div className="flex-1">
              <div className="text-2xl font-bold tabular-nums">{counts[sev]}</div>
              <div className="text-muted-foreground text-sm capitalize">{sev} issues</div>
            </div>
            <div className={`flex items-center gap-1 text-xs ${counts[sev] > 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {counts[sev] > 0 && <TrendingUp className="size-3.5" />}
              {counts[sev] > 0 ? '100%' : '0%'}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

const severityChartConfig = {
  critical: { label: 'Critical', color: 'var(--chart-1)' },
  high: { label: 'High', color: 'var(--chart-2)' },
} satisfies ChartConfig

export function SeverityChartCard() {
  const { records } = useEarlyCore()
  const data = buildSeries([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Issues by severity</CardTitle>
        <CardDescription>This session (live)</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={severityChartConfig} className="h-[180px] w-full">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />
              <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area dataKey="critical" type="step" fill="var(--color-critical)" fillOpacity={0.18} stroke="var(--color-critical)" strokeWidth={2} />
              <Area dataKey="high" type="step" fill="var(--color-high)" fillOpacity={0.18} stroke="var(--color-high)" strokeWidth={2} />
            </AreaChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

const openedResolvedConfig = {
  opened: { label: 'Opened', color: 'var(--chart-1)' },
  resolved: { label: 'Resolved', color: 'var(--chart-5)' },
} satisfies ChartConfig

export function OpenedResolvedCard() {
  const { records } = useEarlyCore()
  const data = buildSeries([...records.values()])
  return (
    <Card>
      <CardHeader>
        <CardTitle>Opened and Resolved Issues</CardTitle>
        <CardDescription>This session (live)</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <EmptyChart />
        ) : (
          <ChartContainer config={openedResolvedConfig} className="h-[180px] w-full">
            <LineChart data={data} margin={{ left: 0, right: 8, top: 4 }}>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis dataKey="t" tickLine={false} axisLine={false} tickMargin={8} minTickGap={48} />
              <YAxis allowDecimals={false} width={24} tickLine={false} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Line dataKey="opened" type="step" stroke="var(--color-opened)" strokeWidth={2} dot={false} />
              <Line dataKey="resolved" type="step" stroke="var(--color-resolved)" strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}

function EmptyChart() {
  return (
    <div className="text-muted-foreground flex h-[180px] items-center justify-center text-sm">
      No findings yet — run the autonomy loop.
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

const FRAMEWORK_BLURB: Record<string, string> = {
  'ISO 42001': 'AI Management System certification…',
  'NIST AI RMF': 'Framework for managing AI risks…',
  'EU AI Act': 'European Union AI regulation compliance…',
  'IEEE 7000': 'Ethical standards for AI systems…',
  'SOC 2': 'Service Organization Control certification…',
  GDPR: 'General Data Protection Regulation…',
}

export function ComplianceCard() {
  const { scores } = useEarlyCore()
  const avg = scores.length ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length) : null
  return (
    <Card>
      <CardHeader>
        <CardTitle>AI Compliance Overview Score</CardTitle>
        <CardDescription>Computed from this session's findings and actions</CardDescription>
      </CardHeader>
      <CardContent>
        {scores.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            Scores appear after the first PROVE pass.
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3">
              {scores.map((s) => (
                <div key={s.framework} className="flex flex-col items-center text-center">
                  <Gauge score={s.score} />
                  <div className="mt-2 text-sm font-medium">{s.framework}</div>
                  <div className="text-muted-foreground line-clamp-2 text-xs">
                    {FRAMEWORK_BLURB[s.framework] ?? ''}
                  </div>
                </div>
              ))}
            </div>
            {avg !== null && (
              <div className="mt-6 flex items-center justify-between border-t pt-4">
                <div>
                  <div className="text-muted-foreground text-xs">Overall Compliance</div>
                  <div className="font-semibold">AI Governance &amp; Risk Management</div>
                </div>
                <div className="flex items-center gap-3">
                  <Gauge score={avg} size={56} />
                  <div className="text-right">
                    <div className="text-2xl font-bold">{avg}%</div>
                    <div className="text-muted-foreground text-xs">Average</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
