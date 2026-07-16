import { newChannel } from '../factories.ts';
import { defaultModeProfile } from '../modeProfiles.ts';
import type { Channel } from '../../models/library.ts';
import type { ChannelModeProfileAnalog } from '../../models/library.ts';
import { channelSetDefinition } from './definitions.ts';
import type { ChannelSetGenerateOptions, ChannelSetId } from './types.ts';

function applyNamePrefix(name: string, prefix: string | undefined): string {
  const trimmed = prefix?.trim() ?? '';
  if (!trimmed) return name;
  return `${trimmed}${name}`;
}

function fmNfmProfile(bandwidthKHz: number): ChannelModeProfileAnalog {
  const base = defaultModeProfile('fm') as ChannelModeProfileAnalog;
  return { ...base, bandwidthKHz };
}

export function generateChannelsFromSet(
  projectId: string,
  setId: ChannelSetId,
  options: ChannelSetGenerateOptions = {},
): Channel[] {
  const def = channelSetDefinition(setId);
  const forbidTransmitOverride = (options.forbidTransmit ?? def.defaultForbidTransmit)
    ? 'forbid'
    : 'default';
  const power = options.power !== undefined ? options.power : null;
  const bandwidthKHz = options.bandwidthKHz ?? def.defaultBandwidthKHz;
  const modeProfiles = [fmNfmProfile(bandwidthKHz)];

  return def.templates().map((template) => {
    const name = applyNamePrefix(template.name, options.namePrefix);
    const base = newChannel(projectId, name);
    return {
      ...base,
      rxFrequency: template.rxFrequencyHz,
      txFrequency: template.txFrequencyHz,
      power,
      forbidTransmit: forbidTransmitOverride,
      modeProfiles,
    };
  });
}
