import type {
  AbstractChannelModeProfile,
  ChannelModeProfileDMR,
  ChannelModeProfileFM,
  ChannelTone,
} from '@core/models/library.ts';
import type { AnalogChannelMode, ChannelMode } from '@core/models/libraryTypes.ts';
import type { RepeaterListing } from './types.ts';

const ANALOG_MODES = new Set<AnalogChannelMode>(['fm', 'am', 'ssb-usb', 'ssb-lsb']);

function isAnalogMode(mode: ChannelMode): mode is AnalogChannelMode {
  return ANALOG_MODES.has(mode as AnalogChannelMode);
}

function fmProfile(mode: AnalogChannelMode, tone: ChannelTone): ChannelModeProfileFM {
  return { mode, squelch: null, rxTone: tone, txTone: tone };
}

function dmrProfile(colourCode: number | null): ChannelModeProfileDMR {
  return {
    mode: 'dmr',
    colourCode,
    timeslot: null,
    dmrId: null,
    contactRef: null,
    rxGroupListId: null,
  };
}

/**
 * Build one `modeProfiles` entry per advertised mode. FM and DMR use full profile
 * shapes; other digital modes use mode-only stubs until dedicated profiles exist.
 */
export function buildModeProfilesFromListing(listing: RepeaterListing): AbstractChannelModeProfile[] {
  const tone: ChannelTone = listing.toneHz ? String(listing.toneHz) : 'none';
  const profiles: AbstractChannelModeProfile[] = [];
  let analogProfile: ChannelModeProfileFM | null = null;

  for (const mode of listing.modes) {
    if (isAnalogMode(mode)) {
      if (!analogProfile) {
        analogProfile = fmProfile(mode, tone);
        profiles.push(analogProfile);
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
      profiles.push({ mode });
    }
  }

  if (profiles.length === 0) {
    profiles.push(fmProfile('fm', tone));
  }

  return profiles;
}
