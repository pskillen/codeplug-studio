import type {
  Channel,
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '../models/library.ts';
import type {
  AnalogChannelMode,
  ChannelMode,
  ChannelTone,
  SsbSideband,
} from '../models/libraryTypes.ts';

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
    ...(mode === 'ssb' ? { ssbSideband } : {}),
  };
}

function defaultDmrProfile(): ChannelModeProfileDMR {
  return {
    mode: 'dmr',
    colourCode: null,
    timeslot: null,
    dmrId: null,
    contactRef: null,
    rxGroupListId: null,
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
      return { mode: 'nxdn', rxRan: null, txRan: null, unitId: null, talkGroupRef: null };
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
    ...(mode === 'ssb' ? { ssbSideband } : {}),
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

export function syncModeProfiles(
  selectedModes: ChannelMode[],
  existingProfiles: ChannelModeProfile[],
): ChannelModeProfile[] {
  const normalized = existingProfiles.map(normalizeModeProfile);
  return selectedModes.map((mode) => {
    const found = normalized.find((p) => p.mode === mode);
    return found ?? defaultModeProfile(mode);
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
export function resolveChannelPrimaryMode(channel: Pick<Channel, 'primaryMode' | 'modeProfiles'>): ChannelMode | null {
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

/** Patch every analog mode profile on a channel — does not add or remove profiles. */
export function patchAllAnalogProfiles(
  channel: Pick<Channel, 'modeProfiles'>,
  patch: Partial<ChannelModeProfileAnalog>,
): ChannelModeProfile[] {
  return channel.modeProfiles.map((profile) =>
    isAnalogChannelModeProfile(profile) ? { ...profile, ...patch } : profile,
  );
}

export function validateModeProfiles(profiles: ChannelModeProfile[]): string[] {
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
    if (profile.mode === 'nxdn') {
      for (const [label, ran] of [
        ['RX RAN', profile.rxRan],
        ['TX RAN', profile.txRan],
      ] as const) {
        if (ran != null && (ran < 0 || ran > 63)) {
          errors.push(`${label} must be 0–63`);
        }
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
