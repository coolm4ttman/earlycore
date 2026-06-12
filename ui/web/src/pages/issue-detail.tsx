import { Link, useParams } from 'react-router-dom'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  ChevronRight,
  Download,
  ExternalLink,
  MessageSquare,
  Clock,
} from 'lucide-react'
import { PriorityPill, SeverityPill, StatusPill } from '@/components/badges'
import { AttackPathCard } from '@/components/attack-path'
import { titleFor } from '@/components/issues-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { displayStatus, relativeTime, riskScore, useEarlyCore } from '@/lib/store'

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>()
  const state = useEarlyCore()
  const record = id ? state.records.get(id) : undefined

  if (!record) {
    return (
      <div className="text-muted-foreground p-10 text-center text-sm">
        Issue not found —{' '}
        <Link to="/issues" className="underline">
          back to Issues
        </Link>
      </div>
    )
  }

  const { finding } = record
  const remediation = state.remediations.get(finding.id)
  const sim = state.simulations.get(finding.id)
  const mapping = state.mappings.get(finding.id)
  const traces = state.activity.filter((a) => finding.observedNodes.includes(a.node))

  const exportReport = () => {
    const blob = new Blob(
      [JSON.stringify({ record, remediation, simulation: sim, controlMapping: mapping }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `earlycore-${finding.id}.json`
    a.click()
  }

  return (
    <div className="space-y-4 p-4 lg:p-6">
      <Link
        to="/issues"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 text-sm"
      >
        <ArrowLeft className="size-4" /> Back to Issues
      </Link>

      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-orange-600">
          <AlertCircle className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">{titleFor(finding.category, finding.phase, finding.id)}</h1>
          <p className="text-muted-foreground text-sm">Issue · {finding.id}</p>
        </div>
        <Button variant="outline" size="sm" className="ml-auto" onClick={exportReport}>
          <Download className="size-4" /> Export Report
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="investigation">Investigation</TabsTrigger>
          <TabsTrigger value="remediation">Remediation</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="space-y-5">
              <p className="text-sm leading-relaxed">
                EarlyCore detected <span className="font-medium">{finding.category}</span>{' '}
                {finding.phase === 'runtime'
                  ? 'in live traffic at the interception gateway, before the response left the boundary.'
                  : 'during the pre-production red team against the target agent.'}{' '}
                {finding.description}
              </p>
              <div className="grid grid-cols-2 gap-x-6 gap-y-4 text-sm md:grid-cols-4">
                <Meta label="Severity">
                  <SeverityPill severity={finding.severity} />
                </Meta>
                <Meta label="Status">
                  <StatusPill status={displayStatus(record)} />
                </Meta>
                <Meta label="Priority">
                  <PriorityPill priority={record.priority} />
                </Meta>
                <Meta label="Risk Score">
                  <span className="font-bold text-red-600">{riskScore(record)}%</span>
                </Meta>
                <Meta label="Assigned To">{record.owner}</Meta>
                <Meta label="Scanner">{finding.id.startsWith('rt-runtime') ? 'Runtime gateway inspector' : 'Red team probe'}</Meta>
                <Meta label="Detected">{relativeTime(record.openedAt)}</Meta>
                <Meta label="Agent">
                  <Link to="/agents" className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                    <Bot className="size-3.5" /> View agent
                  </Link>
                </Meta>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="size-4" /> Execution Traces
              </CardTitle>
            </CardHeader>
            <CardContent>
              {traces.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  No gateway telemetry ingested for this finding's nodes (agent offline or stub run).
                </p>
              ) : (
                <div className="divide-y">
                  {traces.slice(0, 8).map((t, i) => (
                    <div key={i} className="flex items-center gap-3 py-2 text-sm">
                      <ChevronRight className="text-muted-foreground size-3.5" />
                      <span className="size-2 rounded-full bg-green-500" />
                      <Badge variant="secondary" className="text-[10px] tracking-wider uppercase">
                        {t.adapter}
                      </Badge>
                      <span className="truncate">
                        {t.node} — {t.detail}
                      </span>
                      <span className="text-muted-foreground ml-auto shrink-0 text-xs tabular-nums">
                        {new Date(t.ts).toLocaleTimeString('en-GB', { hour12: false })}
                      </span>
                      <Badge className="bg-green-100 text-[10px] text-green-800">OBSERVED</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {record.jiraKey && (
            <Card>
              <CardHeader>
                <CardTitle>Linked Tickets</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 text-sm">
                  <ExternalLink className="size-4 text-blue-600" />
                  <span className="font-medium text-blue-600">{record.jiraKey}</span>
                  <span className="text-muted-foreground">
                    [{finding.severity.toUpperCase()}] {titleFor(finding.category, finding.phase, finding.id)}
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          <AttackPathCard findingId={finding.id} />
        </TabsContent>

        {/* ── Investigation ───────────────────────────────────────────────── */}
        <TabsContent value="investigation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-muted-foreground text-xs tracking-wider uppercase">
                Forensic Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <Meta label="Finding ID">
                <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{finding.id}</code>
              </Meta>
              <Meta label="Attack payload (verbatim)">
                <pre className="bg-muted mt-1 rounded-md p-3 text-xs whitespace-pre-wrap">{finding.probe}</pre>
              </Meta>
              <Meta label="Observed evidence">
                <pre className="bg-muted mt-1 rounded-md p-3 text-xs whitespace-pre-wrap">{finding.evidence}</pre>
              </Meta>
              <Meta label="Nodes the attack actually touched">
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {finding.observedNodes.map((n) => (
                    <Badge key={n} variant="outline">
                      {n}
                    </Badge>
                  ))}
                </div>
              </Meta>
            </CardContent>
          </Card>

          {mapping && (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle className="text-muted-foreground text-xs tracking-wider uppercase">
                  Control Mapping
                </CardTitle>
                <Badge variant={mapping.mode === 'real' ? 'default' : 'secondary'}>
                  {mapping.mode === 'real' ? 'Senso-grounded' : 'Offline clause set (stub)'}
                </Badge>
              </CardHeader>
              <CardContent className="text-sm">
                <div className="border-l-2 border-blue-400 pl-3">
                  <div className="font-medium">
                    {mapping.framework} — {mapping.clause}
                  </div>
                  <p className="text-muted-foreground mt-1 leading-relaxed">{mapping.clauseText}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── Remediation ─────────────────────────────────────────────────── */}
        <TabsContent value="remediation" className="space-y-4">
          {!remediation ? (
            <p className="text-muted-foreground p-4 text-sm">No remediation recorded yet.</p>
          ) : (
            <Card>
              <CardHeader className="flex-row items-center justify-between">
                <CardTitle>Autonomous Action</CardTitle>
                <Badge variant={remediation.mode === 'real' ? 'default' : 'secondary'}>
                  {remediation.mode === 'real' ? 'Executed' : 'Stub (no sponsor key)'}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <Meta label="Action">
                  <code className="bg-muted rounded px-1.5 py-0.5 text-xs">{remediation.action}</code>
                </Meta>
                {remediation.severedEdge && (
                  <Meta label="Severed edge">
                    <code className="bg-muted rounded px-1.5 py-0.5 text-xs">
                      {remediation.severedEdge.from} → {remediation.severedEdge.to}
                    </code>
                  </Meta>
                )}
                <Meta label="Detail">{remediation.detail}</Meta>
                <Meta label="Executed">{relativeTime(remediation.executedAt)} — no human approval</Meta>
              </CardContent>
            </Card>
          )}
          {sim && (
            <Card className={sim.blocked ? 'border-green-300' : 'border-red-300'}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {sim.blocked ? (
                    <CheckCircle2 className="size-4 text-green-600" />
                  ) : (
                    <AlertCircle className="size-4 text-red-600" />
                  )}
                  Replay Verification
                </CardTitle>
              </CardHeader>
              <CardContent className="text-sm">
                <p>{sim.detail}</p>
                <p className="text-muted-foreground mt-2 text-xs">
                  {sim.replayed
                    ? 'The original attack payload was re-sent through the gateway against the live agent.'
                    : 'Policy dry-run on the recorded chain (live agent not reachable for replay).'}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ── History ─────────────────────────────────────────────────────── */}
        <TabsContent value="history">
          <Card>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-4 text-sm">
                <HistoryItem ts={record.openedAt} label={`Finding opened (${record.priority}, owner ${record.owner})`} />
                {remediation && (
                  <HistoryItem
                    ts={remediation.executedAt}
                    label={`Autonomous ${remediation.action} executed`}
                  />
                )}
                {record.closedAt && (
                  <HistoryItem
                    ts={record.closedAt}
                    label={`Status → ${displayStatus(record)}${sim?.replayed ? ' (replay-verified)' : ''}`}
                  />
                )}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <MessageSquare className="size-3.5" />
        Comments and ticket round-trip sync run through Composio when a key is configured.
      </div>
    </div>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  )
}

function HistoryItem({ ts, label }: { ts: string; label: string }) {
  return (
    <li className="relative">
      <span className="bg-primary absolute -left-[21.5px] top-1.5 size-2 rounded-full" />
      <div className="font-medium">{label}</div>
      <div className="text-muted-foreground text-xs tabular-nums">
        {new Date(ts).toLocaleTimeString('en-GB', { hour12: false })}
      </div>
    </li>
  )
}
