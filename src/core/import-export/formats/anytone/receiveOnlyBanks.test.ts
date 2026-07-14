import { describe, expect, it } from 'vitest';
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
    expect(isReceiveOnlyChannel({ forbidTransmit: true, txFrequency: 434_000_000 })).toBe(true);
    expect(isReceiveOnlyChannel({ forbidTransmit: false, txFrequency: null })).toBe(true);
    expect(isReceiveOnlyChannel({ forbidTransmit: false, txFrequency: 434_000_000 })).toBe(false);
  });

  it('classifies AM airband vs ham FM vs DMR', () => {
    const airband = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const hamFm = {
      ...newChannel(PROJECT_ID, '2m FM'),
      rxFrequency: 145_500_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: false,
      modeProfiles: [defaultModeProfile('dmr')],
    };

    expect(isAmAirbandBankChannel(airband)).toBe(true);
    expect(isFmBroadcastBankChannel(broadcast)).toBe(true);
    expect(isFmBroadcastBankChannel(hamFm)).toBe(false);
    expect(isAmAirbandBankChannel(dmr)).toBe(false);
    expect(isFmBroadcastBankChannel(dmr)).toBe(false);
  });

  it('partitionAnytoneChannels routes channels to correct banks', () => {
    const airband = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: false,
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
    const airband = {
      ...newChannel(PROJECT_ID, 'GLA Tower'),
      rxFrequency: 118_800_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('am')],
    };
    const broadcast = {
      ...newChannel(PROJECT_ID, 'FM station 1'),
      rxFrequency: 99_500_000,
      txFrequency: null,
      forbidTransmit: true,
      modeProfiles: [defaultModeProfile('fm')],
    };
    const dmr = {
      ...newChannel(PROJECT_ID, 'DMR'),
      rxFrequency: 438_800_000,
      txFrequency: 434_000_000,
      forbidTransmit: false,
      modeProfiles: [defaultModeProfile('dmr')],
    };

    expect(classifyAnytoneExportChannelBank(airband)).toBe('amAir');
    expect(classifyAnytoneExportChannelBank(broadcast)).toBe('fmBroadcast');
    expect(classifyAnytoneExportChannelBank(dmr)).toBe('dmr');
  });
});
