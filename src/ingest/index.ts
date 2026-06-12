// SEE — agentless ingestion. EarlyCore requires NO code changes to the target:
// it reads the telemetry the target already emits (access logs, traces) and
// normalizes everything into a common AgentActivityEvent shape.
//
// Implemented for real:
//   • api-gateway — parses a generic JSONL gateway/access log (the demo agent's
//     standard access log at .earlycore/agent-gateway.log).
//   • langchain   — parses an exported LangChain run-trace JSON file.
// Marked stubs (wired the moment credentials/log paths exist):
//   • logfire, bedrock.

import { readFile } from 'node:fs/promises';
import type { AgentActivityEvent } from '../types.js';

// Map raw telemetry identifiers (tool names, span names) onto topology nodes.
// This is the only piece of demo-specific glue: real deployments configure it.
const NODE_RESOLVERS: [RegExp, string][] = [
  [/crm[_.]?tool/i, 'crm_tool'],
  [/customer[_.]?db/i, 'customer_db'],
  [/payments?[_.]?tool/i, 'payments_tool'],
  [/billing[_.]?agent/i, 'billing_agent'],
  [/web[_.]?ingest|retriev|scrape/i, 'web_ingest'],
  [/support[_.]?agent|agent/i, 'support_agent'],
];

export function resolveNode(raw: string): string | null {
  for (const [re, node] of NODE_RESOLVERS) if (re.test(raw)) return node;
  return null;
}

// ── api-gateway adapter (REAL) ────────────────────────────────────────────────
// Generic JSONL access-log format: one JSON object per line with at least
// { ts, method, path, request, response }. The demo agent emits exactly this as
// its ordinary access log; any API gateway (Kong, ALB, nginx-json) can be
// mapped the same way.

interface GatewayLine {
  ts?: string;
  method?: string;
  path?: string;
  request?: { message?: string; ingested?: string };
  response?: { output?: string; toolCalls?: { tool?: string; node?: string }[] };
}

export async function ingestApiGatewayLog(
  file = process.env.EARLYCORE_GATEWAY_LOG ?? '.earlycore/agent-gateway.log',
): Promise<AgentActivityEvent[]> {
  let raw: string;
  try {
    raw = await readFile(file, 'utf8');
  } catch {
    return []; // no log yet — the target hasn't served traffic
  }

  const events: AgentActivityEvent[] = [];
  for (const line of raw.split('\n')) {
    if (!line.trim()) continue;
    let entry: GatewayLine;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // skip malformed lines, as a log shipper would
    }
    const ts = entry.ts ?? new Date(0).toISOString();

    events.push({
      ts,
      adapter: 'api-gateway',
      node: 'support_agent',
      kind: 'request',
      detail: `${entry.method ?? 'POST'} ${entry.path ?? '/chat'}: ${String(entry.request?.message ?? '').slice(0, 120)}`,
    });

    if (entry.request?.ingested) {
      events.push({
        ts,
        adapter: 'api-gateway',
        node: 'web_ingest',
        kind: 'ingestion',
        detail: `Untrusted content ingested: ${String(entry.request.ingested).slice(0, 120)}`,
      });
    }

    for (const call of entry.response?.toolCalls ?? []) {
      const node = call.node ?? resolveNode(call.tool ?? '');
      if (!node) continue;
      events.push({
        ts,
        adapter: 'api-gateway',
        node,
        kind: 'tool_call',
        detail: `${call.tool ?? node} invoked`,
      });
    }
  }
  return events;
}

// ── langchain adapter (REAL parser; reads an exported run-trace file) ────────
// Parses the standard LangChain run shape: nested runs with run_type
// ('chain' | 'tool' | 'llm' | 'retriever'), name, start_time.

interface LangChainRun {
  name?: string;
  run_type?: string;
  start_time?: string;
  child_runs?: LangChainRun[];
}

export async function ingestLangChainTrace(
  file = process.env.EARLYCORE_LANGCHAIN_TRACE ?? '.earlycore/langchain-trace.json',
): Promise<AgentActivityEvent[]> {
  let runs: LangChainRun[];
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    runs = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return []; // no trace export present
  }

  const events: AgentActivityEvent[] = [];
  const walk = (run: LangChainRun) => {
    const node = resolveNode(run.name ?? '') ?? 'support_agent';
    const kind: AgentActivityEvent['kind'] =
      run.run_type === 'tool' ? 'tool_call'
      : run.run_type === 'llm' ? 'llm_call'
      : run.run_type === 'retriever' ? 'ingestion'
      : 'request';
    events.push({
      ts: run.start_time ?? new Date(0).toISOString(),
      adapter: 'langchain',
      node,
      kind,
      detail: `${run.run_type ?? 'chain'} run: ${run.name ?? 'unnamed'}`,
    });
    for (const child of run.child_runs ?? []) walk(child);
  };
  for (const run of runs) walk(run);
  return events;
}

// ── logfire adapter (stub) ────────────────────────────────────────────────────
export async function ingestLogfire(): Promise<AgentActivityEvent[]> {
  // TODO(sponsor): swap to real SDK — query Pydantic Logfire's read API for
  // spans tagged with the target agent and map span names via resolveNode().
  return [];
}

// ── bedrock adapter (stub) ────────────────────────────────────────────────────
export async function ingestBedrock(): Promise<AgentActivityEvent[]> {
  // TODO(sponsor): swap to real SDK — read Amazon Bedrock model-invocation logs
  // from CloudWatch/S3 and map invocations via resolveNode().
  return [];
}

/** Run every adapter and merge into one time-ordered activity stream. */
export async function ingestAll(): Promise<AgentActivityEvent[]> {
  const batches = await Promise.all([
    ingestApiGatewayLog(),
    ingestLangChainTrace(),
    ingestLogfire(),
    ingestBedrock(),
  ]);
  return batches.flat().sort((a, b) => a.ts.localeCompare(b.ts));
}
