// cited.md — citeable security evidence for hackathon verification.
//
// The markdown document is generated ENTIRELY from what the loop actually did
// (real findings, autonomous actions, replay proofs, clause mappings, computed
// scores) and always written to .earlycore/cited.md. When the Senso CLI is
// authenticated (senso whoami works — see the onboarding flow), the evidence
// is published as a citeable to the org's default destination (cited-md),
// which is how the submission gets verified.

import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { AuditorPack } from '../types.js'

const CITED_FILE = '.earlycore/cited.md'
const PROMPT_CACHE = '.earlycore/senso-evidence-prompt.json'
const EVIDENCE_QUESTION =
  'What verified security evidence does EarlyCore produce from a live autonomy-loop run?'

export function buildCitedMd(
  pack: AuditorPack,
  opts: { detailSeverities?: string[]; maxField?: number } = {},
): string {
  const detail = new Set(opts.detailSeverities ?? ['critical', 'high', 'medium', 'low'])
  const cap = opts.maxField ?? 100000
  const trim = (s: string) => (s.length > cap ? s.slice(0, cap) + '…' : s)
  const closed = pack.records.filter((r) => r.status === 'verified-closed' || r.status === 'closed')
  const replayProven = pack.simulations.filter((s) => s.replayed && s.blocked)

  const lines: string[] = [
    '# EarlyCore — Citeable Security Evidence',
    '',
    `Generated: ${pack.generatedAt}`,
    '',
    'Every statement below derives from observed events in a live run of the',
    'EarlyCore autonomy loop (SEE → STOP → TRACE → FIX → PROVE) against the',
    'demo target environment. Nothing is seeded or hardcoded.',
    '',
    '## Summary',
    '',
    `- Findings landed: ${pack.records.length}`,
    `- Autonomous remediations executed (no human approval): ${pack.remediations.length}`,
    `- Chains closed: ${closed.length} (${replayProven.length} proven closed by replaying the original attack)`,
    '',
    '## Findings & evidence',
    '',
  ]

  for (const record of pack.records) {
    const f = record.finding
    const remediation = pack.remediations.find((r) => r.findingId === f.id)
    const sim = pack.simulations.find((s) => s.findingId === f.id)
    const mapping = pack.mappings.find((m) => m.findingId === f.id)

    if (!detail.has(f.severity)) {
      // Compact entry for severities outside the detail set (publish digest).
      lines.push(
        `- **${f.id}** — ${f.category} (${f.severity}, ${record.priority}, ${f.phase}); ` +
          `action: ${remediation?.action ?? 'n/a'}; ${sim?.blocked ? 'chain closed' : 'tracked'}`,
      )
      continue
    }

    lines.push(
      `### ${f.id} — ${f.category} (${f.severity}, ${record.priority}, ${f.phase})`,
      '',
      trim(f.description),
      '',
      `- **Attack payload:** \`${trim(f.probe).replace(/`/g, "'")}\``,
      `- **Observed evidence:** ${trim(f.evidence)}`,
      `- **Nodes the attack really touched:** ${f.observedNodes.join(' → ')}`,
    )
    if (remediation) {
      lines.push(
        `- **Autonomous action:** ${remediation.action} (${remediation.mode}) at ${remediation.executedAt} — ${trim(remediation.detail)}`,
      )
    }
    if (sim) lines.push(`- **Replay verification:** ${trim(sim.detail)}`)
    if (mapping) {
      lines.push(
        `- **Control citation:** ${mapping.framework} ${mapping.clause} (${mapping.mode}) — "${trim(mapping.clauseText)}"`,
      )
    }
    lines.push('')
  }

  lines.push('## Compliance scores (transparent deductions)', '')
  for (const s of pack.scores) {
    lines.push(
      `- **${s.framework}: ${s.score}/100** — ${s.openFindings} open, ${s.closedFindings} mitigated; deductions: ${
        s.deductions.map((d) => `${d.findingId} −${d.points}${d.mitigated ? ' (mitigated)' : ''}`).join(', ') || 'none'
      }`,
    )
  }
  lines.push('', '---', '', '*Powered by Senso — your AI-searchable knowledge base.*', '')

  return lines.join('\n')
}

// ── Senso CLI plumbing ────────────────────────────────────────────────────────

// Resolve the senso binary: PATH install first, then the project-local
// dependency (the path used on Render, where there is no global install).
let sensoBin: string | null = null;
function resolveSensoBin(): string {
  if (!sensoBin) sensoBin = existsSync('node_modules/.bin/senso') ? 'node_modules/.bin/senso' : 'senso';
  return sensoBin;
}

function senso(args: string[], dataPayload?: unknown): { ok: boolean; json: any; err?: string } {
  const full = [...args, '--output', 'json', '--quiet']
  if (dataPayload !== undefined) full.splice(args.length, 0, '--data', JSON.stringify(dataPayload))
  const r = spawnSync(resolveSensoBin(), full, { encoding: 'utf8', timeout: 60_000 })
  if (r.error || r.status !== 0) {
    const err =
      r.error?.message ?? `exit ${r.status}: ${(r.stderr || r.stdout || '').slice(0, 200)}`
    return { ok: false, json: null, err }
  }
  // Strip ANSI color codes before locating the JSON payload.
  const clean = (r.stdout ?? '').replace(/\[[0-9;]*m/g, '')
  const m = /\{[\s\S]*\}/.exec(clean)
  try {
    return { ok: true, json: m ? JSON.parse(m[0]) : null }
  } catch {
    return { ok: false, json: null, err: `unparseable output: ${clean.slice(0, 120)}` }
  }
}

function sensoAvailable(): boolean {
  return senso(['whoami']).ok
}

/** Get (or create once) the GEO question that loop evidence publishes against. */
function evidencePromptId(): string | null {
  try {
    const cached = JSON.parse(readFileSync(PROMPT_CACHE, 'utf8'))
    if (cached?.prompt_id) return cached.prompt_id
  } catch {
    /* not cached yet */
  }
  const created = senso(['prompts', 'create'], {
    question_text: EVIDENCE_QUESTION,
    type: 'evaluation',
  })
  const id =
    created.json?.prompt_id ?? created.json?.id ?? created.json?.geo_question_id ?? null
  if (id) {
    try {
      writeFileSync(PROMPT_CACHE, JSON.stringify({ prompt_id: id }))
    } catch {
      /* best-effort cache */
    }
  }
  return id
}

export interface CitedResult {
  published: boolean
  file: string
  url?: string
  reason?: string
}

export async function publishCited(pack: AuditorPack): Promise<CitedResult> {
  const md = buildCitedMd(pack)
  try {
    mkdirSync('.earlycore', { recursive: true })
    writeFileSync(CITED_FILE, md)
  } catch {
    return { published: false, file: CITED_FILE, reason: 'could not write cited.md locally' }
  }

  if (!sensoAvailable()) {
    return {
      published: false,
      file: CITED_FILE,
      reason: 'cited.md generated locally; authenticate the senso CLI to publish to cited-md',
    }
  }

  const promptId = evidencePromptId()
  if (!promptId) {
    return { published: false, file: CITED_FILE, reason: 'could not resolve Senso evidence prompt' }
  }

  let publishMd = md
  if (Buffer.byteLength(publishMd, 'utf8') > 100_000) {
    publishMd =
      buildCitedMd(pack, { detailSeverities: ['critical', 'high'], maxField: 220 }) +
      '\n\n> Digest edition (full evidence exceeds the publish size limit). The complete' +
      '\n> document is generated on every run at `.earlycore/cited.md` in the repo, with' +
      '\n> the machine-readable auditor pack at `.earlycore/auditor-pack.json`.\n'
  }
  const published = senso(['engine', 'publish'], {
    geo_question_id: promptId,
    raw_markdown: publishMd,
    seo_title: `EarlyCore autonomy-loop security evidence — ${pack.generatedAt}`,
    summary: `Verified findings, autonomous remediations, and replay proofs from the EarlyCore run at ${pack.generatedAt}.`,
  })
  if (!published.ok) {
    return {
      published: false,
      file: CITED_FILE,
      reason: `senso engine publish failed (${published.err ?? 'unknown'})`,
    }
  }
  const url =
    published.json?.url ?? published.json?.published_url ?? published.json?.content_id ?? 'ok'
  return { published: true, file: CITED_FILE, url: String(url) }
}
