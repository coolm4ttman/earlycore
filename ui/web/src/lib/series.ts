// Builds chart series from REAL event timestamps within the session. The
// production product charts 30 days of history; a demo run spans seconds, so
// we chart exactly that and label the axis truthfully — no invented history.

import type { FindingRecord, Severity } from './types'

export interface SeriesPoint {
  t: string // HH:MM:SS label
  opened: number
  resolved: number
  critical: number
  high: number
  medium: number
  low: number
}

const fmt = (ms: number) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false })

export function buildSeries(records: FindingRecord[]): SeriesPoint[] {
  const stamps: { ms: number; kind: 'open' | 'close'; severity: Severity }[] = []
  for (const r of records) {
    stamps.push({ ms: new Date(r.openedAt).getTime(), kind: 'open', severity: r.finding.severity })
    if (r.closedAt) stamps.push({ ms: new Date(r.closedAt).getTime(), kind: 'close', severity: r.finding.severity })
  }
  if (stamps.length === 0) return []
  stamps.sort((a, b) => a.ms - b.ms)

  const start = stamps[0].ms - 1000
  const end = stamps[stamps.length - 1].ms + 1000
  // ≤ 90 buckets across the real span (min 1s buckets).
  const bucketMs = Math.max(1000, Math.ceil((end - start) / 90))

  const points: SeriesPoint[] = []
  const totals = { opened: 0, resolved: 0, critical: 0, high: 0, medium: 0, low: 0 }
  let i = 0
  for (let t = start; t <= end; t += bucketMs) {
    while (i < stamps.length && stamps[i].ms <= t) {
      const s = stamps[i++]
      if (s.kind === 'open') {
        totals.opened++
        totals[s.severity]++
      } else {
        totals.resolved++
      }
    }
    points.push({ t: fmt(t), ...totals })
  }
  return points
}
