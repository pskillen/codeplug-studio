import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { previewGeneratedChannelWireName } from '@core/services/previewChannelWireName.ts';
import { anytoneChannelWireName } from './exportChannelWire.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function dmrChannel(name: string) {
  return {
    ...newChannel(PROJECT_ID, name),
    callsign: 'GB3GL',
    rxFrequency: 438_800_000,
    txFrequency: 434_000_000,
    modeProfiles: [
      {
        mode: 'dmr' as const,
        colourCode: 1,
        timeslot: 2 as const,
        dmrId: 1234567,
        contactRef: null,
        rxGroupListId: null,
      },
    ],
  };
}

describe('anytoneChannelWireName', () => {
  it('shortens generated names to AT-D890UV profile limit', () => {
    const channel = dmrChannel('Very Long Channel Name That Exceeds Limit');
    const warnings: string[] = [];
    const wireName = anytoneChannelWireName(
      { entity: channel, wireName: 'unused' },
      { reserved: new Set(), warnings },
      { profileId: 'anytone-at-d890uv', shortenNames: true },
    );

    expect(wireName.length).toBeLessThanOrEqual(16);
    expect(warnings.some((w) => w.includes('exported as'))).toBe(true);
  });

  it('hard-truncates explicit wire overrides and warns when over limit', () => {
    const channel = dmrChannel('Short');
    const warnings: string[] = [];
    const override = 'This override is way too long';
    const wireName = anytoneChannelWireName(
      { entity: channel, wireName: override, wireNameOverride: override },
      { reserved: new Set(), warnings },
      { profileId: 'anytone-at-d890uv', shortenNames: true },
    );

    expect(wireName).toBe(override.slice(0, 16));
    expect(wireName.length).toBe(16);
    expect(warnings.some((w) => w.includes('exceeds 16 characters'))).toBe(true);
    expect(warnings.some((w) => w.includes(override))).toBe(true);
    expect(warnings.some((w) => w.includes('exported as'))).toBe(false);
  });

  it('keeps full name under limit when abbreviation is set (useChannelAbbreviation on)', () => {
    const channel = {
      ...dmrChannel('hotspot'),
      abbreviation: 'Hspt',
    };
    const wireName = anytoneChannelWireName(
      { entity: channel, wireName: 'GB3GL hotspot' },
      { reserved: new Set() },
      {
        profileId: 'anytone-at-d890uv',
        shortenNames: true,
        useChannelAbbreviation: true,
      },
    );

    expect(wireName).toBe('GB3GL hotspot');
  });

  it('shortens with library abbreviation when over nameLimit (useChannelAbbreviation on)', () => {
    const channel = {
      ...dmrChannel('Mugherafelt'),
      callsign: 'GB3MT',
      abbreviation: "M'flt",
    };
    const wireName = anytoneChannelWireName(
      { entity: channel, wireName: 'GB3MT Mugherafelt' },
      { reserved: new Set() },
      {
        profileId: 'anytone-at-d890uv',
        shortenNames: true,
        useChannelAbbreviation: true,
      },
    );

    expect(wireName).toBe("GB3MT M'flt");
  });

  it('matches previewGeneratedChannelWireName for the same channel and build settings', () => {
    const channel = dmrChannel('Glasgow Scotland West Repeater');
    const build = newFormatBuild(PROJECT_ID, 'anytone-at-d890uv');
    const preview = previewGeneratedChannelWireName(channel, build);
    const exportName = anytoneChannelWireName(
      { entity: channel, wireName: 'unused' },
      { reserved: new Set() },
      { profileId: 'anytone-at-d890uv', shortenNames: true },
    );

    expect(exportName).toBe(preview);
  });
});
