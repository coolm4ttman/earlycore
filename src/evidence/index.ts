// PROVE — Senso-grounded evidence. Each finding's control mapping is grounded
// in real regulatory clause text pulled from Senso's knowledge base when
// SENSO_API_KEY is set; the offline fallback clause set below is a clearly
// marked stub. The auditor pack bundles everything the loop actually did —
// findings, actions, replays, scores — into one artifact.

import { mkdirSync, writeFileSync } from 'node:fs';
import type {
  AuditorPack,
  ComplianceScore,
  ControlMapping,
  Finding,
  FindingCategory,
  FindingRecord,
  Framework,
  Remediation,
  SimulationResult,
} from '../types.js';

// Which control each finding category maps to. The CLAUSE TEXT is what Senso
// supplies for real; the fallback below is a marked stub.
const CONTROL_FOR: Record<
  FindingCategory,
  { framework: Framework; clause: string; query: string }
> = {
  'prompt-injection': {
    framework: 'EU AI Act',
    clause: 'Article 15',
    query: 'EU AI Act Article 15 accuracy robustness cybersecurity',
  },
  'indirect-injection': {
    framework: 'EU AI Act',
    clause: 'Article 15',
    query: 'EU AI Act Article 15 resilience against manipulation of inputs',
  },
  'pii-leak': {
    framework: 'GDPR',
    clause: 'Article 5(1)(f)',
    query: 'GDPR Article 5 integrity confidentiality personal data',
  },
  'data-exfiltration': {
    framework: 'SOC 2',
    clause: 'CC6.1',
    query: 'SOC 2 CC6.1 logical access controls confidential data',
  },
  'excessive-agency': {
    framework: 'SOC 2',
    clause: 'CC6.3',
    query: 'SOC 2 CC6.3 least privilege authorization',
  },
  bfla: {
    framework: 'SOC 2',
    clause: 'CC6.3',
    query: 'SOC 2 CC6.3 function level authorization',
  },
  bola: {
    framework: 'GDPR',
    clause: 'Article 32',
    query: 'GDPR Article 32 security of processing access control',
  },
  ssrf: {
    framework: 'NIST AI RMF',
    clause: 'MANAGE 2.4',
    query: 'NIST AI RMF MANAGE mechanisms to sustain value and respond to risks',
  },
  hijacking: {
    framework: 'NIST AI RMF',
    clause: 'MEASURE 2.7',
    query: 'NIST AI RMF MEASURE AI system security and resilience evaluated',
  },
  other: {
    framework: 'NIST AI RMF',
    clause: 'MEASURE 2.7',
    query: 'NIST AI RMF MEASURE security monitoring',
  },
};

// Marked stub clause text — replaced by Senso's real KB content when a key is set.
const FALLBACK_TEXT: Record<string, string> = {
  'EU AI Act:Article 15':
    'High-risk AI systems shall be designed to achieve an appropriate level of accuracy, robustness and cybersecurity, and to be resilient against attempts by unauthorised third parties to alter their use or performance by exploiting system vulnerabilities.',
  'GDPR:Article 5(1)(f)':
    'Personal data shall be processed in a manner that ensures appropriate security of the personal data, including protection against unauthorised or unlawful processing, using appropriate technical or organisational measures.',
  'GDPR:Article 32':
    'The controller and the processor shall implement appropriate technical and organisational measures to ensure a level of security appropriate to the risk.',
  'SOC 2:CC6.1':
    'The entity implements logical access security software, infrastructure, and architectures over protected information assets to protect them from security events.',
  'SOC 2:CC6.3':
    'The entity authorizes, modifies, or removes access to data, software, functions, and other protected information assets based on roles, responsibilities, and the principle of least privilege.',
  'NIST AI RMF:MEASURE 2.7':
    'AI system security and resilience — as identified in the MAP function — are evaluated and documented.',
  'NIST AI RMF:MANAGE 2.4':
    'Mechanisms are in place and applied to supersede, disengage, or deactivate AI systems that demonstrate performance or outcomes inconsistent with intended use.',
};

// Cache per-query so an 80-finding run doesn't repeat identical searches.
const clauseCache = new Map<string, string | null>();

async function sensoClauseText(query: string): Promise<string | null> {
  if (clauseCache.has(query)) return clauseCache.get(query) ?? null;
  let answer: string | null = null;
  try {
    // Real Senso semantic search via the authenticated CLI (the org's KB is
    // populated by the senso-onboarding flow, including EU-regulation context).
    const { spawnSync } = await import('node:child_process');
    const { existsSync } = await import('node:fs');
    const bin = existsSync('node_modules/.bin/senso') ? 'node_modules/.bin/senso' : 'senso';
    const r = spawnSync(bin, ['search', query, '--output', 'json', '--quiet'], {
      encoding: 'utf8',
      timeout: 30_000,
    });
    if (r.status === 0) {
      const clean = (r.stdout ?? '').replace(/\[[0-9;]*m/g, '');
      const m = /\{[\s\S]*\}/.exec(clean);
      const data: any = m ? JSON.parse(m[0]) : null;
      const text = data?.answer || data?.results?.[0]?.chunk_text;
      if (typeof text === 'string' && text.length > 40) answer = text.slice(0, 600);
    }
  } catch {
    answer = null;
  }
  clauseCache.set(query, answer);
  return answer;
}

export async function mapToControl(finding: Finding): Promise<ControlMapping> {
  const ctrl = CONTROL_FOR[finding.category];
  const key = `${ctrl.framework}:${ctrl.clause}`;

  const real = await sensoClauseText(ctrl.query);
  if (real) {
    return {
      findingId: finding.id,
      framework: ctrl.framework,
      clause: ctrl.clause,
      clauseText: real,
      mode: 'real',
    };
  }

  return {
    findingId: finding.id,
    framework: ctrl.framework,
    clause: ctrl.clause,
    clauseText: FALLBACK_TEXT[key] ?? 'Clause text unavailable (stub).',
    mode: 'stub',
  };
}

/** Assemble and persist the auditor pack from what the loop actually did. */
export function buildAuditorPack(input: {
  scores: ComplianceScore[];
  mappings: ControlMapping[];
  records: FindingRecord[];
  remediations: Remediation[];
  simulations: SimulationResult[];
}): AuditorPack {
  const pack: AuditorPack = { generatedAt: new Date().toISOString(), ...input };
  try {
    mkdirSync('.earlycore', { recursive: true });
    writeFileSync('.earlycore/auditor-pack.json', JSON.stringify(pack, null, 2));
  } catch {
    // Persisting the pack is best-effort; the in-memory pack is still returned.
  }
  return pack;
}
