// Builds chart series from the REAL findings of the current scan. A scan
// completes in seconds, so plotting against wall-clock collapses everything
// onto one tick. Instead we plot cumulative findings against their arrival
// ORDER (the sequence EarlyCore detected them in) — a faithful, readable curve
// of how the scan surfaced and then closed issues.

import type { FindingRecord, Severity } from './types'

export interface SeriesPoint {
  step: number
  opened: number
  resolved: number
  critical: number
  high: number
  medium: number
}

function isResolved(r: FindingRecord): boolean {
  return r.status === 'verified-closed' || r.status === 'closed'
}

export function buildSeries(records: FindingRecord[]): SeriesPoint[] {
  if (records.length === 0) return []
  // Stable detection order: openedAt, then id.
  const ordered = [...records].sort((a, b) => {
    const t = a.openedAt.localeCompare(b.openedAt)
    return t !== 0 ? t : a.finding.id.localeCompare(b.finding.id)
  })

  const points: SeriesPoint[] = [{ step: 0, opened: 0, resolved: 0, critical: 0, high: 0, medium: 0 }]
  const totals = { opened: 0, resolved: 0, critical: 0, high: 0, medium: 0 }
  ordered.forEach((r, i) => {
    totals.opened++
    if (isResolved(r)) totals.resolved++
    const sev = r.finding.severity as Severity
    if (sev === 'critical') totals.critical++
    else if (sev === 'high') totals.high++
    else if (sev === 'medium') totals.medium++
    points.push({ step: i + 1, ...totals })
  })
  return points
}
