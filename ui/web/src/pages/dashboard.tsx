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
    <div className="grid gap-4 p-4 lg:grid-cols-2 lg:p-6">
      <OpenIssuesCard />
      <SeverityChartCard />
      <SecurityIssuesCard />
      <OpenedResolvedCard />
      <AgentsCard />
      <ComplianceCard />
    </div>
  )
}
