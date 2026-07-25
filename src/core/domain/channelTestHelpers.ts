import type { Channel, ChannelModeProfileAnalog } from '@core/models/library.ts';

const DEFAULT_FM_PROFILE: ChannelModeProfileAnalog = {
  mode: 'fm',
  rxTone: 'none',
  txTone: 'none',
  squelch: null,
  bandwidthKHz: 12.5,
  analogSquelchMode: 'default',
};

/** Test helper — FM profile + in-band VHF RX when missing (export eligibility). */
export function withExportEligibleDefaults(channel: Channel, rxMhz = 145.5): Channel {
  const rxHz = Math.round(rxMhz * 1_000_000);
  return {
    ...channel,
    rxFrequency: channel.rxFrequency ?? rxHz,
    txFrequency: channel.txFrequency ?? rxHz,
    modeProfiles:
      channel.modeProfiles.length > 0 ? channel.modeProfiles : [{ ...DEFAULT_FM_PROFILE }],
  };
}
