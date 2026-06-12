// Finding lifecycle: P0–P3 priority, status transitions, ownership routing,
// and Jira round-trip sync (via Composio when a key is present).
//
//   open → remediating → closed → verified-closed
//
// P0 = critical (act now), P1 = high, P2 = medium, P3 = low.

import type { Finding, FindingRecord, FindingStatus, Priority, Severity } from '../types.js';
import { composioExecute } from '../remediate/index.js';

export function priorityFor(severity: Severity): Priority {
  switch (severity) {
    case 'critical':
      return 'P0';
    case 'high':
      return 'P1';
    case 'medium':
      return 'P2';
    case 'low':
      return 'P3';
  }
}

// Ownership routing by category — who gets paged.
function ownerFor(finding: Finding): string {
  switch (finding.category) {
    case 'pii-leak':
    case 'data-exfiltration':
      return 'data-protection';
    case 'excessive-agency':
    case 'bfla':
    case 'bola':
      return 'platform-security';
    default:
      return 'agent-platform';
  }
}

export class FindingTracker {
  private records = new Map<string, FindingRecord>();

  open(finding: Finding): FindingRecord {
    const record: FindingRecord = {
      finding,
      priority: priorityFor(finding.severity),
      status: 'open',
      owner: ownerFor(finding),
      openedAt: new Date().toISOString(),
    };
    this.records.set(finding.id, record);
    return record;
  }

  setStatus(findingId: string, status: FindingStatus): FindingRecord | undefined {
    const record = this.records.get(findingId);
    if (!record) return undefined;
    record.status = status;
    if (status === 'closed' || status === 'verified-closed') {
      record.closedAt = new Date().toISOString();
    }
    return record;
  }

  get(findingId: string): FindingRecord | undefined {
    return this.records.get(findingId);
  }

  all(): FindingRecord[] {
    return [...this.records.values()];
  }

  /**
   * Round-trip Jira sync: create/update the issue for a record and store the
   * issue key back on the record. Real via Composio when COMPOSIO_API_KEY is
   * set; otherwise a marked stub that still exercises the lifecycle.
   */
  async jiraSync(findingId: string): Promise<FindingRecord | undefined> {
    const record = this.records.get(findingId);
    if (!record) return undefined;

    const res = await composioExecute('JIRA_CREATE_ISSUE', {
      summary: `[EarlyCore][${record.priority}] ${record.finding.category}: ${record.finding.id}`,
      description:
        `${record.finding.description}\n\nStatus: ${record.status}\nOwner: ${record.owner}\n` +
        `Evidence: ${record.finding.evidence}`,
    });
    // TODO(sponsor): swap to real SDK — parse the created issue key from the
    // Composio response and poll JIRA_GET_ISSUE for status round-trip.
    record.jiraKey = res.mode === 'real' ? 'JIRA-SYNCED' : `STUB-${record.finding.id}`;
    return record;
  }
}
