import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import { CHANNEL_COL } from './columns.ts';
import { isAnalogMode, isDmrMode } from './channelModes.ts';
import {
  formatDm32BandwidthWire,
  formatDm32ChannelTypeWire,
  formatDm32FlagWire,
  formatDm32FrequencyWire,
  formatDm32PowerWire,
  formatDm32SquelchWire,
  formatDm32TimeslotWire,
  formatDm32ToneWire,
  formatDm32TxAdmitWire,
} from './wireFormat.ts';
import { dm32ContactRefWireName, dm32RxGroupListWireName } from './exportRefs.ts';
import type { ExpandedDm32ChannelRow } from './channelExpansion.ts';
import { DEFAULT_DM32_PROFILE_ID, getDm32Profile } from './profiles.ts';
import type { Dm32TalkGroupWireNameMap } from './talkGroupWire.ts';

function isAnalogProfile(profile: ChannelModeProfile): profile is ChannelModeProfileAnalog {
  return isAnalogMode(profile.mode);
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

export function serialiseDm32ChannelRow(
  row: ExpandedDm32ChannelRow,
  sourceChannel: Channel,
  assembled: AssembledBuild,
  profileId: string,
  rowNumber: number,
  talkGroupWireNames: Dm32TalkGroupWireNameMap,
  _options?: CpsExportOptions,
  scanListWire = 'None',
): Record<string, string> {
  const profile = getDm32Profile(profileId);
  const profiles =
    sourceChannel.modeProfiles.length > 0
      ? sourceChannel.modeProfiles
      : [
          {
            mode: 'fm' as const,
            squelch: null,
            rxTone: 'none' as const,
            txTone: 'none' as const,
            bandwidthKHz: null,
          },
        ];
  const fmProfile = profiles.find(isAnalogProfile);
  const dmrProfile = profiles.find(isDmrProfile);

  const nativeDual = profiles.length > 1 && row.key === row.sourceChannelId;

  const channelType = nativeDual
    ? formatDm32ChannelTypeWire(row.mode, true, profiles)
    : isDmrMode(row.mode)
      ? 'Digital'
      : 'Analog';

  const toneProfile = isAnalogProfile(row.modeProfile)
    ? row.modeProfile
    : nativeDual && fmProfile
      ? fmProfile
      : row.modeProfile;
  const dmrSource = isDmrProfile(row.modeProfile)
    ? row.modeProfile
    : nativeDual && dmrProfile
      ? dmrProfile
      : null;

  const analogTone = isAnalogProfile(toneProfile) ? toneProfile : fmProfile;
  const aprsChannel = isAnalogMode(row.mode) || nativeDual ? '256' : '1';

  return {
    [CHANNEL_COL.number]: String(rowNumber),
    [CHANNEL_COL.name]: row.wireName,
    [CHANNEL_COL.type]: channelType,
    [CHANNEL_COL.rx]: formatDm32FrequencyWire(sourceChannel.rxFrequency),
    [CHANNEL_COL.tx]: formatDm32FrequencyWire(sourceChannel.txFrequency),
    [CHANNEL_COL.power]: formatDm32PowerWire(sourceChannel.power, profileId),
    [CHANNEL_COL.bandwidth]: formatDm32BandwidthWire(
      isAnalogProfile(toneProfile) ? toneProfile.bandwidthKHz : (fmProfile?.bandwidthKHz ?? null),
    ),
    [CHANNEL_COL.scanList]: scanListWire,
    [CHANNEL_COL.txAdmit]: formatDm32TxAdmitWire(),
    [CHANNEL_COL.emergencySystem]: 'None',
    [CHANNEL_COL.squelch]: formatDm32SquelchWire(
      isAnalogProfile(toneProfile) ? toneProfile.squelch : (fmProfile?.squelch ?? null),
      profileId,
      { isAnalog: isAnalogMode(row.mode) },
    ),
    [CHANNEL_COL.aprsReportType]: 'Off',
    [CHANNEL_COL.forbidTx]: formatDm32FlagWire(sourceChannel.forbidTransmit),
    [CHANNEL_COL.aprsReceive]: '0',
    [CHANNEL_COL.forbidTalkaround]: '0',
    [CHANNEL_COL.autoScan]: '0',
    [CHANNEL_COL.loneWork]: '0',
    [CHANNEL_COL.emergencyIndicator]: '0',
    [CHANNEL_COL.emergencyAck]: '0',
    [CHANNEL_COL.analogAprsPtt]: '0',
    [CHANNEL_COL.digitalAprsPtt]: '0',
    [CHANNEL_COL.txContact]: dm32ContactRefWireName(
      assembled,
      row.txContactRef,
      row.mode,
      talkGroupWireNames,
    ),
    [CHANNEL_COL.rxGroupList]: dm32RxGroupListWireName(assembled, row.rxGroupListId, row.mode),
    [CHANNEL_COL.colourCode]: String(dmrSource?.colourCode ?? 0),
    [CHANNEL_COL.timeslot]: formatDm32TimeslotWire(dmrSource?.timeslot ?? null),
    [CHANNEL_COL.encryption]: '0',
    [CHANNEL_COL.encryptionId]: 'None',
    [CHANNEL_COL.aprsReportChannel]: aprsChannel,
    [CHANNEL_COL.directDualMode]: '0',
    [CHANNEL_COL.privateConfirm]: '0',
    [CHANNEL_COL.shortDataConfirm]: '0',
    [CHANNEL_COL.dmrIdLabel]: profile.defaultDmrIdLabel,
    [CHANNEL_COL.rxTone]: formatDm32ToneWire(analogTone?.rxTone ?? 'none'),
    [CHANNEL_COL.txTone]: formatDm32ToneWire(analogTone?.txTone ?? 'none'),
    [CHANNEL_COL.scramble]: 'None',
    [CHANNEL_COL.rxSquelchMode]: 'Carrier/CTC',
    [CHANNEL_COL.signalingType]: 'None',
    [CHANNEL_COL.pttId]: 'OFF',
    [CHANNEL_COL.vox]: '0',
    [CHANNEL_COL.pttIdDisplay]: '0',
  };
}

export { DEFAULT_DM32_PROFILE_ID };
