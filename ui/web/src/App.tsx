import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppSidebar } from '@/components/app-sidebar'
import { SiteHeader } from '@/components/site-header'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { StoreProvider } from '@/lib/store'
import AgentsPage from '@/pages/agents'
import AlertsPage from '@/pages/alerts'
import DashboardPage from '@/pages/dashboard'
import GraphPage from '@/pages/graph'
import IssueDetailPage from '@/pages/issue-detail'
import IssuesPage from '@/pages/issues'
import AskPage from '@/pages/ask'

export default function App() {
  return (
    <StoreProvider>
      <BrowserRouter>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <SiteHeader />
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/agents" element={<AgentsPage />} />
              <Route path="/issues" element={<IssuesPage />} />
              <Route path="/issues/:id" element={<IssueDetailPage />} />
              <Route path="/alerts" element={<AlertsPage />} />
              <Route path="/graph" element={<GraphPage />} />
              <Route path="/ask" element={<AskPage />} />
            </Routes>
          </SidebarInset>
        </SidebarProvider>
      </BrowserRouter>
    </StoreProvider>
  )
}
