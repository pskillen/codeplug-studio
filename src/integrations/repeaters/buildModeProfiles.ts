import type {
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type { AnalogChannelMode, ChannelMode } from '@core/models/libraryTypes.ts';
import type { ChannelTone } from '@core/models/libraryTypes.ts';
import type { RepeaterListing } from './types.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';

const ANALOG_MODES = new Set<AnalogChannelMode>(['fm', 'am', 'ssb-usb', 'ssb-lsb']);

function isAnalogMode(mode: ChannelMode): mode is AnalogChannelMode {
  return ANALOG_MODES.has(mode as AnalogChannelMode);
}

function analogProfile(mode: AnalogChannelMode, tone: ChannelTone): ChannelModeProfileAnalog {
  return { ...defaultModeProfile(mode, tone), mode } as ChannelModeProfileAnalog;
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

  for (const mode of listing.modes) {
    if (isAnalogMode(mode)) {
      if (!analogProfileEntry) {
        analogProfileEntry = analogProfile(mode, tone);
        profiles.push(analogProfileEntry);
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
