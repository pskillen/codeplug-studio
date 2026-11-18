import { newChannel } from '@core/domain/factories.ts';
import { defaultModeProfile, isAnalogChannelModeProfile } from '@core/domain/modeProfiles.ts';
import { formatCtcssHz, formatDcsChannelTone } from '@core/domain/tones.ts';
import type { Channel, ChannelModeProfileAnalog } from '@core/models/library.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import type { MappedReadChannel, ReadChannelInput, ReadTone } from './types.ts';

export function readToneToChannelTone(tone: ReadTone): ChannelTone {
  switch (tone.kind) {
    case 'none':
      return 'none';
    case 'ctcss':
      return formatCtcssHz(tone.hz);
    case 'dcs':
      return formatDcsChannelTone(tone.code, tone.polarity ?? 'N');
  }
}

export function mapReadChannel(input: ReadChannelInput): MappedReadChannel | null {
  if (input.empty || input.rxHz <= 0) return null;
  return {
    slot: input.slotIndex,
    name: input.wireName.trim() || `Channel ${input.slotIndex}`,
    fields: {
      rxFrequency: input.rxHz,
      txFrequency: input.txHz > 0 ? input.txHz : input.rxHz,
      power: input.powerPercent,
      ...(input.scanAdd === undefined
        ? {}
        : { scanInclusion: input.scanAdd ? 'alwaysScan' : 'skip' }),
      forbidTransmit: input.rxOnly === true ? 'forbid' : 'allow',
      mode: input.analogMode ?? 'fm',
      analog: {
        rxTone: readToneToChannelTone(input.rxTone),
        txTone: readToneToChannelTone(input.txTone),
        bandwidthKHz: input.bandwidth === 'NFM' ? 12.5 : 25,
      },
    },
  };
}

export function mapReadChannels(inputs: readonly ReadChannelInput[]): MappedReadChannel[] {
  return inputs.flatMap((input) => {
    const mapped = mapReadChannel(input);
    return mapped === null ? [] : [mapped];
  });
}

function analogProfile(mapped: MappedReadChannel): ChannelModeProfileAnalog {
  return {
    ...defaultModeProfile(mapped.fields.mode),
    ...mapped.fields.analog,
  } as ChannelModeProfileAnalog;
}

export function channelFromMappedRead(projectId: string, mapped: MappedReadChannel): Channel {
  const { fields } = mapped;
  return {
    ...newChannel(projectId, mapped.name),
    rxFrequency: fields.rxFrequency,
    txFrequency: fields.txFrequency,
    power: fields.power,
    scanInclusion: fields.scanInclusion ?? 'default',
    forbidTransmit: fields.forbidTransmit,
    primaryMode: fields.mode,
    modeProfiles: [analogProfile(mapped)],
  };
}

export function applyMappedReadToChannel(channel: Channel, mapped: MappedReadChannel): Channel {
  const { fields } = mapped;
  const existing = channel.modeProfiles.find(
    (profile): profile is ChannelModeProfileAnalog =>
      isAnalogChannelModeProfile(profile) && profile.mode === fields.mode,
  );
  const changedProfile =
    !existing ||
    existing.rxTone !== fields.analog.rxTone ||
    existing.txTone !== fields.analog.txTone ||
    existing.bandwidthKHz !== fields.analog.bandwidthKHz;
  const scanInclusion = fields.scanInclusion ?? channel.scanInclusion;
  if (
    !changedProfile &&
    scanInclusion === channel.scanInclusion &&
    fields.forbidTransmit === channel.forbidTransmit
  )
    return channel;
  const modeProfiles = !changedProfile
    ? channel.modeProfiles
    : existing
      ? channel.modeProfiles.map((profile) =>
          profile === existing ? { ...existing, ...fields.analog } : profile,
        )
      : [...channel.modeProfiles, analogProfile(mapped)];
  return {
    ...channel,
    scanInclusion,
    forbidTransmit: fields.forbidTransmit,
    modeProfiles,
    primaryMode:
      channel.modeProfiles.length === 0 && channel.primaryMode == null
        ? fields.mode
        : channel.primaryMode,
  };
}
