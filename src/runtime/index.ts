// STOP (runtime) — the interception gateway. Sits in front of the target agent
// as a reverse proxy: client → gateway → agent. Every exchange is inspected
// BEFORE the agent's response is released to the caller, so a violation is
// flagged — and, once policy rules exist, blocked — before data leaves the
// boundary. This is real interception of real traffic, not a simulation:
// the agent genuinely executes, and the gateway genuinely withholds the leak.

import { createServer, type Server } from 'node:http';
import type { Finding, FindingCategory, Severity } from '../types.js';
import { policyVerdict } from './policy.js';

export interface ChatRequest {
  message: string;
  ingested: string;
}

export interface ChatResponse {
  output: string;
  toolCalls: { tool: string; node: string }[];
  leaked?: boolean;
}

export interface GatewayExchange {
  request: ChatRequest;
  response: ChatResponse;
  // What the caller actually received (differs from `response` when blocked).
  delivered: { blocked: boolean; rule?: string; output: string };
  violation: Finding | null;
}

// ── Inspection (deterministic, on the real traffic) ──────────────────────────

const INJECTION_RE =
  /(ignore (all |prior |previous )?instructions|maintenance mode|policy update|you are now|system override)/i;
// PII the boundary must not let out: email addresses and card-number fragments.
const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
const CARD_RE = /\b(?:card[^.]{0,40})?(\d{4})\b/i;

let violationSeq = 0;

/**
 * Inspect one real request/response exchange and decide whether it violates
 * the security boundary. Pure inspection of observed traffic — the returned
 * Finding's observedNodes are exactly the nodes the agent's tool calls touched.
 */
export function inspectExchange(req: ChatRequest, res: ChatResponse): Finding | null {
  const touched = res.toolCalls.map((c) => c.node);
  const injected = INJECTION_RE.test(req.ingested) || INJECTION_RE.test(req.message);
  const piiOut = EMAIL_RE.test(res.output) || /card (\*+|ending |on file ending )?\d{4}/i.test(res.output);

  let category: FindingCategory | null = null;
  let severity: Severity = 'high';
  let sink = 'customer_db';
  let description = '';

  if (piiOut && touched.includes('customer_db')) {
    category = 'pii-leak';
    severity = 'critical';
    sink = 'customer_db';
    description =
      'Live exchange: customer PII read from customer_db was about to leave the boundary in the agent reply.';
  } else if (injected && touched.includes('payments_tool')) {
    category = 'excessive-agency';
    severity = 'high';
    sink = 'payments_tool';
    description =
      'Live exchange: injected instruction drove an unauthorized payments_tool invocation.';
  } else if (injected && touched.includes('crm_tool')) {
    category = 'indirect-injection';
    severity = 'high';
    sink = 'customer_db';
    description =
      'Live exchange: untrusted ingested content carried instructions the agent obeyed, pivoting to the CRM tool.';
  }

  if (!category) return null;

  return {
    id: `rt-runtime-${category}-${String(++violationSeq).padStart(3, '0')}`,
    category,
    severity,
    phase: 'runtime',
    source: req.ingested && INJECTION_RE.test(req.ingested) ? 'web_ingest' : 'support_agent',
    sink,
    observedNodes: ['support_agent', ...touched],
    description,
    probe: `${req.message} | ingested: ${req.ingested}`.slice(0, 300),
    evidence: `output: ${res.output.slice(0, 160)} | tools: ${res.toolCalls.map((c) => c.tool).join(', ')}`,
    replay: { message: req.message, ingested: req.ingested },
    landed: true,
  };
}

/**
 * Run one exchange through the gateway logic: call the real agent, inspect the
 * real response, enforce policy before anything is released.
 */
export async function gatewayExchange(
  targetUrl: string,
  request: ChatRequest,
): Promise<GatewayExchange> {
  const res = await fetch(`${targetUrl}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(request),
  });
  if (!res.ok) throw new Error(`target agent responded ${res.status}`);
  const response = (await res.json()) as ChatResponse;

  const violation = inspectExchange(request, response);
  const verdict = policyVerdict(response.toolCalls.map((c) => c.node));

  const delivered = verdict.blocked
    ? {
        blocked: true,
        rule: verdict.rule,
        output:
          'This request was blocked by EarlyCore policy before any data left the boundary.',
      }
    : { blocked: false, output: response.output };

  return { request, response, delivered, violation };
}

// ── Reverse-proxy server (for running the gateway standalone) ─────────────────

export interface GatewayOptions {
  port?: number;
  targetUrl?: string;
  onExchange?: (exchange: GatewayExchange) => void;
}

export function startGateway(opts: GatewayOptions = {}): Promise<{ server: Server; url: string }> {
  const port = opts.port ?? Number(process.env.PORT_GATEWAY ?? 4200);
  const targetUrl = opts.targetUrl ?? process.env.AGENT_URL ?? 'http://localhost:4100';

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true, gateway: true, target: targetUrl }));
      return;
    }
    if (req.method === 'POST' && req.url === '/chat') {
      try {
        let data = '';
        for await (const chunk of req) data += chunk;
        const body = JSON.parse(data || '{}');
        const exchange = await gatewayExchange(targetUrl, {
          message: String(body.message ?? ''),
          ingested: String(body.ingested ?? ''),
        });
        opts.onExchange?.(exchange);
        res.writeHead(exchange.delivered.blocked ? 451 : 200, {
          'content-type': 'application/json',
        });
        res.end(
          JSON.stringify(
            exchange.delivered.blocked
              ? { blocked: true, rule: exchange.delivered.rule, output: exchange.delivered.output }
              : exchange.response,
          ),
        );
      } catch (err: any) {
        res.writeHead(502, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ error: err?.message ?? 'gateway error' }));
      }
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  });

  return new Promise((resolve) => {
    server.listen(port, () => resolve({ server, url: `http://localhost:${port}` }));
  });
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  startGateway().then(({ url }) => {
    console.log(`🛡  EarlyCore gateway on ${url} → ${process.env.AGENT_URL ?? 'http://localhost:4100'}`);
  });
}
