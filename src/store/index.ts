// ClickHouse persistence + Langfuse tracing. Both run for REAL when their
// services are reachable (docker compose up -d + keys); both degrade to a
// local fallback so the loop runs anywhere. The fallback is the only stub.

import type { Finding, Remediation, Severity } from '../types.js';

const SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

interface AgentEvent {
  ts: string;
  kind: 'finding' | 'remediation';
  findingId: string;
  category: string;
  severity: Severity;
  action?: string;
  detail: string;
}

// ── ClickHouse ────────────────────────────────────────────────────────────────

interface EventSink {
  insert(event: AgentEvent): Promise<void>;
  all(): Promise<AgentEvent[]>;
  mode: 'real' | 'memory';
}

class MemorySink implements EventSink {
  mode = 'memory' as const;
  private rows: AgentEvent[] = [];
  async insert(event: AgentEvent) {
    this.rows.push(event);
  }
  async all() {
    return this.rows;
  }
}

const TABLE_DDL = `
CREATE TABLE IF NOT EXISTS agent_events (
  ts        DateTime64(3),
  kind      LowCardinality(String),
  findingId String,
  category  LowCardinality(String),
  severity  LowCardinality(String),
  action    String,
  detail    String
) ENGINE = MergeTree ORDER BY ts`;

async function createClickHouseSink(): Promise<EventSink | null> {
  const url = process.env.CLICKHOUSE_URL;
  if (!url) return null;
  try {
    const { createClient } = await import('@clickhouse/client');
    const client = createClient({
      url,
      username: process.env.CLICKHOUSE_USER ?? 'default',
      password: process.env.CLICKHOUSE_PASSWORD ?? '',
      request_timeout: 3000,
    });
    if (!(await client.ping()).success) return null;
    await client.command({ query: TABLE_DDL });
    return {
      mode: 'real',
      async insert(event) {
        await client.insert({
          table: 'agent_events',
          values: [{ ...event, action: event.action ?? '', ts: event.ts.replace('T', ' ').replace('Z', '') }],
          format: 'JSONEachRow',
        });
      },
      async all() {
        const rs = await client.query({
          query: 'SELECT * FROM agent_events ORDER BY ts',
          format: 'JSONEachRow',
        });
        return (await rs.json()) as AgentEvent[];
      },
    };
  } catch {
    return null; // service not up — fall back to memory
  }
}

// ── Langfuse ──────────────────────────────────────────────────────────────────

interface Tracer {
  span(name: string, data: Record<string, unknown>): void;
  flush(): Promise<void>;
  mode: 'real' | 'console';
}

async function createTracer(): Promise<Tracer> {
  const publicKey = process.env.LANGFUSE_PUBLIC_KEY;
  const secretKey = process.env.LANGFUSE_SECRET_KEY;
  if (publicKey && secretKey) {
    try {
      const { Langfuse } = await import('langfuse');
      const langfuse = new Langfuse({
        publicKey,
        secretKey,
        baseUrl: process.env.LANGFUSE_HOST ?? 'http://localhost:3000',
      });
      const trace = langfuse.trace({ name: 'earlycore.loop' });
      return {
        mode: 'real',
        span(name, data) {
          trace.span({ name, metadata: data });
        },
        async flush() {
          await langfuse.flushAsync();
        },
      };
    } catch {
      // fall through to console tracer
    }
  }
  return {
    mode: 'console',
    span(name, data) {
      console.log(`[trace] ${name}`, JSON.stringify(data));
    },
    async flush() {},
  };
}

// ── Store facade used by the orchestrator ─────────────────────────────────────

export class Store {
  private sink: EventSink = new MemorySink();
  private tracer: Tracer | null = null;

  /** Connect to real services where reachable. Safe to call once at startup. */
  async init(): Promise<{ clickhouse: string; langfuse: string }> {
    const ch = await createClickHouseSink();
    if (ch) this.sink = ch;
    this.tracer = await createTracer();
    return { clickhouse: this.sink.mode, langfuse: this.tracer.mode };
  }

  trace(name: string, data: Record<string, unknown>) {
    this.tracer?.span(name, data);
  }

  async flush() {
    await this.tracer?.flush();
  }

  async recordFinding(f: Finding) {
    await this.sink.insert({
      ts: new Date().toISOString(),
      kind: 'finding',
      findingId: f.id,
      category: f.category,
      severity: f.severity,
      detail: f.description,
    });
  }

  async recordRemediation(r: Remediation, severity: Severity, category: string) {
    await this.sink.insert({
      ts: r.executedAt,
      kind: 'remediation',
      findingId: r.findingId,
      category,
      severity,
      action: r.action,
      detail: r.detail,
    });
  }

  // Powers the dashboard severity panel.
  async summary(): Promise<{ bySeverity: Record<Severity, number>; actions: number }> {
    const rows = await this.sink.all();
    const bySeverity = SEVERITIES.reduce(
      (acc, s) => ((acc[s] = 0), acc),
      {} as Record<Severity, number>,
    );
    let actions = 0;
    for (const r of rows) {
      if (r.kind === 'finding') bySeverity[r.severity]++;
      if (r.kind === 'remediation') actions++;
    }
    return { bySeverity, actions };
  }
}
