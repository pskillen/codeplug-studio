import type {
  ChannelModeProfile,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
} from '@core/models/library.ts';
import type {
  AnalogChannelMode,
  ChannelMode,
  ChannelTone,
  SsbSideband,
} from '@core/models/libraryTypes.ts';
import type { RepeaterListing } from './types.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { formatCtcssHz } from '@core/domain/tones.ts';

const LEGACY_SSB_SIDEBAND: Record<string, SsbSideband> = {
  'ssb-usb': 'usb',
  'ssb-lsb': 'lsb',
};

function analogProfile(
  mode: AnalogChannelMode,
  rxTone: ChannelTone,
  txTone: ChannelTone,
  ssbSideband?: SsbSideband,
): ChannelModeProfileAnalog {
  const profile = {
    ...defaultModeProfile(mode),
    mode,
    rxTone,
    txTone,
  } as ChannelModeProfileAnalog;
  if (mode === 'ssb' && ssbSideband) {
    profile.ssbSideband = ssbSideband;
  }
  return profile;
}

function dmrProfile(colourCode: number | null): ChannelModeProfileDMR {
  return { ...defaultModeProfile('dmr'), colourCode } as ChannelModeProfileDMR;
}

/** First analogue-class mode in listing order — legacy SSB wire ids map to `ssb` + sideband. */
function analogKindFromListingMode(
  mode: ChannelMode,
): { mode: AnalogChannelMode; ssbSideband?: SsbSideband } | null {
  const legacySsb = LEGACY_SSB_SIDEBAND[mode];
  if (legacySsb != null) {
    return { mode: 'ssb', ssbSideband: legacySsb };
  }
  if (mode === 'ssb') {
    return { mode: 'ssb', ssbSideband: 'usb' };
  }
  if (mode === 'fm' || mode === 'am') {
    return { mode };
  }
  return null;
}

/**
 * Build one `modeProfiles` entry per advertised mode. FM and DMR use full profile
 * shapes; other digital modes use typed defaults. Multiple analogue-class modes
 * collapse to a single profile (first in listing order wins).
 */
export function buildModeProfilesFromListing(listing: RepeaterListing): ChannelModeProfile[] {
  const rxTone: ChannelTone = listing.rxToneHz != null ? formatCtcssHz(listing.rxToneHz) : 'none';
  const txTone: ChannelTone = listing.txToneHz != null ? formatCtcssHz(listing.txToneHz) : 'none';
  const profiles: ChannelModeProfile[] = [];
  let hasAnalogProfile = false;

  for (const mode of listing.modes) {
    const analogKind = analogKindFromListingMode(mode);
    if (analogKind != null) {
      if (!hasAnalogProfile) {
        profiles.push(analogProfile(analogKind.mode, rxTone, txTone, analogKind.ssbSideband));
        hasAnalogProfile = true;
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
    profiles.push(analogProfile('fm', rxTone, txTone));
  }

  return profiles;
}
