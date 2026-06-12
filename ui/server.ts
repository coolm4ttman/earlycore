// Load .env (secrets stay out of the repo).
try { process.loadEnvFile('.env') } catch { /* no .env yet */ }

// Serves the EarlyCore web app (ui/web/dist) and streams live EarlyCoreEvents
// over SSE. Two ways events arrive:
//   • in-process: POST /api/run executes the orchestrator inside this process,
//     so the shared bus feeds SSE directly (the demo path), or
//   • cross-process: a separately-run orchestrator (`npm run demo`) forwards
//     its events to POST /api/events.
//
// Dev mode: run `npm run web:dev` for the Vite dev server (proxies /api here).

import { readFile, stat } from 'node:fs/promises'
import { createServer, type ServerResponse } from 'node:http'
import { dirname, extname, join, normalize } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bus } from '../src/bus.js'
import { runOrchestrator } from '../src/orchestrator.js'
import { loadPolicy } from '../src/runtime/policy.js'
import { topology } from '../demo/topology.js'
import type { EarlyCoreEvent } from '../src/types.js'

// Rebuild the real session state from the event buffer for /api/ask. This is
// the same data the dashboard renders — nothing extra, nothing invented.
function snapshotFromBus() {
  const snapshot = {
    topology: { nodes: topology.nodes, edges: topology.edges },
    findings: [] as unknown[],
    remediations: [] as unknown[],
    replayVerifications: [] as unknown[],
    complianceScores: [] as unknown[],
    controlMappings: [] as unknown[],
    attackPaths: [] as unknown[],
    activeGatewayPolicy: loadPolicy(),
    activityEventCount: 0,
  }
  for (const ev of bus.replay()) {
    switch (ev.kind) {
      case 'finding':
      case 'lifecycle': {
        const i = snapshot.findings.findIndex((r: any) => r.finding.id === ev.record.finding.id)
        if (i >= 0) snapshot.findings[i] = ev.record
        else snapshot.findings.push(ev.record)
        break
      }
      case 'path':
        snapshot.attackPaths.push(ev.path)
        break
      case 'remediation':
        snapshot.remediations.push(ev.remediation)
        break
      case 'simulation':
        snapshot.replayVerifications.push(ev.result)
        break
      case 'compliance':
        snapshot.complianceScores = ev.scores
        break
      case 'evidence':
        snapshot.controlMappings.push(ev.mapping)
        break
      case 'activity':
        snapshot.activityEventCount += ev.events.length
        break
    }
  }
  return snapshot
}

const PORT = Number(process.env.PORT ?? 4000)
const UI_DIR = dirname(fileURLToPath(import.meta.url))
const DIST = join(UI_DIR, 'web', 'dist')

// ── SSE plumbing ──────────────────────────────────────────────────────────────

const clients = new Set<ServerResponse>()

function sseSend(res: ServerResponse, event: EarlyCoreEvent) {
  res.write(`data: ${JSON.stringify(event)}\n\n`)
}

bus.inProcessUi = true
bus.on('event', (event: EarlyCoreEvent) => {
  for (const res of clients) sseSend(res, event)
})

// Heartbeat keeps proxies from closing idle SSE connections.
setInterval(() => {
  for (const res of clients) res.write(': ping\n\n')
}, 15_000).unref()

let running = false
let lastScanAt: string | null = null

function startScan(): void {
  if (running) return
  running = true
  runOrchestrator()
    .catch((err) => {
      bus.publish({ kind: 'log', level: 'error', message: `scan failed: ${err?.message ?? err}` })
    })
    .finally(() => {
      running = false
      lastScanAt = new Date().toISOString()
    })
}

async function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  let data = ''
  for await (const chunk of req) data += chunk
  return data
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.json': 'application/json',
  '.ico': 'image/x-icon',
}

async function serveStatic(url: string, res: ServerResponse): Promise<boolean> {
  const clean = normalize(url.split('?')[0]).replace(/^(\.\.[/\\])+/, '')
  const file = join(DIST, clean === '/' ? 'index.html' : clean)
  if (!file.startsWith(DIST)) return false
  try {
    const s = await stat(file)
    if (!s.isFile()) return false
    const body = await readFile(file)
    res.writeHead(200, { 'content-type': MIME[extname(file)] ?? 'application/octet-stream' })
    res.end(body)
    return true
  } catch {
    return false
  }
}

const server = createServer(async (req, res) => {
  const url = req.url ?? '/'

  if (req.method === 'GET' && url === '/api/topology') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify(topology))
    return
  }

  if (req.method === 'GET' && url === '/api/stream') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
    })
    // Replay everything so a mid-run dashboard gets the full picture.
    for (const event of bus.replay()) sseSend(res, event)
    clients.add(res)
    req.on('close', () => clients.delete(res))
    return
  }

  // Cross-process ingestion from a standalone orchestrator run.
  if (req.method === 'POST' && url === '/api/events') {
    try {
      const event = JSON.parse((await readBody(req)) || '{}') as EarlyCoreEvent
      for (const client of clients) sseSend(client, event)
      bus.replayBufferOnly(event)
      res.writeHead(202).end()
    } catch {
      res.writeHead(400).end()
    }
    return
  }

  // Ask EarlyCore — generative-UI answers via Thesys C1. The model receives
  // ONLY the real session state (findings, actions, replay proofs, scores,
  // live policy) and is instructed to visualize exactly that.
  if (req.method === 'POST' && url === '/api/ask') {
    const apiKey = process.env.THESYS_API_KEY
    if (!apiKey) {
      res.writeHead(503, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'THESYS_API_KEY is not configured' }))
      return
    }
    try {
      const body = JSON.parse((await readBody(req)) || '{}')
      const prompt = String(body.prompt ?? '').slice(0, 2000)
      const { default: OpenAI } = await import('openai')
      const client = new OpenAI({ apiKey, baseURL: 'https://api.thesys.dev/v1/embed' })
      const completion = await client.chat.completions.create({
        model: process.env.THESYS_MODEL ?? 'c1/google/gemini-3.1-pro-free/v-20260331',
        messages: [
          {
            role: 'system',
            content:
              'You are EarlyCore, an agentic-security analyst. Answer questions about the ' +
              'security posture using ONLY the real session data in the JSON below — never invent ' +
              'findings, scores, or events. Prefer rich visual answers: charts for trends/scores, ' +
              'tables for findings, callouts for critical items, step lists for attack paths. ' +
              'When asked for a report, produce a complete executive security report with sections. ' +
              'If the data does not contain the answer, say so plainly.\n\nSESSION DATA:\n' +
              JSON.stringify(snapshotFromBus()),
          },
          { role: 'user', content: prompt },
        ],
      })
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ content: completion.choices[0]?.message?.content ?? '' }))
    } catch (err: any) {
      res.writeHead(502, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: `thesys request failed: ${err?.message ?? err}` }))
    }
    return
  }

  // Monitoring status: is a scan running, and when did the last one finish.
  if (req.method === 'GET' && url === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ scanning: running, lastScanAt }))
    return
  }

  // Trigger a red-team scan in-process. Continuous runtime monitoring is always
  // on (the gateway inspects every request); this kicks a fresh scan pass.
  if (req.method === 'POST' && url === '/api/run') {
    if (running) {
      res.writeHead(409, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ error: 'a scan is already in progress' }))
      return
    }
    startScan()
    res.writeHead(202, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ started: true }))
    return
  }

  // Static assets, then SPA fallback for client-side routes.
  if (req.method === 'GET' && !url.startsWith('/api/')) {
    if (await serveStatic(url, res)) return
    if (await serveStatic('/', res)) return
    res.writeHead(503, { 'content-type': 'text/plain' })
    res.end('UI not built yet — run: npm run web:build')
    return
  }

  res.writeHead(404, { 'content-type': 'application/json' })
  res.end(JSON.stringify({ error: 'not found' }))
})

server.listen(PORT, () => {
  console.log(`🛰  EarlyCore platform: http://localhost:${PORT}`)
  // Continuous monitoring: kick off an initial scan on boot so the platform is
  // never empty — it has already been watching by the time anyone opens it.
  // Disable with EARLYCORE_NO_AUTOSCAN=1.
  if (process.env.EARLYCORE_NO_AUTOSCAN !== '1') {
    setTimeout(startScan, 1500)
  }
})
