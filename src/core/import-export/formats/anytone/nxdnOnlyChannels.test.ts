import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { ExportWarning } from '@core/import-export/exportWarning.ts';
import { dropNxdnOnlyChannels, isNxdnOnlyChannel } from './nxdnOnlyChannels.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

const NXDN: ChannelModeProfile = {
  mode: 'nxdn',
  rxRan: 1,
  txRan: 1,
  unitId: null,
  contactRef: null,
  rxGroupListId: null,
  nxdnRate: null,
};
const DMR: ChannelModeProfile = {
  mode: 'dmr',
  dmrMode: null,
  colourCode: 1,
  timeslot: 1,
  dmrId: null,
  contactRef: null,
  rxGroupListId: null,
  sendTalkerAlias: 'default',
};
const FM: ChannelModeProfile = {
  mode: 'fm',
  rxTone: 'none',
  txTone: 'none',
  squelch: null,
  bandwidthKHz: 12.5,
  analogSquelchMode: 'default',
};

function channel(name: string, profiles: ChannelModeProfile[]): Channel {
  const ch = newChannel(projectId, name);
  ch.rxFrequency = 446_000_000;
  ch.modeProfiles = profiles;
  return ch;
}

function assembledOf(channels: Channel[]): AssembledBuild {
  return {
    channels: channels.map((entity) => ({ entity, wireName: entity.name })),
    zones: [],
  } as unknown as AssembledBuild;
}

describe('dropNxdnOnlyChannels', () => {
  it('classifies only channels with an NXDN profile and no FM, AM or DMR profile', () => {
    expect(isNxdnOnlyChannel(channel('a', [NXDN]))).toBe(true);
    expect(isNxdnOnlyChannel(channel('b', [DMR, NXDN]))).toBe(false);
    expect(isNxdnOnlyChannel(channel('c', [FM, NXDN]))).toBe(false);
    expect(isNxdnOnlyChannel(channel('d', [DMR]))).toBe(false);
  });

  it('drops NXDN-only channels with one warning and keeps mixed ones', () => {
    const warnings: ExportWarning[] = [];
    const out = dropNxdnOnlyChannels(
      assembledOf([channel('a', [NXDN]), channel('b', [DMR, NXDN]), channel('c', [NXDN])]),
      warnings,
    );
    expect(out.channels.map((row) => row.entity.name)).toEqual(['b']);
    expect(warnings).toHaveLength(1);
    expect(JSON.stringify(warnings[0])).toContain('2 NXDN-only channel(s)');
  });

  it('returns the same object when nothing is dropped', () => {
    const assembled = assembledOf([channel('b', [DMR, NXDN])]);
    const warnings: ExportWarning[] = [];
    expect(dropNxdnOnlyChannels(assembled, warnings)).toBe(assembled);
    expect(warnings).toEqual([]);
  });

  it('stays silent when the caller reports the skip itself', () => {
    const out = dropNxdnOnlyChannels(assembledOf([channel('a', [NXDN])]));
    expect(out.channels).toEqual([]);
  });
});
