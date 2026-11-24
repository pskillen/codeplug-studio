import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelModeProfileNxdn,
  OwnDigitalId,
} from '../models/library.ts';
import { DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES } from '../models/channelBehaviourDefaults.ts';
import type {
  AnalogChannelMode,
  ChannelMode,
  ChannelTone,
  SsbSideband,
} from '../models/libraryTypes.ts';
import { normalizeDmrModeProfile } from './dmrOperatingMode.ts';
import { channelOwnIdOverride } from './ownDigitalIds.ts';

const ANALOG_MODES = new Set<AnalogChannelMode>(['fm', 'am', 'ssb']);

const LEGACY_SSB_MODE_TO_SIDEBAND: Record<string, SsbSideband> = {
  'ssb-usb': 'usb',
  'ssb-lsb': 'lsb',
};

export function isAnalogChannelMode(mode: ChannelMode): mode is AnalogChannelMode {
  return ANALOG_MODES.has(mode as AnalogChannelMode);
}

function legacySsbSideband(mode: string): SsbSideband | null {
  return LEGACY_SSB_MODE_TO_SIDEBAND[mode] ?? null;
}

function defaultAnalogProfile(
  mode: AnalogChannelMode,
  tone: ChannelTone = 'none',
  ssbSideband: SsbSideband = 'usb',
): ChannelModeProfileAnalog {
  return {
    mode,
    squelch: null,
    rxTone: tone,
    txTone: tone,
    bandwidthKHz: null,
    analogSquelchMode: DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES.analogSquelchMode,
    ...(mode === 'ssb' ? { ssbSideband } : {}),
  };
}

function defaultDmrProfile(): ChannelModeProfileDMR {
  return {
    mode: 'dmr',
    dmrMode: null,
    colourCode: null,
    timeslot: null,
    ownDigitalIdId: null,
    contactRef: null,
    rxGroupListId: null,
    sendTalkerAlias: DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES.sendTalkerAlias,
  };
}

/** Default profile shape for a mode — used when adding a profile in CRUD or upgrading stubs. */
export function defaultModeProfile(
  mode: ChannelMode,
  tone: ChannelTone = 'none',
): ChannelModeProfile {
  if (isAnalogChannelMode(mode)) {
    return defaultAnalogProfile(mode, tone);
  }
  switch (mode) {
    case 'dmr':
      return defaultDmrProfile();
    case 'dstar':
      return { mode: 'dstar', urCall: 'CQCQCQ', rpt1Call: '', rpt2Call: '' };
    case 'ysf':
      return { mode: 'ysf', dgId: null, wiresDtmfId: '' };
    case 'nxdn':
      return {
        mode: 'nxdn',
        rxRan: null,
        txRan: null,
        ownDigitalIdId: null,
        contactRef: null,
        rxGroupListId: null,
        nxdnRate: null,
      };
    case 'tetra':
      return {
        mode: 'tetra',
        mcc: null,
        mnc: null,
        gssi: null,
        colorCode: null,
        talkGroupRef: null,
      };
    case 'p25':
    case 'm17':
      return { mode };
    default: {
      const _exhaustive: never = mode;
      return _exhaustive;
    }
  }
}

/** True when the stored profile is a legacy mode-only stub (missing typed fields). */
export function isModeOnlyStub(profile: ChannelModeProfile): boolean {
  const keys = Object.keys(profile);
  return keys.length === 1 && keys[0] === 'mode';
}

function normalizeAnalogProfile(
  profile: ChannelModeProfileAnalog & { mode?: string },
): ChannelModeProfileAnalog {
  const legacySideband = legacySsbSideband(profile.mode ?? '');
  const mode: AnalogChannelMode =
    legacySideband != null ? 'ssb' : (profile.mode as AnalogChannelMode);
  const ssbSideband: SsbSideband =
    mode === 'ssb' ? (legacySideband ?? profile.ssbSideband ?? 'usb') : 'usb';

  return {
    mode,
    squelch: profile.squelch ?? null,
    rxTone: profile.rxTone ?? 'none',
    txTone: profile.txTone ?? 'none',
    bandwidthKHz: profile.bandwidthKHz ?? null,
    analogSquelchMode:
      profile.analogSquelchMode ?? DEFAULT_MODE_PROFILE_BEHAVIOUR_OVERRIDES.analogSquelchMode,
    ...(mode === 'ssb' ? { ssbSideband } : {}),
  };
}

/** Fill NXDN fields added after the first release; a legacy `talkGroupRef` becomes `contactRef`. */
function normalizeNxdnProfile(
  profile: ChannelModeProfileNxdn & { talkGroupRef?: ChannelModeProfileNxdn['contactRef'] },
): ChannelModeProfileNxdn {
  const { talkGroupRef, ...rest } = profile;
  return {
    ...rest,
    rxRan: rest.rxRan ?? null,
    txRan: rest.txRan ?? null,
    ownDigitalIdId: rest.ownDigitalIdId ?? null,
    contactRef: rest.contactRef ?? talkGroupRef ?? null,
    rxGroupListId: rest.rxGroupListId ?? null,
    nxdnRate: rest.nxdnRate ?? null,
  };
}

/** Upgrade legacy `{ mode }` stubs and partial analog profiles to full typed shapes. */
export function normalizeModeProfile(profile: ChannelModeProfile): ChannelModeProfile {
  const legacySideband = legacySsbSideband(profile.mode);
  if (isModeOnlyStub(profile)) {
    if (legacySideband != null) {
      return defaultAnalogProfile('ssb', 'none', legacySideband);
    }
    return defaultModeProfile(profile.mode);
  }
  if (
    profile.mode === 'fm' ||
    profile.mode === 'am' ||
    profile.mode === 'ssb' ||
    legacySideband != null
  ) {
    return normalizeAnalogProfile(profile as ChannelModeProfileAnalog);
  }
  if (profile.mode === 'dmr') {
    return normalizeDmrModeProfile(profile as ChannelModeProfileDMR);
  }
  if (profile.mode === 'nxdn') {
    return normalizeNxdnProfile(profile as ChannelModeProfileNxdn);
  }
  return profile;
}

/** Drop duplicate `ssb` profiles after legacy migration (keep first). */
export function dedupeSsbModeProfiles(profiles: ChannelModeProfile[]): ChannelModeProfile[] {
  let seenSsb = false;
  return profiles.filter((profile) => {
    if (profile.mode !== 'ssb') return true;
    if (seenSsb) return false;
    seenSsb = true;
    return true;
  });
}

/** Keep `primaryMode` aligned when mode selection changes in CRUD. */
export function reconcilePrimaryMode(
  primaryMode: ChannelMode | null,
  modeProfiles: ChannelModeProfile[],
): ChannelMode | null {
  if (modeProfiles.length === 0) return null;
  if (primaryMode != null && modeProfiles.some((profile) => profile.mode === primaryMode)) {
    return primaryMode;
  }
  return modeProfiles[0]?.mode ?? null;
}

/** Resolved primary for export — `primaryMode` when valid, else first profile. */
export function resolveChannelPrimaryMode(
  channel: Pick<Channel, 'primaryMode' | 'modeProfiles'>,
): ChannelMode | null {
  const modes = channel.modeProfiles.map((profile) => profile.mode);
  if (modes.length === 0) return null;
  if (channel.primaryMode != null && modes.includes(channel.primaryMode)) {
    return channel.primaryMode;
  }
  return modes[0] ?? null;
}

export function findModeProfile<M extends ChannelMode>(
  channel: Pick<Channel, 'modeProfiles'>,
  mode: M,
): Extract<ChannelModeProfile, { mode: M }> | undefined {
  return channel.modeProfiles.find(
    (p): p is Extract<ChannelModeProfile, { mode: M }> => p.mode === mode,
  );
}

export function findAnalogProfile(
  channel: Pick<Channel, 'modeProfiles'>,
): ChannelModeProfileAnalog | null {
  return channel.modeProfiles.find(isAnalogChannelModeProfile) ?? null;
}

export function findDmrProfile(
  channel: Pick<Channel, 'modeProfiles'>,
): ChannelModeProfileDMR | null {
  return findModeProfile(channel, 'dmr') ?? null;
}

export function isAnalogChannelModeProfile(
  profile: ChannelModeProfile,
): profile is ChannelModeProfileAnalog {
  return isAnalogChannelMode(profile.mode);
}

export function channelHasAnalogProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return channel.modeProfiles.some(isAnalogChannelModeProfile);
}

/**
 * First FM/AM mode profile — used by flat-memory analogue radios (CHIRP UV-5R,
 * NeonPlug UV5R-Mini). SSB and digital-only channels are not eligible.
 */
export function pickFmAmModeProfile(
  channel: Pick<Channel, 'modeProfiles'>,
): ChannelModeProfileAnalog | null {
  for (const profile of channel.modeProfiles) {
    if (profile.mode === 'fm' || profile.mode === 'am') {
      return profile;
    }
  }
  return null;
}

/** True when the channel has an FM or AM mode profile for flat-memory export. */
export function channelHasFmAmProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return pickFmAmModeProfile(channel) != null;
}

/** Patch every analog mode profile on a channel — does not add or remove profiles. */
export function patchAllAnalogProfiles(
  channel: Pick<Channel, 'modeProfiles'>,
  patch: Partial<ChannelModeProfileAnalog>,
): ChannelModeProfile[] {
  return channel.modeProfiles.map((profile) =>
    isAnalogChannelModeProfile(profile) ? { ...profile, ...patch } : profile,
  );
}

/** Patch every DMR mode profile on a channel — does not add or remove profiles. */
export function patchAllDmrProfiles(
  channel: Pick<Channel, 'modeProfiles'>,
  patch: Partial<ChannelModeProfileDMR>,
): ChannelModeProfile[] {
  return channel.modeProfiles.map((profile) =>
    profile.mode === 'dmr' ? { ...profile, ...patch } : profile,
  );
}

export function channelHasDmrProfile(channel: Pick<Channel, 'modeProfiles'>): boolean {
  return channel.modeProfiles.some((profile) => profile.mode === 'dmr');
}

/** Editor state for mode transitions; `parked` is never persisted on `Channel`. */
export interface ChannelModeEdit {
  modeProfiles: ChannelModeProfile[];
  primaryMode: ChannelMode | null;
  /** Profiles removed during this edit, restored if their mode comes back. Editor state only; never saved. */
  parked: ChannelModeProfile[];
}

function normalizeChannelModeEdit(edit: ChannelModeEdit): ChannelModeEdit {
  return {
    modeProfiles: edit.modeProfiles.map(normalizeModeProfile),
    primaryMode: edit.primaryMode,
    parked: edit.parked.map(normalizeModeProfile),
  };
}

function parkModeProfile(
  parked: ChannelModeProfile[],
  profile: ChannelModeProfile,
): ChannelModeProfile[] {
  const normalized = normalizeModeProfile(profile);
  return [...parked.filter((p) => p.mode !== normalized.mode), normalized];
}

function takeParkedProfile(
  parked: ChannelModeProfile[],
  mode: ChannelMode,
): { parked: ChannelModeProfile[]; profile: ChannelModeProfile | null } {
  const found = parked.find((p) => p.mode === mode);
  if (!found) {
    return { parked, profile: null };
  }
  return { parked: parked.filter((p) => p.mode !== mode), profile: found };
}

function analogSwitchProfile(
  from: ChannelModeProfileAnalog,
  target: AnalogChannelMode,
): ChannelModeProfileAnalog {
  const base = defaultModeProfile(target) as ChannelModeProfileAnalog;
  return {
    ...base,
    rxTone: from.rxTone,
    txTone: from.txTone,
    bandwidthKHz: from.bandwidthKHz,
    squelch: from.squelch,
    analogSquelchMode: from.analogSquelchMode,
    ...(target === 'ssb' ? { ssbSideband: 'usb' as const } : {}),
  };
}

function profileForSwitch(
  oldProfile: ChannelModeProfile | undefined,
  target: ChannelMode,
  parked: ChannelModeProfile[],
): { profile: ChannelModeProfile; parked: ChannelModeProfile[] } {
  const taken = takeParkedProfile(parked, target);
  if (taken.profile) {
    return { profile: taken.profile, parked: taken.parked };
  }
  if (oldProfile != null && isAnalogChannelModeProfile(oldProfile) && isAnalogChannelMode(target)) {
    return {
      profile: analogSwitchProfile(oldProfile, target),
      parked: taken.parked,
    };
  }
  return { profile: defaultModeProfile(target), parked: taken.parked };
}

/** 0 or 1 modes: replace (or set) the channel's mode. With 2+ modes it returns the edit unchanged. */
export function switchChannelMode(edit: ChannelModeEdit, mode: ChannelMode): ChannelModeEdit {
  const base = normalizeChannelModeEdit(edit);
  if (base.modeProfiles.length >= 2) {
    return base;
  }
  if (base.modeProfiles.length === 1) {
    const current = base.modeProfiles[0];
    if (current.mode === mode) {
      return base;
    }
    let nextParked = parkModeProfile(base.parked, current);
    const { profile, parked } = profileForSwitch(current, mode, nextParked);
    nextParked = parked;
    return {
      modeProfiles: [profile],
      primaryMode: mode,
      parked: nextParked,
    };
  }
  const { profile, parked } = profileForSwitch(undefined, mode, base.parked);
  return {
    modeProfiles: [profile],
    primaryMode: mode,
    parked,
  };
}

export function addChannelMode(edit: ChannelModeEdit, mode: ChannelMode): ChannelModeEdit {
  const base = normalizeChannelModeEdit(edit);
  if (base.modeProfiles.some((p) => p.mode === mode)) {
    return base;
  }
  const taken = takeParkedProfile(base.parked, mode);
  const profile = taken.profile ?? defaultModeProfile(mode);
  const nextProfiles = [...base.modeProfiles, profile];
  return {
    modeProfiles: nextProfiles,
    primaryMode: reconcilePrimaryMode(base.primaryMode, nextProfiles),
    parked: taken.parked,
  };
}

export function removeChannelMode(edit: ChannelModeEdit, mode: ChannelMode): ChannelModeEdit {
  const base = normalizeChannelModeEdit(edit);
  const index = base.modeProfiles.findIndex((p) => p.mode === mode);
  if (index === -1) {
    return base;
  }
  const removed = base.modeProfiles[index];
  const rest = base.modeProfiles.filter((_, i) => i !== index);
  return {
    modeProfiles: rest,
    primaryMode: reconcilePrimaryMode(base.primaryMode, rest),
    parked: parkModeProfile(base.parked, removed),
  };
}

export function setChannelMainMode(edit: ChannelModeEdit, mode: ChannelMode): ChannelModeEdit {
  const base = normalizeChannelModeEdit(edit);
  if (!base.modeProfiles.some((p) => p.mode === mode)) {
    return base;
  }
  return { ...base, primaryMode: mode };
}

/**
 * `ownIds` are the library's Digital IDs. When given, a DMR or NXDN profile that names an ID which
 * is missing or belongs to the other protocol is an error; omit it to skip that check.
 */
export function validateModeProfiles(
  profiles: ChannelModeProfile[],
  ownIds?: readonly OwnDigitalId[],
): string[] {
  const errors: string[] = [];
  const seen = new Set<ChannelMode>();
  for (const profile of profiles) {
    if (seen.has(profile.mode)) {
      errors.push(`Duplicate mode profile: ${profile.mode}`);
    }
    seen.add(profile.mode);
    if (profile.mode === 'dmr') {
      if (profile.colourCode != null && (profile.colourCode < 0 || profile.colourCode > 15)) {
        errors.push('DMR colour code must be 0–15');
      }
    }
    if (
      ownIds &&
      (profile.mode === 'dmr' || profile.mode === 'nxdn') &&
      profile.ownDigitalIdId &&
      !channelOwnIdOverride(profile, ownIds)
    ) {
      const label = profile.mode === 'dmr' ? 'DMR' : 'NXDN';
      errors.push(`This channel's ${label} ID is not in Digital IDs`);
    }
    if (profile.mode === 'nxdn') {
      for (const [label, ran] of [
        ['RX RAN', profile.rxRan],
        ['TX RAN', profile.txRan],
      ] as const) {
        if (ran != null && (ran < 0 || ran > 63)) {
          errors.push(`${label} must be 0–63`);
        }
      }
      const callKind = profile.contactRef?.kind;
      if (callKind != null && callKind !== 'talkGroup' && callKind !== 'digitalContact') {
        errors.push('NXDN call must be a talk group or a digital contact');
      }
    }
    if (
      profile.mode === 'tetra' &&
      profile.colorCode != null &&
      (profile.colorCode < 0 || profile.colorCode > 15)
    ) {
      errors.push('TETRA color code must be 0–15');
    }
    if (profile.mode === 'ysf' && profile.dgId != null && (profile.dgId < 0 || profile.dgId > 99)) {
      errors.push('YSF DG-ID must be 0–99');
    }
  }
  return errors;
}
