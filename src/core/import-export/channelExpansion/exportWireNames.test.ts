import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { applyWireNameLimits, resolveMaxNameLength } from './exportWireNames.ts';
import { expandChannelWireRows } from './multiMode.ts';

function channel(partial: Partial<Channel> & Pick<Channel, 'name' | 'callsign'>): Channel {
  return { ...newChannel('p1', partial.name, partial.callsign), ...partial };
}

describe('resolveMaxNameLength', () => {
  it('resolves Anytone profile name limits by prefix', () => {
    expect(resolveMaxNameLength('anytone-at-d890uv')).toBe(16);
  });

  it('resolves NeonPlug profile name limits by prefix', () => {
    expect(resolveMaxNameLength('neonplug-dm32uv')).toBe(16);
    expect(resolveMaxNameLength('neonplug-uv5rmini')).toBe(12);
  });

  it('resolves Direct radio UV-5R Mini name limit by prefix', () => {
    expect(resolveMaxNameLength('radio-io-uv5r-mini')).toBe(12);
  });

  it('returns undefined for unknown profile ids', () => {
    expect(resolveMaxNameLength('unknown-profile')).toBeUndefined();
  });
});

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
