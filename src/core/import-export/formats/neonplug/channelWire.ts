import { effectiveForbidTransmit } from '@core/import-export/channelBehaviourDefaults/index.ts';
import type { ChannelBehaviourContext } from '@core/import-export/channelBehaviourDefaults/resolve.ts';
import {
  buildScanContext,
  resolveEffectiveScanInclusion,
  type ScanInclusionContext,
} from '@core/import-export/scanInclusion/resolve.ts';
import type { CpsExportOptions } from '@core/import-export/types.ts';
import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type { ChannelMode, ChannelTone, DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import { percentToWire } from '../../profileLadder.ts';
import {
  getNeonplugProfile,
  isNeonplugDm32uvProfile,
  neonplugPercentToWire,
  type NeonplugRadioProfile,
} from './profiles.ts';
import type {
  NeonplugAprsReportMode,
  NeonplugBandwidth,
  NeonplugChannel,
  NeonplugChannelMode,
  NeonplugCtcssDcs,
  NeonplugPowerLevel,
  NeonplugRxSquelchMode,
} from './wireTypes.ts';

const ANALOG_MODES = new Set<ChannelMode>(['fm', 'am', 'ssb']);

function isAnalogMode(mode: ChannelMode): boolean {
  return ANALOG_MODES.has(mode);
}

function isDmrMode(mode: ChannelMode): boolean {
  return mode === 'dmr';
}

function isAnalogProfile(profile: ChannelModeProfile): profile is ChannelModeProfileAnalog {
  return isAnalogMode(profile.mode);
}

function isDmrProfile(profile: ChannelModeProfile): profile is ChannelModeProfileDMR {
  return profile.mode === 'dmr';
}

/** Hz → MHz number for NeonPlug JSON (e.g. `145.35`). */
export function formatNeonplugFrequencyMhz(hz: number | null): number {
  if (hz == null || !Number.isFinite(hz) || hz <= 0) return 0;
  return Math.round((hz / 1_000_000) * 1_000_000) / 1_000_000;
}

/** Studio ladder wire `Middle` → NeonPlug enum `Medium`. */
export function formatNeonplugPower(percent: number | null, profileId: string): NeonplugPowerLevel {
  const wire = neonplugPercentToWire(profileId, percent);
  if (wire === 'Middle') return 'Medium';
  if (wire === 'Low') return 'Low';
  return 'High';
}

export function formatNeonplugBandwidth(khz: number | null): NeonplugBandwidth {
  if (khz != null && Math.abs(khz - 25) < 0.01) return '25kHz';
  return '12.5kHz';
}

/** Studio tone (`none` | `88.5` | `D023N`) → NeonPlug CTCSS/DCS object. */
export function formatNeonplugTone(tone: ChannelTone): NeonplugCtcssDcs {
  if (tone === 'none' || !tone.trim()) return { type: 'None' };
  const trimmed = tone.trim();
  const dcs = /^D(\d{1,3})([NP]?)$/i.exec(trimmed);
  if (dcs) {
    const value = Number.parseInt(dcs[1]!, 10);
    const polarity = (dcs[2]?.toUpperCase() || 'N') as 'N' | 'P';
    return { type: 'DCS', value, polarity };
  }
  const hz = Number.parseFloat(trimmed);
  if (Number.isFinite(hz) && hz > 0) {
    return { type: 'CTCSS', value: hz };
  }
  return { type: 'None' };
}

/** NeonPlug storage: 0 = TS1, 1 = TS2. */
export function formatNeonplugSlotOperation(timeslot: DMRTimeSlot | null): number {
  return timeslot === 2 ? 1 : 0;
}

export function formatNeonplugChannelMode(
  mode: ChannelMode,
  multiMode: boolean,
  modeProfiles: ChannelModeProfile[],
): NeonplugChannelMode {
  if (!multiMode || modeProfiles.length < 2) {
    if (isDmrMode(mode)) return 'Digital';
    return 'Analog';
  }
  const hasFm = modeProfiles.some((p) => isAnalogMode(p.mode));
  const hasDmr = modeProfiles.some((p) => isDmrMode(p.mode));
  if (hasFm && hasDmr) {
    return isDmrMode(mode) ? 'Fixed Digital' : 'Fixed Analog';
  }
  if (isDmrMode(mode)) return 'Digital';
  return 'Analog';
}

function formatNeonplugSquelchLevel(
  percent: number | null,
  profile: NeonplugRadioProfile,
  isAnalog: boolean,
): number {
  if (!isAnalog) return 0;
  if (isNeonplugDm32uvProfile(profile)) {
    if (percent == null) return 1;
    const wire = percentToWire({ powerLadder: profile.squelchLadder }, percent);
    const level = Number.parseInt(wire, 10);
    return Number.isFinite(level) ? level : 1;
  }
  if (percent == null) return 1;
  return Math.max(0, Math.min(9, Math.round((percent * 9) / 100)));
}

function formatNeonplugRxSquelchMode(): NeonplugRxSquelchMode {
  // NeonPlug has no plain "Carrier" wire; Carrier/CTC matches live NeonPlug exports.
  return 'Carrier/CTC';
}

function formatNeonplugAprsReportMode(channel: Channel): NeonplugAprsReportMode {
  return channel.aprs?.reportType === 'digital' ? 'Digital' : 'Off';
}

function pickPrimaryMode(channel: Channel): ChannelMode {
  if (channel.primaryMode) return channel.primaryMode;
  const first = channel.modeProfiles[0];
  return first?.mode ?? 'fm';
}

export interface NeonplugChannelWireOptions {
  number: number;
  name: string;
  profileId: string;
  /** Override scan inclusion context (build + format defaults). */
  scanContext?: ScanInclusionContext;
  behaviourContext?: ChannelBehaviourContext;
  /** Talk-group / contact book index (`0` = none). */
  contactId?: number;
  rxGroupListId?: number;
  scanListId?: number;
}

/** DMR profile `contactRef` when present (primary DMR mode profile). */
export function dmrContactRefFromChannel(channel: Channel): EntityRef | null {
  const dmr = channel.modeProfiles.find(isDmrProfile);
  return dmr?.contactRef ?? null;
}

/** DMR profile `rxGroupListId` UUID when present. */
export function dmrRxGroupListIdFromChannel(channel: Channel): string | null {
  const dmr = channel.modeProfiles.find(isDmrProfile);
  return dmr?.rxGroupListId ?? null;
}

/** Map a Studio library channel → NeonPlug Channel wire object. */
export function channelToNeonplugChannel(
  channel: Channel,
  options: NeonplugChannelWireOptions,
): NeonplugChannel {
  const profile = getNeonplugProfile(options.profileId);
  const profiles =
    channel.modeProfiles.length > 0
      ? channel.modeProfiles
      : [
          {
            mode: 'fm' as const,
            squelch: null,
            rxTone: 'none' as const,
            txTone: 'none' as const,
            bandwidthKHz: 12.5,
          },
        ];

  const primaryMode = pickPrimaryMode(channel);
  const multiMode = profiles.length > 1;
  const wireMode = formatNeonplugChannelMode(primaryMode, multiMode, profiles);
  const isDigital = wireMode === 'Digital' || wireMode === 'Fixed Digital';

  const fmProfile = profiles.find(isAnalogProfile);
  const dmrProfile = profiles.find(isDmrProfile);
  const activeAnalog = isDigital ? fmProfile : (profiles.find(isAnalogProfile) ?? fmProfile);
  const activeDmr = isDigital ? (profiles.find(isDmrProfile) ?? dmrProfile) : dmrProfile;

  const scanContext =
    options.scanContext ?? buildScanContext(undefined, { defaultScanInclusion: 'scan' });
  const scanAdd = resolveEffectiveScanInclusion(channel, scanContext) === 'scan';

  const base: NeonplugChannel = {
    number: options.number,
    name: options.name,
    rxFrequency: formatNeonplugFrequencyMhz(channel.rxFrequency),
    txFrequency: formatNeonplugFrequencyMhz(channel.txFrequency),
    mode: wireMode,
    forbidTx: effectiveForbidTransmit(channel, options.behaviourContext),
    loneWorker: false,
    bandwidth: formatNeonplugBandwidth(activeAnalog?.bandwidthKHz ?? null),
    scanAdd,
    scanListId: options.scanListId ?? 0,
    forbidTalkaround: false,
    unknown1A_6_4: isDigital ? 1 : 0,
    unknown1A_3: false,
    aprsReceive: channel.aprs?.receiveEnabled === true,
    emergencyIndicator: false,
    emergencyAck: false,
    emergencySystemId: 0,
    digitalEmergencySystemId: 0,
    power: formatNeonplugPower(channel.power, options.profileId),
    aprsReportMode: formatNeonplugAprsReportMode(channel),
    unknown1C_1_0: 0,
    voxFunction: false,
    scramble: false,
    compander: false,
    talkback: false,
    unknown1D_3_0: 0,
    squelchLevel: formatNeonplugSquelchLevel(activeAnalog?.squelch ?? null, profile, !isDigital),
    pttIdDisplay: false,
    pttId: 0,
    colorCode: activeDmr?.colourCode ?? 0,
    rxCtcssDcs: formatNeonplugTone(activeAnalog?.rxTone ?? 'none'),
    txCtcssDcs: formatNeonplugTone(activeAnalog?.txTone ?? 'none'),
    unknown25_7_6: 0,
    companderDup: false,
    voxRelated: false,
    unknown25_3_0: 0,
    pttIdDisplay2: false,
    rxSquelchMode: formatNeonplugRxSquelchMode(),
    unknown26_3_1: 0,
    unknown26_0: false,
    stepFrequency: 0,
    signalingType: 'None',
    pttIdType: 'Off',
    unknown29_3_2: 0,
    unknown29_1_0: 0,
    unknown2A: 0,
    dmrRadioIdIndex: 0,
    contactId: options.contactId ?? 0,
  };

  if (isDigital) {
    base.rxGroupListId = options.rxGroupListId ?? 0;
    base.slotOperation = formatNeonplugSlotOperation(activeDmr?.timeslot ?? null);
    base.encryption = false;
    base.encryptionId = 0;
    base.tdmaDirectMode = false;
    base.shortDataConfirm = false;
    base.privateConfirm = false;
  }

  return base;
}

/** Convenience: build scan + behaviour contexts from CPS export options. */
export function neonplugContextsFromExportOptions(options?: CpsExportOptions): {
  scanContext: ScanInclusionContext;
  behaviourContext: ChannelBehaviourContext | undefined;
} {
  return {
    scanContext: buildScanContext(
      options?.defaultScanInclusion != null
        ? { defaultScanInclusion: options.defaultScanInclusion }
        : undefined,
      { defaultScanInclusion: 'scan' },
    ),
    behaviourContext: options?.channelBehaviourContext,
  };
}
