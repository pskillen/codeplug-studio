import { describe, expect, it } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  formatExportWarning,
  hasProblemWarnings,
  pushKepsExcludedWarning,
  summariseExportWarnings,
} from '@core/import-export/exportWarning.ts';

describe('summariseExportWarnings', () => {
  it('summarises problems and notes over every kind', () => {
    const warnings: ExportWarning[] = [];
    pushKepsExcludedWarning(warnings, {
      satelliteId: 'sat-1',
      transmitterId: null,
      reason: 'wrong band',
      label: 'AO-91',
    });
    warnings.push(
      {
        kind: 'wire_name',
        severity: 'info',
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Very Long Channel Name Here',
        exported: 'Very Long Chan',
        limit: 16,
      },
      {
        kind: 'wire_name',
        severity: 'problem',
        remediation: 'truncated',
        entityKind: 'Channel',
        original: 'Too Long Still',
        exported: 'Too Long Stil',
        limit: 12,
      },
      {
        kind: 'member_cap',
        severity: 'problem',
        capKind: 'zone-expanded-cap',
        label: 'Z1',
        count: 50,
        cap: 16,
      },
      { kind: 'unlinked', severity: 'problem', message: 'orphan channel' },
      { kind: 'general', severity: 'problem', message: 'something went wrong' },
      { kind: 'general', severity: 'info', message: 'just a tip' },
      { kind: 'zone_scan_set', severity: 'problem', issue: 'too-few', zoneName: 'Home', count: 1 },
      { kind: 'zone_order', severity: 'problem', zoneName: 'Work' },
    );
    expect(summariseExportWarnings(warnings)).toEqual({ problems: 6, info: 3 });
  });

  it('hasProblemWarnings is false for notes only', () => {
    const warnings: ExportWarning[] = [
      { kind: 'general', severity: 'info', message: 'tip' },
      {
        kind: 'wire_name',
        severity: 'info',
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'A',
        exported: 'B',
        limit: 16,
      },
    ];
    expect(hasProblemWarnings(warnings)).toBe(false);
  });

  it('hasProblemWarnings is true for a truncated wire name', () => {
    const warnings: ExportWarning[] = [
      {
        kind: 'wire_name',
        severity: 'problem',
        remediation: 'truncated',
        entityKind: 'Channel',
        original: 'A',
        exported: 'B',
        limit: 16,
      },
    ];
    expect(hasProblemWarnings(warnings)).toBe(true);
  });

  it('formats keps_excluded like the Done skip line', () => {
    const warnings: ExportWarning[] = [];
    pushKepsExcludedWarning(warnings, {
      satelliteId: 'AO-91',
      transmitterId: null,
      reason: 'not supported on this radio',
      label: 'Fox-1A',
    });
    expect(formatExportWarning(warnings[0]!)).toBe('Skipped Fox-1A: not supported on this radio');
  });
});
