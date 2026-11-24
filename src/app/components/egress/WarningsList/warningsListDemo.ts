import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushKepsExcludedWarning } from '@core/import-export/exportWarning.ts';

export function styleguideWarningsListDemo(): ExportWarning[] {
  const warnings: ExportWarning[] = [
    {
      kind: 'wire_name',
      severity: 'problem',
      remediation: 'truncated',
      entityKind: 'Channel',
      original: 'Very Long Repeater Name',
      exported: 'Very Long Rep',
      limit: 16,
      entityId: 'ch-demo-1',
    },
    {
      kind: 'member_cap',
      severity: 'problem',
      capKind: 'zone-expanded-cap',
      label: 'Scotland',
      count: 24,
      cap: 16,
    },
  ];

  for (let i = 0; i < 46; i++) {
    warnings.push({
      kind: 'wire_name',
      severity: 'info',
      remediation: 'shortened',
      entityKind: 'Channel',
      original: `Clean Shorten Original ${i + 1}`,
      exported: `Short ${i + 1}`,
      limit: 16,
      entityId: `ch-clean-${i}`,
    });
  }

  pushKepsExcludedWarning(warnings, {
    satelliteId: 'FOX-1A',
    transmitterId: null,
    reason: 'not supported on this radio',
    label: 'Fox-1A',
  });

  return warnings;
}

export function styleguideChannelLabel(entityId: string): string | undefined {
  if (entityId === 'ch-demo-1') return 'GB3XX — Glasgow North';
  if (entityId.startsWith('ch-clean-')) return `GB3CL — Channel ${entityId.slice(-1)}`;
  return undefined;
}
