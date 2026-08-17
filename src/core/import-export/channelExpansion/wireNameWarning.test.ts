import { describe, expect, it } from 'vitest';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { pushWireNameCollisionWarning, pushWireNameLengthWarning } from './wireNameWarning.ts';

describe('pushWireNameLengthWarning', () => {
  it('includes exported shortened name when shortening succeeds', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Talk group',
      original: 'Australia, New Zealand',
      exported: 'AU NZ',
      maxLen: 16,
      profileLabel: 'Anytone AT-D890UV',
      shortenEnabled: true,
    });
    expect(warnings).toEqual([
      {
        kind: 'wire_name',
        severity: 'info',
        remediation: 'shortened',
        entityKind: 'Talk group',
        original: 'Australia, New Zealand',
        exported: 'AU NZ',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      },
    ]);
  });

  it('reports when shortened name still exceeds the limit', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original: 'Very Long Original Name',
      exported: 'Still Too Long Name',
      maxLen: 10,
      shortenEnabled: true,
    });
    expect(warnings[0]).toMatchObject({
      kind: 'wire_name',
      severity: 'problem',
      remediation: 'truncated',
      original: 'Very Long Original Name',
      exported: 'Still Too Long Name',
      limit: 10,
    });
  });

  it('omits warning when original fits within limit', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Zone',
      original: 'Glasgow',
      exported: 'Glasgow',
      maxLen: 16,
      shortenEnabled: true,
    });
    expect(warnings).toEqual([]);
  });

  it('reports over_limit remediation when shortening is disabled', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameLengthWarning(warnings, {
      entityKind: 'Channel',
      original: 'Very Long Original Name',
      exported: 'Very Long Original Name',
      maxLen: 10,
      shortenEnabled: false,
    });
    expect(warnings[0]).toMatchObject({
      kind: 'wire_name',
      severity: 'problem',
      remediation: 'over_limit',
      limit: 10,
    });
  });
});

describe('pushWireNameCollisionWarning', () => {
  it('pushes a collision message when the name was disambiguated', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Channel',
      candidate: 'Glasgow',
      disambiguated: 'Glasgow 2',
    });
    expect(warnings).toEqual([
      {
        kind: 'wire_name',
        severity: 'problem',
        remediation: 'disambiguated',
        entityKind: 'Channel',
        original: 'Glasgow',
        exported: 'Glasgow 2',
        limit: 0,
      },
    ]);
  });

  it('omits warning when the candidate was not disambiguated', () => {
    const warnings: ExportWarning[] = [];
    pushWireNameCollisionWarning(warnings, {
      entityKind: 'Zone',
      candidate: 'Edinburgh',
      disambiguated: 'Edinburgh',
    });
    expect(warnings).toEqual([]);
  });
});
