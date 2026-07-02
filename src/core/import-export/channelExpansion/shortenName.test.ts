import { describe, expect, it } from 'vitest';
import { shortenWireName } from './shortenName.ts';
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
