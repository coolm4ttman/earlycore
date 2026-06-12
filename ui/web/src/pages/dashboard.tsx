import { AgentsCard } from '@/components/agents-table'
import {
  ComplianceCard,
  OpenIssuesCard,
  OpenedResolvedCard,
  SeverityChartCard,
} from '@/components/dashboard-cards'
import { SecurityIssuesCard } from '@/components/issues-table'

export default function DashboardPage() {
  return (
    <div className="space-y-4 p-4 lg:p-6">
      {/* Top row: posture stats + the two trend charts. */}
      <div className="grid gap-4 lg:grid-cols-3">
        <OpenIssuesCard />
        <SeverityChartCard />
        <OpenedResolvedCard />
      </div>
      {/* Compliance gauges get a full-width band. */}
      <ComplianceCard />
      {/* Tables get full width so columns never clip. */}
      <SecurityIssuesCard />
      <AgentsCard />
    </div>
  )
}
