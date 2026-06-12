// The product's horizontal attack-path step cards, rendered from the REAL
// computed AttackPath (graph BFS over observed nodes) plus the real
// remediation outcome. Nothing here is drawn unless the backend computed it.

import { AlertTriangle, ArrowRight, Bot, Database, Globe, Shield, Wrench } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { SeverityPill } from '@/components/badges'
import { useEarlyCore } from '@/lib/store'
import type { AttackPath, Severity, TopoNode } from '@/lib/types'

type StepState = 'vulnerable' | 'warning' | 'protected'

interface Step {
  category: string
  label: string
  icon: typeof Globe
  state: StepState
  severity?: Severity
}

const STATE_STYLES: Record<StepState, string> = {
  vulnerable: 'border-red-300 bg-red-50/50',
  warning: 'border-amber-300 bg-amber-50/50',
  protected: 'border-green-300 bg-green-50/50',
}

function stepFor(node: TopoNode, severity: Severity): Step {
  if (node.trust === 'untrusted') {
    return { category: 'ENTRY POINT', label: node.label, icon: Globe, state: 'warning', severity }
  }
  switch (node.layer) {
    case 'agent':
      return { category: 'AI AGENT', label: node.label, icon: Bot, state: 'warning', severity }
    case 'data':
      return { category: 'DATA', label: node.label, icon: Database, state: 'vulnerable', severity }
    case 'tool':
      return { category: 'TOOL', label: node.label, icon: Wrench, state: 'vulnerable', severity }
    default:
      return {
        category: node.layer.toUpperCase(),
        label: node.label,
        icon: Wrench,
        state: 'vulnerable',
        severity,
      }
  }
}

export function AttackPathCard({ findingId }: { findingId: string }) {
  const { topology, paths, remediations, simulations } = useEarlyCore()
  const path: AttackPath | undefined = paths.get(findingId)
  if (!path || !topology) return null

  const remediation = remediations.get(findingId)
  const sim = simulations.get(findingId)
  const severed = Boolean(
    sim?.blocked && (remediation?.action === 'block_call' || remediation?.action === 'revoke_tool'),
  )

  const steps: Step[] = path.nodes
    .map((id) => topology.nodes.find((n) => n.id === id))
    .filter((n): n is TopoNode => Boolean(n))
    .map((n) => stepFor(n, path.severity))

  steps.push(
    severed
      ? { category: 'SECURITY', label: 'Severed by EarlyCore', icon: Shield, state: 'protected' }
      : { category: 'SECURITY', label: 'Flagged by EarlyCore', icon: AlertTriangle, state: 'warning' },
  )

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Shield className="size-4" /> Attack Path
        </CardTitle>
        <span className="text-muted-foreground text-xs">
          {steps.length} steps · layers: {path.layersCrossed.join(' → ')}
        </span>
      </CardHeader>
      <CardContent>
        <div className="flex items-stretch gap-2 overflow-x-auto pb-2">
          {steps.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <div
                className={`flex w-40 shrink-0 flex-col rounded-lg border-2 p-3 ${STATE_STYLES[s.state]} ${severed && s.state !== 'protected' ? 'opacity-60' : ''}`}
              >
                <div className="text-muted-foreground flex items-center gap-1.5 text-[10px] font-semibold tracking-wider">
                  <span className="bg-background flex size-4 items-center justify-center rounded-full border text-[10px] font-bold">
                    {i + 1}
                  </span>
                  <s.icon className="size-3" />
                  {s.category}
                </div>
                <div className="mt-1.5 line-clamp-2 text-xs font-medium">{s.label}</div>
                <div className="mt-auto pt-2">
                  {s.state === 'protected' ? (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-semibold text-green-800">
                      PROTECTED
                    </span>
                  ) : (
                    s.severity && <SeverityPill severity={s.severity} className="px-2 text-[10px]" />
                  )}
                </div>
              </div>
              {i < steps.length - 1 && (
                <ArrowRight className="text-muted-foreground size-4 shrink-0" />
              )}
            </div>
          ))}
        </div>
        <div className="text-muted-foreground mt-2 flex items-center gap-4 text-xs">
          <span className="font-semibold tracking-wider">LEGEND</span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-green-500" /> Protected
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-amber-400" /> Warning
          </span>
          <span className="flex items-center gap-1.5">
            <i className="size-2 rounded-full bg-red-500" /> Vulnerable
          </span>
        </div>
      </CardContent>
    </Card>
  )
}
