// PROVE — live compliance scores computed transparently from real findings and
// real remediation outcomes. Nothing here is a hardcoded number: every score
// carries the per-finding deductions that produced it, so an auditor can
// recompute it by hand.
//
// Scoring model (documented so it is auditable, not magical):
//   • Each framework starts at 100.
//   • An OPEN finding in a category relevant to the framework deducts its full
//     severity weight (critical 25, high 15, medium 8, low 3).
//   • A finding that EarlyCore remediated AND verified closed (simulate
//     confirmed the chain is blocked) deducts 20% of its weight — the control
//     gap existed and is on record, but the exposure is gone.
//   • A finding remediated but not yet verified deducts 50%.
//   Score = max(0, 100 − Σ deductions), rounded.

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
// hardest; agency/authorization failures touch control frameworks.
const RELEVANT: Record<FindingCategory, Framework[]> = {
  'pii-leak': ['GDPR', 'EU AI Act', 'SOC 2', 'ISO 42001'],
  'data-exfiltration': ['GDPR', 'SOC 2', 'NIST AI RMF'],
  'prompt-injection': ['EU AI Act', 'NIST AI RMF', 'ISO 42001'],
  'indirect-injection': ['EU AI Act', 'NIST AI RMF', 'ISO 42001'],
  'excessive-agency': ['SOC 2', 'NIST AI RMF', 'IEEE 7000', 'ISO 42001'],
  bfla: ['SOC 2', 'NIST AI RMF'],
  bola: ['SOC 2', 'GDPR'],
  ssrf: ['SOC 2', 'NIST AI RMF'],
  hijacking: ['EU AI Act', 'NIST AI RMF', 'IEEE 7000'],
  other: ['NIST AI RMF'],
};

function residualFactor(record: FindingRecord): number {
  if (record.status === 'verified-closed') return 0.2;
  if (record.status === 'closed' || record.status === 'remediating') return 0.5;
  return 1; // open
}

export function computeScores(records: FindingRecord[]): ComplianceScore[] {
  return FRAMEWORKS.map((framework) => {
    const deductions: ComplianceScore['deductions'] = [];
    let open = 0;
    let closed = 0;

    for (const record of records) {
      const { finding } = record;
      if (!finding.landed) continue;
      if (!RELEVANT[finding.category].includes(framework)) continue;

      const factor = residualFactor(record);
      const points = Math.round(WEIGHT[finding.severity] * factor * 10) / 10;
      deductions.push({ findingId: finding.id, points, mitigated: factor < 1 });
      if (record.status === 'open') open++;
      else closed++;
    }

    const total = deductions.reduce((sum, d) => sum + d.points, 0);
    return {
      framework,
      score: Math.max(0, Math.round(100 - total)),
      openFindings: open,
      closedFindings: closed,
      deductions,
    };
  });
}
