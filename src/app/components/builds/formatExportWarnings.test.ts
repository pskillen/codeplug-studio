import { describe, expect, it } from 'vitest';
import type { MemberCapWarningKind } from '@core/import-export/exportWarning.ts';
import type { WireNameRemediation } from '@core/services/resolveWireNames.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import {
  formatExportWarnings,
  memberCapItemLine,
  wireNameShorteningIntro,
} from './formatExportWarnings.ts';

function unlinked(message: string): ExportWarning {
  return { kind: 'unlinked', severity: 'problem', message };
}

function general(message: string): ExportWarning {
  return { kind: 'general', severity: 'problem', message };
}

function memberCap(params: {
  capKind: MemberCapWarningKind;
  label: string;
  count: number;
  cap: number;
  truncatedFrom?: number;
  profileLabel?: string;
}): ExportWarning {
  return { kind: 'member_cap', severity: 'problem', ...params };
}

function wireName(params: {
  remediation: WireNameRemediation;
  entityKind: string;
  original: string;
  exported: string;
  limit: number;
  profileLabel?: string;
}): ExportWarning {
  const severity = params.remediation === 'shortened' ? 'info' : 'problem';
  return { kind: 'wire_name', severity, ...params };
}

describe('formatExportWarnings', () => {
  it('groups unlinked inclusion warnings separately from other general lines', () => {
    const result = formatExportWarnings([
      unlinked('Including 21 channel(s) not linked to a zone'),
      unlinked('Including 10 talk group(s) not referenced by a channel'),
      general('Build exceeded profile channel cap'),
    ]);
    expect(result.unlinkedGroup).toEqual({
      title: 'Export unlinked items',
      items: [
        'Including 21 channel(s) not linked to a zone',
        'Including 10 talk group(s) not referenced by a channel',
      ],
    });
    expect(result.general).toEqual(['Build exceeded profile channel cap']);
    expect(result.memberCapGroups).toEqual([]);
    expect(result.shortenedProblemGroups).toEqual([]);
    expect(result.shortenedInfoGroups).toEqual([]);
  });

  it('groups zone member cap and scan list truncation warnings', () => {
    const result = formatExportWarnings([
      memberCap({ capKind: 'zone-expanded-cap', label: 'Edinburgh', count: 70, cap: 64 }),
      memberCap({ capKind: 'zone-expanded-cap', label: 'Glasgow', count: 80, cap: 64 }),
      memberCap({
        capKind: 'zone-scan-list-truncated',
        label: 'Edinburgh',
        count: 15,
        cap: 15,
        truncatedFrom: 23,
      }),
      memberCap({
        capKind: 'zone-scan-list-truncated',
        label: 'Glasgow',
        count: 15,
        cap: 15,
        truncatedFrom: 30,
      }),
    ]);

    expect(result.general).toEqual([]);
    expect(result.unlinkedGroup).toBeNull();
    expect(result.memberCapGroups).toHaveLength(2);
    expect(result.memberCapGroups[0]?.title).toBe('Zones over member cap');
    expect(result.memberCapGroups[0]?.items).toEqual([
      { label: 'Edinburgh', count: 70, cap: 64 },
      { label: 'Glasgow', count: 80, cap: 64 },
    ]);
    expect(result.memberCapGroups[1]?.title).toBe('Zone scan lists truncated');
    expect(result.memberCapGroups[1]?.items).toEqual([
      { label: 'Edinburgh', count: 15, cap: 15, truncatedFrom: 23 },
      { label: 'Glasgow', count: 15, cap: 15, truncatedFrom: 30 },
    ]);
  });

  it('groups channel and talk group shortenings separately', () => {
    const result = formatExportWarnings([
      wireName({
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
      wireName({
        remediation: 'shortened',
        entityKind: 'Talk group',
        original: 'Australia, New Zealand',
        exported: 'Aus+NZ',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
      wireName({
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Edinburgh Approach',
        exported: 'Edinb Approach',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
    ]);

    expect(result.general).toEqual([]);
    expect(result.unlinkedGroup).toBeNull();
    expect(result.shortenedProblemGroups).toEqual([]);
    expect(result.shortenedInfoGroups).toHaveLength(2);
    expect(result.shortenedInfoGroups[0]?.title).toBe('Channel names shortened');
    expect(result.shortenedInfoGroups[0]?.items).toEqual([
      { original: 'Aberdeen Approach', exported: 'Aber Approach', stillExceedsLimit: false },
      { original: 'Edinburgh Approach', exported: 'Edinb Approach', stillExceedsLimit: false },
    ]);
    expect(result.shortenedInfoGroups[1]?.title).toBe('Talk group names shortened');
    expect(result.shortenedInfoGroups[1]?.items).toEqual([
      {
        original: 'Australia, New Zealand',
        exported: 'Aus+NZ',
        stillExceedsLimit: false,
      },
    ]);
  });

  it('splits mixed clean and still-too-long shortenings for the same group key', () => {
    const result = formatExportWarnings([
      wireName({
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
      wireName({
        remediation: 'truncated',
        entityKind: 'Channel',
        original: 'This Name Remains Far Too Long After Shortening',
        exported: 'This Name Remains Far Too Long After Shortening',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
    ]);

    expect(result.shortenedInfoGroups).toHaveLength(1);
    expect(result.shortenedInfoGroups[0]?.items).toEqual([
      { original: 'Aberdeen Approach', exported: 'Aber Approach', stillExceedsLimit: false },
    ]);
    expect(result.shortenedProblemGroups).toHaveLength(1);
    expect(result.shortenedProblemGroups[0]?.items).toEqual([
      {
        original: 'This Name Remains Far Too Long After Shortening',
        exported: 'This Name Remains Far Too Long After Shortening',
        stillExceedsLimit: true,
      },
    ]);
  });

  it('builds intro copy from limit and profile label', () => {
    const result = formatExportWarnings([
      wireName({
        remediation: 'shortened',
        entityKind: 'Zone',
        original: 'Very Long Zone Name Here',
        exported: 'Short Zone',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
    ]);
    const group = result.shortenedInfoGroups[0]!;
    expect(wireNameShorteningIntro(group)).toBe(
      'The following names were too long for the 16 character limit of Anytone AT-D890UV and were shortened on export:',
    );
  });

  it('formats member cap list lines', () => {
    expect(
      memberCapItemLine({ label: 'Glasgow', count: 32, cap: 16 }, 'zone-expanded-scan-cap'),
    ).toBe('"Glasgow" — 32 members (cap 16)');
    expect(
      memberCapItemLine(
        { label: 'Glasgow', count: 16, cap: 16, truncatedFrom: 30 },
        'zone-scan-list-truncated',
      ),
    ).toBe('"Glasgow" — 30 → 16 members');
  });

  it('routes naming-collision warnings into shortenedProblemGroups', () => {
    const result = formatExportWarnings([
      wireName({
        remediation: 'disambiguated',
        entityKind: 'Channel',
        original: 'Glasgow',
        exported: 'Glasgow 2',
        limit: 0,
      }),
      wireName({
        remediation: 'shortened',
        entityKind: 'Channel',
        original: 'Aberdeen Approach',
        exported: 'Aber Approach',
        limit: 16,
        profileLabel: 'Anytone AT-D890UV',
      }),
    ]);

    expect(result.shortenedInfoGroups).toHaveLength(1);
    expect(result.shortenedProblemGroups).toHaveLength(1);
    expect(result.shortenedProblemGroups[0]?.title).toBe('Channel name collisions');
    expect(result.shortenedProblemGroups[0]?.items).toEqual([
      {
        original: 'Glasgow',
        exported: 'Glasgow 2',
        stillExceedsLimit: true,
        isCollision: true,
      },
    ]);
    expect(wireNameShorteningIntro(result.shortenedProblemGroups[0]!)).toContain('collided');
  });
});
