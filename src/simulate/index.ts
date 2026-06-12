// FIX (verification) — replay the original attack chain after remediation and
// confirm it is now actually blocked. Two honest modes:
//
//   replay   — the agent is reachable: re-send the finding's EXACT original
//              payload through the gateway and observe whether the gateway
//              withholds it this time. End-to-end proof.
//   dry-run  — the agent is not running: evaluate the recorded observed node
//              chain against the live policy. Clearly labeled as a policy
//              dry-run, never presented as a replay.

import type { Finding, SimulationResult } from '../types.js';
import { gatewayExchange } from '../runtime/index.js';
import { policyVerdict } from '../runtime/policy.js';

async function agentReachable(targetUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${targetUrl}/health`, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function simulateAttackClosed(
  finding: Finding,
  targetUrl = process.env.AGENT_URL ?? 'http://localhost:4100',
): Promise<SimulationResult> {
  if (finding.replay && (await agentReachable(targetUrl))) {
    const exchange = await gatewayExchange(targetUrl, finding.replay);
    return {
      findingId: finding.id,
      replayed: true,
      blocked: exchange.delivered.blocked,
      detail: exchange.delivered.blocked
        ? `Replayed original attack; gateway blocked it (${exchange.delivered.rule}). Chain closed.`
        : `Replayed original attack; gateway DID NOT block it — chain still open.`,
    };
  }

  // Policy dry-run on the recorded chain (no live agent to replay against).
  const verdict = policyVerdict(finding.observedNodes);
  return {
    findingId: finding.id,
    replayed: false,
    blocked: verdict.blocked,
    detail: verdict.blocked
      ? `Policy dry-run: recorded chain now violates ${verdict.rule}; gateway would block it.`
      : `Policy dry-run: recorded chain is not covered by any rule — chain still open.`,
  };
}
