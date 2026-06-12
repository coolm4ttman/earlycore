// PROVE — live compliance posture scores computed transparently from real
// findings and real remediation outcomes. Nothing here is a hardcoded number:
// every score carries the per-finding residual-risk contributions that
// produced it, so an auditor can recompute it by hand.
//
// Posture model (scales to any number of findings — this is the key):
//   • Each relevant finding carries a severity risk weight
//     (critical 25, high 15, medium 8, low 3).
//   • A finding's RESIDUAL risk = weight × residual factor, where the factor
//     shrinks as EarlyCore mitigates it:
//       open 1.0 · remediating 0.4 · closed 0.15 · verified-closed 0.05
//   • Framework score = 100 × (1 − residualRisk / totalPotentialRisk).
//     A framework with no relevant findings scores 100. A framework whose
//     findings are all open scores ~0. One whose findings EarlyCore found AND
//     autonomously closed scores high — detection + remediation IS good posture.

import type {
  ComplianceScore,
  FindingCategory,
  FindingRecord,
  Framework,
  Severity,
} from '../types.js';

export const FRAMEWORKS: Framework[] = [
  'GDPR',
  'SOC 2',
  'ISO 42001',
  'NIST AI RMF',
  'EU AI Act',
  'IEEE 7000',
];

const WEIGHT: Record<Severity, number> = { critical: 25, high: 15, medium: 8, low: 3 };

// Which frameworks a finding category bears on. PII touches privacy frameworks
// hardest; agency/authorization failures touch control frameworks. Unmapped
// categories fall back to the broad AI-risk frameworks.
const RELEVANT: Partial<Record<FindingCategory, Framework[]>> = {
  'pii-leak': ['GDPR', 'EU AI Act', 'SOC 2', 'ISO 42001'],
  'data-exfiltration': ['GDPR', 'SOC 2', 'NIST AI RMF'],
  'prompt-injection': ['EU AI Act', 'NIST AI RMF', 'ISO 42001'],
  'indirect-injection': ['EU AI Act', 'NIST AI RMF', 'ISO 42001'],
  'excessive-agency': ['SOC 2', 'NIST AI RMF', 'IEEE 7000', 'ISO 42001'],
  bfla: ['SOC 2', 'NIST AI RMF'],
  bola: ['SOC 2', 'GDPR'],
  ssrf: ['SOC 2', 'NIST AI RMF'],
  hijacking: ['EU AI Act', 'NIST AI RMF', 'IEEE 7000'],
};
const FALLBACK_FRAMEWORKS: Framework[] = ['NIST AI RMF', 'ISO 42001'];

function relevantFrameworks(category: FindingCategory): Framework[] {
  return RELEVANT[category] ?? FALLBACK_FRAMEWORKS;
}

function residualFactor(record: FindingRecord): number {
  switch (record.status) {
    case 'verified-closed':
      return 0.05;
    case 'closed':
      return 0.15;
    case 'remediating':
      return 0.4;
    default:
      return 1; // open
  }
}

export function computeScores(records: FindingRecord[]): ComplianceScore[] {
  return FRAMEWORKS.map((framework) => {
    const deductions: ComplianceScore['deductions'] = [];
    let open = 0;
    let mitigated = 0;
    let totalRisk = 0;
    let residualRisk = 0;

    for (const record of records) {
      const { finding } = record;
      if (!finding.landed) continue;
      if (!relevantFrameworks(finding.category).includes(framework)) continue;

      const weight = WEIGHT[finding.severity];
      const factor = residualFactor(record);
      const residual = Math.round(weight * factor * 10) / 10;
      totalRisk += weight;
      residualRisk += residual;

      deductions.push({ findingId: finding.id, points: residual, mitigated: factor < 1 });
      if (record.status === 'open') open++;
      else mitigated++;
    }

    // No relevant findings → clean posture for this framework.
    const score = totalRisk === 0 ? 100 : Math.round(100 * (1 - residualRisk / totalRisk));

    return {
      framework,
      score: Math.max(0, Math.min(100, score)),
      openFindings: open,
      closedFindings: mitigated,
      deductions,
    };
  });
}
