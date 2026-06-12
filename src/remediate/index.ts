// FIX — autonomous remediation. NO human approval step. A landed finding
// deterministically maps to an action that fires immediately:
//
//   pii-leak / data-exfiltration / critical → block_call   (sever the sink edge)
//   excessive-agency / bfla / bola          → revoke_tool  (revoke the tool)
//   high                                    → jira_ticket
//   else                                    → slack_alert
//
// block_call / revoke_tool are REAL enforcement: they write rules to the
// runtime policy that the gateway consults on every exchange, so the severed
// path is severed in fact — simulate/ proves it by replaying the attack.
// Ticketing/alerting fire through Composio when a key is present.
//
// ⚠ Security-correctness call (flagged for review): the severity/category →
// action policy above is a product decision about how aggressive autonomous
// blocking should be. It currently blocks at the gateway for PII/critical
// without human signoff — that is the intended "no human in the loop" demo
// behavior, but a real deployment would make this policy configurable.

import type { AttackGraph } from '../graph/index.js';
import type { AttackPath, Edge, Finding, Remediation, RemediationAction } from '../types.js';
import { blockEdge, revokeTool } from '../runtime/policy.js';

export function decideAction(finding: Finding): RemediationAction {
  if (
    finding.category === 'pii-leak' ||
    finding.category === 'data-exfiltration' ||
    finding.severity === 'critical'
  ) {
    return 'block_call';
  }
  if (
    finding.category === 'excessive-agency' ||
    finding.category === 'bfla' ||
    finding.category === 'bola'
  ) {
    return 'revoke_tool';
  }
  if (finding.severity === 'high') return 'jira_ticket';
  return 'slack_alert';
}

// ── Composio ──────────────────────────────────────────────────────────────────

interface ComposioResult {
  ok: boolean;
  mode: 'real' | 'stub';
  detail: string;
}

// Toolkit version cache: Composio requires a concrete toolkit version per
// execute; we resolve it once per toolkit from the live registry.
const toolkitVersions = new Map<string, string>();

async function resolveVersion(composio: any, action: string): Promise<string | undefined> {
  const toolkit = action.split('_')[0].toLowerCase(); // SLACK_SEND_MESSAGE → slack
  if (toolkitVersions.has(toolkit)) return toolkitVersions.get(toolkit);
  try {
    const tools = await composio.tools.getRawComposioTools({ toolkits: [toolkit], limit: 1 });
    const items = tools?.items ?? tools;
    const version = Array.isArray(items) ? items[0]?.version : undefined;
    if (version) toolkitVersions.set(toolkit, version);
    return version;
  } catch {
    return undefined;
  }
}

export async function composioExecute(
  action: string,
  params: Record<string, unknown>,
): Promise<ComposioResult> {
  const key = process.env.COMPOSIO_API_KEY;
  if (!key) {
    // TODO(sponsor): swap to real SDK — set COMPOSIO_API_KEY to fire this for real.
    return { ok: true, mode: 'stub', detail: `${action} (stub: COMPOSIO_API_KEY unset)` };
  }
  try {
    const { Composio } = await import('@composio/core');
    const composio = new Composio({ apiKey: key });
    const userId = process.env.COMPOSIO_USER_ID ?? 'default';
    const version = await resolveVersion(composio, action);
    const result = await composio.tools.execute(action, {
      userId,
      arguments: params,
      ...(version ? { version } : {}),
    });
    return { ok: true, mode: 'real', detail: `${action} executed via Composio (${JSON.stringify(result).slice(0, 120)})` };
  } catch (err: any) {
    const msg = String(err?.message ?? err);
    const hint = /executing the tool/i.test(msg)
      ? ' (likely no connected account — connect the app in the Composio dashboard)'
      : '';
    return { ok: false, mode: 'stub', detail: `${action} failed via Composio: ${msg.slice(0, 140)}${hint}` };
  }
}

const now = () => new Date().toISOString();

/**
 * Execute the autonomous remediation for a finding. Returns the Remediation,
 * including the graph edge that was severed (so the UI can break the path and
 * the gateway can enforce it).
 */
export async function remediate(
  finding: Finding,
  path: AttackPath | null,
  graph: AttackGraph,
): Promise<Remediation> {
  const action = decideAction(finding);
  const severedEdge: Edge | undefined =
    path && (action === 'block_call' || action === 'revoke_tool')
      ? graph.severingEdge(path) ?? undefined
      : undefined;

  let detail: string;
  let mode: 'real' | 'stub';

  switch (action) {
    case 'block_call': {
      // Real enforcement: the gateway now withholds any exchange crossing this edge.
      if (severedEdge) {
        blockEdge(severedEdge);
        detail = `Blocked ${severedEdge.from} → ${severedEdge.to} at the gateway; exfil path for ${finding.id} severed.`;
      } else {
        revokeTool(finding.sink);
        detail = `No path edge resolved; revoked sink ${finding.sink} at the gateway for ${finding.id}.`;
      }
      mode = 'real';
      const note = await composioExecute('SLACK_SEND_MESSAGE', {
        channel: process.env.COMPOSIO_SLACK_CHANNEL ?? '#security',
        text: `EarlyCore autonomous action: ${detail}`,
      });
      detail += ` Alert: ${note.detail}.`;
      break;
    }
    case 'revoke_tool': {
      const tool = severedEdge?.to ?? finding.sink;
      revokeTool(tool);
      detail = `Revoked ${tool} at the gateway; excessive-agency path for ${finding.id} cut.`;
      mode = 'real';
      const note = await composioExecute('SLACK_SEND_MESSAGE', {
        channel: process.env.COMPOSIO_SLACK_CHANNEL ?? '#security',
        text: `EarlyCore autonomous action: ${detail}`,
      });
      detail += ` Alert: ${note.detail}.`;
      break;
    }
    case 'jira_ticket': {
      const res = await composioExecute('JIRA_CREATE_ISSUE', {
        summary: `[EarlyCore] ${finding.severity} ${finding.category}: ${finding.id}`,
        description: `${finding.description}\n\nProbe: ${finding.probe}\nEvidence: ${finding.evidence}`,
      });
      detail = `Opened Jira ticket for ${finding.category} finding ${finding.id}. ${res.detail}.`;
      mode = res.mode;
      break;
    }
    case 'slack_alert': {
      const res = await composioExecute('SLACK_SEND_MESSAGE', {
        channel: process.env.COMPOSIO_SLACK_CHANNEL ?? '#security',
        text: `EarlyCore: ${finding.severity} ${finding.category} finding ${finding.id} — ${finding.description}`,
      });
      detail = `Posted Slack alert for ${finding.category} finding ${finding.id}. ${res.detail}.`;
      mode = res.mode;
      break;
    }
  }

  return { findingId: finding.id, action, severedEdge, detail, executedAt: now(), mode };
}
