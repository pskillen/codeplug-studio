import { describe, expect, it } from 'vitest';
import type { ChannelModeProfileAnalog, ChannelModeProfileDMR } from '../../models/library.ts';
import { generateChannelsFromGroups } from './generate.ts';
import type { PublicServiceCountry, PublicServiceEntry, PublicServiceGroup } from './types.ts';

const PROJECT_ID = 'proj-1';

function entry(partial: Partial<PublicServiceEntry> & Pick<PublicServiceEntry, 'channelId' | 'name'>): PublicServiceEntry {
  return {
    label: partial.label ?? partial.name,
    rxFrequencyHz: 449_012_500,
    txFrequencyHz: 449_012_500,
    modes: [{ mode: 'fm', isPrimary: true, bandwidthKHz: 12.5 }],
    status: 'active',
    confidence: 'high',
    source: { type: 'official', url: 'https://example.org/a', title: 'Plan' },
    ...partial,
  };
}

function country(groups: PublicServiceGroup[]): PublicServiceCountry {
  return {
    countryCode: 'ZZ',
    countryLabel: 'Exampleland',
    datasetVersion: 'test',
    groups,
    knownGaps: [],
  };
}

function group(
  groupId: string,
  entries: PublicServiceEntry[],
  extra: Partial<PublicServiceGroup> = {},
): PublicServiceGroup {
  return {
    groupId,
    label: extra.label ?? 'Test group',
    category: extra.category ?? 'fire',
    serviceOrg: extra.serviceOrg,
    region: extra.region,
    entries,
  };
}

describe('generateChannelsFromGroups', () => {
  it('emits an FM-only simplex channel with transmit forbidden', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({
            channelId: 'fg-1',
            name: 'NFRS FG1',
            label: 'Northshire Fireground 1',
            modes: [{ mode: 'fm', isPrimary: true, bandwidthKHz: 12.5, rxTone: '77.0' }],
          }),
        ], { serviceOrg: 'Northshire FRS' }),
      ]),
      ['zz-fire'],
    );

    expect(channels).toHaveLength(1);
    const ch = channels[0]!;
    expect(ch.forbidTransmit).toBe('forbid');
    expect(ch.txPermit).toBe('default');
    expect(ch.power).toBeNull();
    expect(ch.scanInclusion).toBe('default');
    expect(ch.rxFrequency).toBe(449_012_500);
    expect(ch.txFrequency).toBe(449_012_500);
    expect(ch.primaryMode).toBe('fm');
    expect(ch.comment).toBe('Northshire FRS — Northshire Fireground 1');
    const profile = ch.modeProfiles[0] as ChannelModeProfileAnalog;
    expect(profile.mode).toBe('fm');
    expect(profile.bandwidthKHz).toBe(12.5);
    expect(profile.rxTone).toBe('77.0');
  });

  it('emits a DMR-only channel with documented colour code and timeslot', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({
            channelId: 'fg-2',
            name: 'NFRS FG2',
            modes: [{ mode: 'dmr', isPrimary: true, colourCode: 1, timeslot: 1 }],
          }),
        ]),
      ]),
      ['zz-fire'],
    );

    const profile = channels[0]?.modeProfiles[0] as ChannelModeProfileDMR;
    expect(profile.mode).toBe('dmr');
    expect(profile.colourCode).toBe(1);
    expect(profile.timeslot).toBe(1);
    expect(profile.contactRef).toBeNull();
    expect(channels[0]?.primaryMode).toBe('dmr');
  });

  it('emits one dual-mode channel with a fresh profile array and explicit primaryMode', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({
            channelId: 'fg-1',
            name: 'NFRS FG1',
            modes: [
              { mode: 'fm', isPrimary: false, bandwidthKHz: 12.5 },
              { mode: 'dmr', isPrimary: true, colourCode: 1 },
            ],
          }),
        ]),
      ]),
      ['zz-fire'],
    );

    expect(channels).toHaveLength(1);
    expect(channels[0]?.modeProfiles).toHaveLength(2);
    expect(channels[0]?.primaryMode).toBe('dmr');
    expect(channels[0]?.modeProfiles.map((p) => p.mode)).toEqual(['fm', 'dmr']);
  });

  it('does not share the mode-profile array across generated channels', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({ channelId: 'fg-1', name: 'NFRS FG1' }),
          entry({
            channelId: 'fg-2',
            name: 'NFRS FG2',
            rxFrequencyHz: 449_037_500,
            txFrequencyHz: 449_037_500,
          }),
        ]),
      ]),
      ['zz-fire'],
    );

    expect(channels).toHaveLength(2);
    expect(channels[0]?.modeProfiles).not.toBe(channels[1]?.modeProfiles);
    (channels[0]!.modeProfiles[0] as ChannelModeProfileAnalog).bandwidthKHz = 25;
    expect((channels[1]!.modeProfiles[0] as ChannelModeProfileAnalog).bandwidthKHz).toBe(12.5);
  });

  it('records both legs of a duplex pair', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({
            channelId: 'fg-2',
            name: 'NFRS FG2',
            rxFrequencyHz: 457_087_500,
            txFrequencyHz: 462_587_500,
          }),
        ]),
      ]),
      ['zz-fire'],
    );

    expect(channels[0]?.rxFrequency).toBe(457_087_500);
    expect(channels[0]?.txFrequency).toBe(462_587_500);
  });

  it('skips historic entries and unselected groups', () => {
    const channels = generateChannelsFromGroups(
      PROJECT_ID,
      country([
        group('zz-fire', [
          entry({ channelId: 'fg-1', name: 'NFRS FG1' }),
          entry({ channelId: 'fg-old', name: 'NFRS OLD', status: 'historic' }),
        ]),
        group('zz-marine', [entry({ channelId: 'ch-16', name: 'CG Ch16' })], {
          category: 'maritime',
          label: 'Coastguard',
        }),
      ]),
      ['zz-fire'],
    );

    expect(channels.map((ch) => ch.name)).toEqual(['NFRS FG1']);
  });
});
