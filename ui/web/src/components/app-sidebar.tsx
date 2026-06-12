import { Link, useLocation } from 'react-router-dom'
import {
  AlertCircle,
  Bot,
  ChevronsUpDown,
  LayoutDashboard,
  Shield,
  Waypoints,
  Sparkles,
} from 'lucide-react'
import { LogoE, Wordmark } from '@/components/logo'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'

const NAV = [
  { title: 'Dashboard', url: '/', icon: LayoutDashboard },
  { title: 'Agents', url: '/agents', icon: Bot },
  { title: 'Issues', url: '/issues', icon: AlertCircle },
  { title: 'Alerts & Policies', url: '/alerts', icon: Shield },
  { title: 'Attack Graph', url: '/graph', icon: Waypoints },
  { title: 'Ask EarlyCore', url: '/ask', icon: Sparkles },
]

export function AppSidebar() {
  const location = useLocation()
  return (
    <Sidebar collapsible="icon" className="print:hidden">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg border bg-white">
                  <LogoE className="size-5" />
                </div>
                <div className="grid flex-1 text-left leading-tight">
                  <Wordmark className="truncate text-sm" />
                  <span className="text-muted-foreground truncate text-xs">Security Platform</span>
                </div>
                <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {NAV.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      item.url === '/'
                        ? location.pathname === '/'
                        : location.pathname.startsWith(item.url)
                    }
                  >
                    <Link to={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg">
              <div className="bg-muted flex aspect-square size-8 items-center justify-center rounded-lg">
                <span className="text-xs font-medium">PE</span>
              </div>
              <div className="grid flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium">paul@earlycore.dev</span>
                <span className="text-muted-foreground truncate text-xs">paul@earlycore.dev</span>
              </div>
              <ChevronsUpDown className="text-muted-foreground ml-auto size-4" />
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
