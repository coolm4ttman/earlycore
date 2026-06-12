// Ask EarlyCore — a ChatGPT-style start screen. Empty state is centered; once
// you ask, the conversation scrolls and the prompt input pins to the bottom.
// Answers are Thesys C1 generative UI over the REAL session state only.

import { useEffect, useRef, useState } from 'react'
import { C1Component, ThemeProvider } from '@thesysai/genui-sdk'
import '@crayonai/react-ui/styles/index.css'
import { ArrowUp, Loader2, Printer, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  PromptInput,
  PromptInputAction,
  PromptInputActions,
  PromptInputTextarea,
} from '@/components/ui/prompt-input'
import { LogoE } from '@/components/logo'
import { useEarlyCore } from '@/lib/store'

const SUGGESTIONS = [
  'Generate an executive security report for my manager',
  'What is our riskiest agent right now, and why?',
  'How was the customer PII leak intercepted and closed?',
  'Where are our biggest compliance gaps?',
  'Summarize every autonomous action taken this session',
]

interface Turn {
  question: string
  response: string
  error?: string
}

export default function AskPage() {
  const { records } = useEarlyCore()
  const [prompt, setPrompt] = useState('')
  const [turns, setTurns] = useState<Turn[]>([])
  const [loading, setLoading] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [turns, loading])

  const ask = async (q: string) => {
    const question = q.trim()
    if (!question || loading) return
    setPrompt('')
    setLoading(true)
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ prompt: question }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
      setTurns((t) => [...t, { question, response: data.content }])
    } catch (err) {
      setTurns((t) => [...t, { question, response: '', error: err instanceof Error ? err.message : String(err) }])
    } finally {
      setLoading(false)
    }
  }

  const started = turns.length > 0 || loading

  const inputBar = (
    <PromptInput
      value={prompt}
      onValueChange={setPrompt}
      onSubmit={() => ask(prompt)}
      isLoading={loading}
      className="border-input bg-background w-full rounded-2xl border shadow-sm"
    >
      <PromptInputTextarea placeholder="Ask anything about your agentic security posture…" />
      <PromptInputActions className="justify-end pt-2">
        <PromptInputAction tooltip="Ask">
          <Button
            size="icon"
            className="size-8 rounded-full"
            onClick={() => ask(prompt)}
            disabled={loading || !prompt.trim()}
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <ArrowUp className="size-4" />}
          </Button>
        </PromptInputAction>
      </PromptInputActions>
    </PromptInput>
  )

  const suggestions = (
    <div className="flex flex-wrap justify-center gap-2">
      {SUGGESTIONS.map((s) => (
        <button
          key={s}
          onClick={() => ask(s)}
          disabled={loading}
          className="border-input hover:bg-accent rounded-full border px-3 py-1.5 text-xs transition-colors disabled:opacity-50"
        >
          {s}
        </button>
      ))}
    </div>
  )

  // ── Empty state: centered start screen ──────────────────────────────────────
  if (!started) {
    return (
      <div className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-2xl flex-col items-center justify-center gap-6 px-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <LogoE className="size-10" />
          <h1 className="text-2xl font-semibold">Ask EarlyCore</h1>
          <p className="text-muted-foreground max-w-md text-sm">
            Answers are generated live from this session's real findings, autonomous actions, and
            compliance posture{records.size === 0 && ' — the first scan is running now'}.
          </p>
        </div>
        <div className="w-full">{inputBar}</div>
        {suggestions}
      </div>
    )
  }

  // ── Conversation state: scrollable thread + pinned input ────────────────────
  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] w-full max-w-3xl flex-col px-4">
      <div ref={scrollRef} className="flex-1 space-y-6 overflow-y-auto py-6">
        {turns.map((t, i) => (
          <div key={i} className="space-y-3">
            <div className="flex justify-end">
              <div className="bg-muted max-w-[80%] rounded-2xl rounded-br-sm px-4 py-2 text-sm">
                {t.question}
              </div>
            </div>
            {t.error ? (
              <div className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700">
                {t.error}
              </div>
            ) : (
              <div className="flex gap-2">
                <span className="bg-primary/10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full">
                  <Sparkles className="size-3.5 text-[#e8442e]" />
                </span>
                <div className="min-w-0 flex-1">
                  <ThemeProvider>
                    <C1Component c1Response={t.response} isStreaming={false} />
                  </ThemeProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground mt-1 h-7 print:hidden"
                    onClick={() => window.print()}
                  >
                    <Printer className="size-3.5" /> Save as PDF
                  </Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2 className="size-4 animate-spin" /> Analyzing the session data…
          </div>
        )}
      </div>
      <div className="border-t bg-background pb-4 pt-3 print:hidden">{inputBar}</div>
    </div>
  )
}
