import { describe, expect, it } from 'vitest';
import type { Channel } from '@core/models/library.ts';
import { newChannel } from '@core/domain/factories.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import {
  classifyAnytoneExportChannelBank,
  isAmAirbandBankChannel,
  isFmBroadcastBankChannel,
  isReceiveOnlyChannel,
  partitionAnytoneChannels,
} from './receiveOnlyBanks.ts';

const PROJECT_ID = '11111111-1111-4111-8111-111111111111';

function assembled(channel: ReturnType<typeof newChannel>): AssembledChannel {
  return { entity: channel, wireName: channel.name };
}

function emptyAssembled(channels: AssembledChannel[]) {
  return {
    buildId: 'b1',
    formatId: 'anytone',
    profileId: 'anytone-at-d890uv',
    buildName: 'Test',
    channels,
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
  };
}

describe('receiveOnlyBanks', () => {
  it('isReceiveOnlyChannel is true when forbidTransmit or null TX', () => {
    expect(isReceiveOnlyChannel({ forbidTransmit: 'forbid', txFrequency: 434_000_000 })).toBe(true);
    expect(isReceiveOnlyChannel({ forbidTransmit: 'default', txFrequency: null })).toBe(true);
    expect(isReceiveOnlyChannel({ forbidTransmit: 'default', txFrequency: 434_000_000 })).toBe(false);
  });

  it('classifies AM airband vs ham FM vs DMR', () => {
    const airband: Channel = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast: Channel = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('fm')],
    };
    const hamFm: Channel = {
      ...newChannel(PROJECT_ID, '2m FM'),
      rxFrequency: 145_500_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr: Channel = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: 'default',
      modeProfiles: [defaultModeProfile('dmr')],
    };

    expect(isAmAirbandBankChannel(airband)).toBe(true);
    expect(isFmBroadcastBankChannel(broadcast)).toBe(true);
    expect(isFmBroadcastBankChannel(hamFm)).toBe(false);
    expect(isAmAirbandBankChannel(dmr)).toBe(false);
    expect(isFmBroadcastBankChannel(dmr)).toBe(false);
  });

  it('partitionAnytoneChannels routes channels to correct banks', () => {
    const airband: Channel = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast: Channel = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr: Channel = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: 'default',
      modeProfiles: [defaultModeProfile('dmr')],
    };

    const partition = partitionAnytoneChannels(
      emptyAssembled([assembled(airband), assembled(broadcast), assembled(dmr)]),
    );

    expect(partition.amAirChannels).toHaveLength(1);
    expect(partition.fmBroadcastChannels).toHaveLength(1);
    expect(partition.dmrChannels).toHaveLength(1);
  });

  it('classifyAnytoneExportChannelBank mirrors partition', () => {
    const airband: Channel = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast: Channel = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: 'forbid',
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr: Channel = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: 'default',
      modeProfiles: [defaultModeProfile('dmr')],
    };

    expect(classifyAnytoneExportChannelBank(airband)).toBe('amAir');
    expect(classifyAnytoneExportChannelBank(broadcast)).toBe('fmBroadcast');
    expect(classifyAnytoneExportChannelBank(dmr)).toBe('dmr');
  });
});
