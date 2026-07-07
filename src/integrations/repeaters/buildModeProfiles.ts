import type {
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type { AnalogChannelMode, ChannelMode } from '@core/models/libraryTypes.ts';
import type { ChannelTone, SsbSideband } from '@core/models/libraryTypes.ts';
import type { RepeaterListing } from './types.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';

const ANALOG_MODES = new Set<AnalogChannelMode>(['fm', 'am', 'ssb']);

const LEGACY_SSB_SIDEBAND: Record<string, SsbSideband> = {
  'ssb-usb': 'usb',
  'ssb-lsb': 'lsb',
};

function isAnalogMode(mode: ChannelMode): mode is AnalogChannelMode {
  return ANALOG_MODES.has(mode as AnalogChannelMode);
}

function resolveSsbSideband(mode: ChannelMode): SsbSideband | null {
  return LEGACY_SSB_SIDEBAND[mode] ?? (mode === 'ssb' ? 'usb' : null);
}

function analogProfile(
  mode: AnalogChannelMode,
  tone: ChannelTone,
  ssbSideband?: SsbSideband,
): ChannelModeProfileAnalog {
  const profile = { ...defaultModeProfile(mode, tone), mode } as ChannelModeProfileAnalog;
  if (mode === 'ssb' && ssbSideband) {
    profile.ssbSideband = ssbSideband;
  }
  return profile;
}

function dmrProfile(colourCode: number | null): ChannelModeProfileDMR {
  return { ...defaultModeProfile('dmr'), colourCode } as ChannelModeProfileDMR;
}

/**
 * Build one `modeProfiles` entry per advertised mode. FM and DMR use full profile
 * shapes; other digital modes use typed defaults.
 */
export function buildModeProfilesFromListing(listing: RepeaterListing): ChannelModeProfile[] {
  const tone: ChannelTone = listing.toneHz ? String(listing.toneHz) : 'none';
  const profiles: ChannelModeProfile[] = [];
  let analogProfileEntry: ChannelModeProfileAnalog | null = null;
  let ssbSideband: SsbSideband | null = null;

  for (const mode of listing.modes) {
    const legacySsb = resolveSsbSideband(mode);
    if (isAnalogMode(mode) || legacySsb != null) {
      if (legacySsb != null && ssbSideband == null) {
        ssbSideband = legacySsb;
      }
      if (!analogProfileEntry) {
        const analogMode: AnalogChannelMode =
          legacySsb != null || mode === 'ssb' ? 'ssb' : mode;
        const sideband = analogMode === 'ssb' ? (ssbSideband ?? 'usb') : undefined;
        analogProfileEntry = analogProfile(analogMode, tone, sideband);
        profiles.push(analogProfileEntry);
      } else if (legacySsb != null && analogProfileEntry.mode === 'ssb' && ssbSideband != null) {
        analogProfileEntry.ssbSideband = ssbSideband;
      }
      continue;
    }
    if (mode === 'dmr') {
      if (!profiles.some((p) => p.mode === 'dmr')) {
        profiles.push(dmrProfile(listing.colourCode));
      }
      continue;
    }
    if (!profiles.some((p) => p.mode === mode)) {
      profiles.push(defaultModeProfile(mode));
    }
  }

  if (profiles.length === 0) {
    profiles.push(analogProfile('fm', tone));
  }

  return profiles;
}
