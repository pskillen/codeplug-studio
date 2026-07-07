import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { applyWireNameLimits } from './exportWireNames.ts';
import { expandChannelWireRows } from './multiMode.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name' | 'callsign'>): Channel {
  return {
    id: 'ch-1',
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    rxFrequency: null,
    txFrequency: null,
    location: null,
    useLocation: false,
    maidenheadLocator: null,
    power: null,
    scanInclusion: 'default',
    forbidTransmit: false,
    comment: '',
    modeProfiles: [],
    ...partial,
  };
}

describe('applyWireNameLimits', () => {
  it('uses channel abbreviation before dictionary shortening by default', () => {
    const row = channel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    const reserved = new Set<string>();
    const warnings: string[] = [];
    const wireName = applyWireNameLimits(
      'GB3MT Mugherafelt',
      row,
      reserved,
      { shortenNames: true, maxNameLength: 16 },
      'opengd77-1701',
      warnings,
    );
    expect(wireName).toBe("GB3MT M'flt");
    expect(wireName).not.toContain('Mghr');
  });

  it('skips abbreviation when useChannelAbbreviation is false', () => {
    const row = channel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
    });
    const reserved = new Set<string>();
    const warnings: string[] = [];
    const wireName = applyWireNameLimits(
      'GB3MT Mugherafelt',
      row,
      reserved,
      { shortenNames: true, maxNameLength: 16, useChannelAbbreviation: false },
      'opengd77-1701',
      warnings,
    );
    expect(wireName).not.toBe("GB3MT M'flt");
    expect(wireName.length).toBeLessThanOrEqual(16);
  });

  it('keeps mode suffixes on multi-mode rows when abbreviation is used', () => {
    const row = channel({
      callsign: 'GB3MT',
      name: 'Mugherafelt',
      abbreviation: "M'flt",
      modeProfiles: [
        { mode: 'fm', squelch: 50, rxTone: 'none', txTone: 'none', bandwidthKHz: 12.5 },
        {
          mode: 'dmr',
          colourCode: 1,
          timeslot: 2,
          dmrId: 123,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    });
    const rows = expandChannelWireRows(row, undefined, true, {
      shortenNames: true,
      maxNameLength: 16,
    });
    expect(rows).toHaveLength(2);
    expect(rows[0]?.wireName).toBe("GB3MT M'flt-F");
    expect(rows[1]?.wireName).toBe("GB3MT M'flt-D");
  });
});
