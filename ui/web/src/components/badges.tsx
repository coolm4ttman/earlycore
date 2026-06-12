// The product's pill vocabulary: severity pills (red-100/red-800 style),
// status pills (OPEN red outline, IN REVIEW amber, RESOLVED/VERIFIED green),
// and P0–P3 priority pills.

import { cn } from '@/lib/utils'
import type { Severity } from '@/lib/types'
import type { DisplayStatus } from '@/lib/store'

const pill = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

const SEVERITY_STYLES: Record<Severity, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-amber-100 text-amber-800',
  low: 'bg-blue-100 text-blue-800',
}

export function SeverityPill({ severity, className }: { severity: Severity; className?: string }) {
  return <span className={cn(pill, SEVERITY_STYLES[severity], className)}>{severity.toUpperCase()}</span>
}

const STATUS_STYLES: Record<DisplayStatus, string> = {
  OPEN: 'border border-red-200 bg-red-50 text-red-700',
  'IN REVIEW': 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  VERIFIED: 'bg-emerald-100 text-emerald-800',
}

export function StatusPill({ status, className }: { status: DisplayStatus; className?: string }) {
  return <span className={cn(pill, STATUS_STYLES[status], className)}>{status}</span>
}

export function PriorityPill({ priority, className }: { priority: string; className?: string }) {
  const style =
    priority === 'P0'
      ? 'bg-red-600 text-white'
      : priority === 'P1'
        ? 'bg-orange-500 text-white'
        : priority === 'P2'
          ? 'bg-amber-400 text-amber-950'
          : 'bg-blue-500 text-white'
  return <span className={cn(pill, style, className)}>{priority}</span>
}

export function RiskBar({ score, className }: { score: number; className?: string }) {
  return (
    <span className={cn('flex items-center gap-2', className)}>
      <span className="bg-muted h-1.5 w-20 overflow-hidden rounded-full">
        <span className="block h-full rounded-full bg-red-600" style={{ width: `${score}%` }} />
      </span>
      <span className="text-sm tabular-nums">{score}%</span>
    </span>
  )
}
