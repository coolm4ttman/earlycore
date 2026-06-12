import { useState } from 'react'
import { Loader2, Mail, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { runLoop, useEarlyCore } from '@/lib/store'

export function SiteHeader() {
  const { stage, records } = useEarlyCore()
  const [starting, setStarting] = useState(false)
  const running = stage !== null

  const onRun = async () => {
    setStarting(true)
    try {
      await runLoop()
    } finally {
      setTimeout(() => setStarting(false), 2000)
    }
  }

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 print:hidden">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
      {running && (
        <span className="text-muted-foreground flex items-center gap-2 text-xs">
          <Loader2 className="size-3 animate-spin" />
          autonomy loop: {stage?.toUpperCase()}
        </span>
      )}
      <div className="ml-auto flex items-center gap-3">
        <span className="text-muted-foreground hidden text-sm sm:inline">
          Findings this session: <span className="text-foreground font-medium">{records.size}</span>
        </span>
        <Button variant="ghost" size="sm" className="text-sm" asChild>
          <a href="mailto:feedback@earlycore.dev">
            <Mail className="size-4" /> Send Feedback
          </a>
        </Button>
        <Button size="sm" onClick={onRun} disabled={running || starting}>
          {running || starting ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
          Run autonomy loop
        </Button>
      </div>
    </header>
  )
}
