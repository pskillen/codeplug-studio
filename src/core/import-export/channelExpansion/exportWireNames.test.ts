import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { applyWireNameLimits } from './exportWireNames.ts';

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
    scanSkip: false,
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
});
