import { describe, expect, it } from 'vitest';
import { finalizeWireName, shortenWireName } from './shortenName.ts';
import { composeChannelWireName } from '@core/domain/channelNaming.ts';
import { channelWireNamePreviewExamples } from './channelWireNamePreview.ts';

describe('shortenWireName channel abbreviation', () => {
  it('tries abbreviation before dictionary shortening', () => {
    const full = composeChannelWireName({
      callsign: 'GB7GL',
      name: 'Glasgow Scotland',
      exportNameMode: 'callsign_name',
    });
    expect(full.length).toBeGreaterThan(16);

    const shortened = shortenWireName(full, 16, {
      exportNameMode: 'callsign_name',
      recomposeWithMode: (mode) =>
        composeChannelWireName({
          callsign: 'GB7GL',
          name: 'Glasgow Scotland',
          exportNameMode: mode,
        }),
      recomposeWithChannelAbbreviation: () =>
        composeChannelWireName({
          callsign: 'GB7GL',
          name: 'Glas',
          exportNameMode: 'callsign_name',
        }),
    });

    expect(shortened).toBe('GB7GL Glas');
    expect(shortened.length).toBeLessThanOrEqual(16);
  });

  it('falls back to dictionary when abbreviation is still too long', () => {
    const full = 'GB7GL Very Long Place Name';
    const shortened = shortenWireName(full, 16, {
      recomposeWithChannelAbbreviation: () => 'GB7GL Still Too Long Abbrev',
    });
    expect(shortened.length).toBeLessThanOrEqual(16);
    expect(shortened).not.toBe(full);
  });

  it('preserves multi-mode suffix when abbreviation fits', () => {
    const shortened = shortenWireName('GB3MT Mugherafelt-D', 16, {
      recomposeWithChannelAbbreviation: () => "GB3MT M'flt",
    });
    expect(shortened).toBe("GB3MT M'flt-D");
  });

  it('replaces a trailing talk-group member suffix before dictionary steps', () => {
    const name = 'GB7AC Largs Scot West TS1';
    const shortened = shortenWireName(name, 20, {
      talkGroupMemberSuffix: { full: 'Scot West TS1', abbreviated: 'SW1' },
    });
    expect(shortened).toBe('GB7AC Largs SW1');
    expect(shortened.length).toBeLessThanOrEqual(20);
  });
});

describe('hyphenated channel sets (CHIRP 7)', () => {
  it('applies dictionary PMR446→PMR inside PMR446-N', () => {
    expect(shortenWireName('PMR446-1', 7)).toBe('PMR-1');
    expect(shortenWireName('PMR446-16', 7)).toBe('PMR-16');
  });

  it('finalizes PMR446-1…16 uniquely within 7 chars without PMR44 collision stem', () => {
    const reserved = new Set<string>();
    const names: string[] = [];
    for (let n = 1; n <= 16; n++) {
      const name = finalizeWireName(`PMR446-${n}`, reserved, 7);
      expect(name.length).toBeLessThanOrEqual(7);
      expect(name.startsWith('PMR')).toBe(true);
      expect(name.startsWith('PMR44')).toBe(false);
      names.push(name);
    }
    expect(new Set(names).size).toBe(16);
  });

  it('keeps distinguishing designators for banded simplex names under 7', () => {
    expect(shortenWireName('UHF-SU24', 7)).toBe('SU24');
    expect(shortenWireName('VHF-S20', 7)).toBe('VHF-S20');
    expect(shortenWireName('VHF-S20', 6)).toBe('S20');
  });
});

describe('finalizeWireName', () => {
  it('keeps double-digit disambiguation within maxLen (CHIRP 7)', () => {
    const reserved = new Set<string>(['PMR44']);
    for (let n = 2; n <= 9; n++) {
      reserved.add(`PMR44 ${n}`);
    }
    const name = finalizeWireName('PMR446 Channel Ten', reserved, 7);
    expect(name.length).toBeLessThanOrEqual(7);
    expect(reserved.has(name)).toBe(true);
  });

  it('fits many colliding stems on a 7-char limit', () => {
    const reserved = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const name = finalizeWireName('PMR446 Shared', reserved, 7);
      expect(name.length).toBeLessThanOrEqual(7);
    }
    expect(reserved.size).toBe(20);
  });
});

describe('channelWireNamePreviewExamples', () => {
  it('returns composed and limited names per export mode', () => {
    const rows = channelWireNamePreviewExamples({
      callsign: 'GB7GL',
      name: 'Glasgow Scotland',
      abbreviation: 'Glas',
    });
    expect(rows).toHaveLength(4);
    const callsignName = rows.find((r) => r.mode === 'callsign_name');
    expect(callsignName?.composed).toBe('GB7GL Glasgow Scotland');
    expect(callsignName?.limited.length).toBeLessThanOrEqual(16);
  });
});
