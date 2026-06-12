import { useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'
import { relativeTime, runLoop, useEarlyCore } from '@/lib/store'

const STAGE_LABEL: Record<string, string> = {
  see: 'Ingesting agent telemetry',
  stop: 'Red-teaming + intercepting',
  trace: 'Tracing attack paths',
  fix: 'Remediating autonomously',
  prove: 'Generating evidence',
}

export function SiteHeader() {
  const { scanning, stage, lastScanAt, records } = useEarlyCore()
  // Re-render once a second so "last scan Xs ago" stays live.
  const [, tick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 print:hidden">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />

      {/* Live monitoring status — EarlyCore is always on. */}
      <div className="flex items-center gap-2 text-sm">
        {scanning ? (
          <>
            <span className="relative flex size-2.5">
              <span className="bg-amber-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" />
              <span className="bg-amber-500 relative inline-flex size-2.5 rounded-full" />
            </span>
            <span className="text-foreground font-medium">Scanning</span>
            <span className="text-muted-foreground hidden md:inline">
              · {stage ? (STAGE_LABEL[stage] ?? stage) : 'working'}…
            </span>
          </>
        ) : (
          <>
            <span className="relative flex size-2.5">
              <span className="bg-green-400 absolute inline-flex h-full w-full animate-ping rounded-full opacity-60" />
              <span className="bg-green-500 relative inline-flex size-2.5 rounded-full" />
            </span>
            <span className="text-foreground font-medium">Monitoring active</span>
            <span className="text-muted-foreground hidden md:inline">
              · {lastScanAt ? `last scan ${relativeTime(lastScanAt)}` : 'standing by'}
            </span>
          </>
        )}
      </div>

      <div className="ml-auto flex items-center gap-3">
        <span className="text-muted-foreground hidden text-sm sm:inline">
          <span className="text-foreground font-medium">{records.size}</span> findings ·{' '}
          <span className="text-foreground font-medium">2</span> agents
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => runLoop()}
          disabled={scanning}
          title="Run a fresh red-team scan now"
        >
          {scanning ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <RefreshCw className="size-4" />
          )}
          {scanning ? 'Scanning…' : 'Scan now'}
        </Button>
      </div>
    </header>
  )
}
