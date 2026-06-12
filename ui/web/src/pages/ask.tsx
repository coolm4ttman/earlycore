// Ask EarlyCore — generative-UI answers over the REAL session state, powered
// by Thesys C1. The backend hands C1 only what the loop actually observed;
// C1 renders it as charts/tables/report sections. "Generate executive report"
// + Print covers the send-to-your-manager flow.

import { useState } from 'react'
import { C1Component, ThemeProvider } from '@thesysai/genui-sdk'
import '@crayonai/react-ui/styles/index.css'
import { Loader2, Printer, Send, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useEarlyCore } from '@/lib/store'

const SUGGESTIONS = [
  'Generate an executive security report for my manager',
  'What is our riskiest agent right now, and why?',
  'How was the customer PII leak intercepted and closed?',
  'Where are our biggest compliance gaps?',
  'Summarize every autonomous action taken this session',
]

export default function AskPage() {
  const { records } = useEarlyCore()
  const [prompt, setPrompt] = useState('')
  const [asked, setAsked] = useState('')
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ask = async (q: string) => {
    if (!q.trim() || loading) return
    setLoading(true)
    setError('')
    setAsked(q)
    setResponse('')
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: q }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setResponse(data.content)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 p-4 lg:p-6">
      <div className="print:hidden">
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="size-5 text-[#e8442e]" /> Ask EarlyCore
        </h1>
        <p className="text-muted-foreground text-sm">
          Ask anything about this session's agentic security — answers are generated from the real
          findings, actions, and scores only{records.size === 0 && ' (run the autonomy loop first)'}
        </p>
      </div>

      <form
        className="flex gap-2 print:hidden"
        onSubmit={(e) => {
          e.preventDefault()
          ask(prompt)
        }}
      >
        <Input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g. Generate an executive security report…"
          disabled={loading}
        />
        <Button type="submit" disabled={loading || !prompt.trim()}>
          {loading ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
        </Button>
      </form>

      <div className="flex flex-wrap gap-2 print:hidden">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            disabled={loading}
            className="border-input hover:bg-accent rounded-full border px-3 py-1 text-xs transition-colors disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      {error && (
        <Card className="border-red-300">
          <CardContent className="text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {loading && (
        <Card>
          <CardContent className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Loader2 className="size-4 animate-spin" /> Analyzing the session data…
          </CardContent>
        </Card>
      )}

      {response && !loading && (
        <>
          <div className="flex items-center justify-between print:hidden">
            <span className="text-muted-foreground text-xs">“{asked}”</span>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="size-4" /> Print / Save PDF
            </Button>
          </div>
          <ThemeProvider>
            <C1Component c1Response={response} isStreaming={false} />
          </ThemeProvider>
        </>
      )}
    </div>
  )
}
