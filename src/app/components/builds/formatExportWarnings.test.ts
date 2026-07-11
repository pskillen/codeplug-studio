import { describe, expect, it } from 'vitest';
import { formatExportWarnings, wireNameShorteningIntro } from './formatExportWarnings.ts';

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
    expect(result.shortenedGroups).toEqual([]);
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
});
