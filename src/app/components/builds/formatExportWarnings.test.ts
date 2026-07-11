import { describe, expect, it } from 'vitest';
import {
  formatExportWarnings,
  memberCapItemLine,
  wireNameShorteningIntro,
} from './formatExportWarnings.ts';

describe('formatExportWarnings', () => {
  it('keeps non wire-name warnings in general', () => {
    const result = formatExportWarnings([
      'Including 21 channel(s) not linked to a zone',
      'Including 10 talk group(s) not referenced by a channel',
    ]);
    expect(result.general).toEqual([
      'Including 21 channel(s) not linked to a zone',
      'Including 10 talk group(s) not referenced by a channel',
    ]);
    expect(result.memberCapGroups).toEqual([]);
    expect(result.shortenedGroups).toEqual([]);
  });

  it('groups zone scan cap and scan list truncation warnings', () => {
    const result = formatExportWarnings([
      'Zone "Edinburgh" has 28 expanded members (scan cap 16)',
      'Zone "Glasgow" has 32 expanded members (scan cap 16)',
      'Zone "Edinburgh" scan list truncated from 23 to 16 members',
      'Zone "Glasgow" scan list truncated from 30 to 16 members',
    ]);

    expect(result.general).toEqual([]);
    expect(result.memberCapGroups).toHaveLength(2);
    expect(result.memberCapGroups[0]?.title).toBe('Zones over scan member cap');
    expect(result.memberCapGroups[0]?.items).toEqual([
      { label: 'Edinburgh', count: 28, cap: 16 },
      { label: 'Glasgow', count: 32, cap: 16 },
    ]);
    expect(result.memberCapGroups[1]?.title).toBe('Zone scan lists truncated');
    expect(result.memberCapGroups[1]?.items).toEqual([
      { label: 'Edinburgh', count: 16, cap: 16, truncatedFrom: 23 },
      { label: 'Glasgow', count: 16, cap: 16, truncatedFrom: 30 },
    ]);
  });

  it('groups channel and talk group shortenings separately', () => {
    const result = formatExportWarnings([
      'Channel wire name "Aberdeen Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Aber Approach"',
      'Talk group wire name "Australia, New Zealand" exceeds 16 characters for Anytone AT-D890UV; exported as "Aus+NZ"',
      'Channel wire name "Edinburgh Approach" exceeds 16 characters for Anytone AT-D890UV; exported as "Edinb Approach"',
    ]);

    expect(result.general).toEqual([]);
    expect(result.shortenedGroups).toHaveLength(2);
    expect(result.shortenedGroups[0]?.title).toBe('Channel names shortened');
    expect(result.shortenedGroups[0]?.items).toEqual([
      { original: 'Aberdeen Approach', exported: 'Aber Approach', stillExceedsLimit: false },
      { original: 'Edinburgh Approach', exported: 'Edinb Approach', stillExceedsLimit: false },
    ]);
    expect(result.shortenedGroups[1]?.title).toBe('Talk group names shortened');
    expect(result.shortenedGroups[1]?.items).toEqual([
      {
        original: 'Australia, New Zealand',
        exported: 'Aus+NZ',
        stillExceedsLimit: false,
      },
    ]);
  });

  it('builds intro copy from limit and profile label', () => {
    const result = formatExportWarnings([
      'Zone wire name "Very Long Zone Name Here" exceeds 16 characters for Anytone AT-D890UV; exported as "Short Zone"',
    ]);
    const group = result.shortenedGroups[0]!;
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
});
