import type {
  Channel,
  ChannelModeProfile,
  ChannelTone,
  EntityRef,
  Library,
} from '@core/models/library.ts';
import type { ChannelMode } from '@core/models/libraryTypes.ts';
import { resolveChannelPrimaryMode } from '@core/domain/modeProfiles.ts';
import { modeLabel } from './channelModes.ts';

/** The talk groups and contacts a summary may name; Library and LibrarySlice both satisfy it. */
export type ModeSummaryLookup = Pick<Library, 'talkGroups' | 'digitalContacts'>;

export interface ChannelModeSummary {
  mode: ChannelMode;
  label: string;
  detail: string;
  isMain: boolean;
}

function toneIsSet(tone: ChannelTone): boolean {
  return tone !== 'none' && tone.trim() !== '';
}

function analogToneSummaryParts(rxTone: ChannelTone, txTone: ChannelTone): string[] {
  const txSet = toneIsSet(txTone);
  const rxSet = toneIsSet(rxTone);
  if (txSet && rxSet && txTone === rxTone) {
    return [`T/R ${txTone}`];
  }
  const parts: string[] = [];
  if (txSet) parts.push(`T ${txTone}`);
  if (rxSet) parts.push(`R ${rxTone}`);
  return parts;
}

function contactRefSummary(ref: EntityRef | null, lookup: ModeSummaryLookup): string | null {
  if (!ref) return null;
  if (ref.kind === 'talkGroup') {
    const tg = lookup.talkGroups.find((row) => row.id === ref.id);
    return tg != null ? `TG${tg.digitalId}` : null;
  }
  if (ref.kind === 'digitalContact') {
    const contact = lookup.digitalContacts.find((row) => row.id === ref.id);
    return contact != null ? `PC${contact.digitalId}` : null;
  }
  return null;
}

function nxdnRanSummary(rxRan: number | null, txRan: number | null): string | null {
  if (rxRan != null && txRan != null && rxRan !== txRan) {
    return `RAN${rxRan}/${txRan}`;
  }
  const value = rxRan ?? txRan;
  return value != null ? `RAN${value}` : null;
}

/** The summary text for one profile, without the mode label: "CC1 TS2 TG2351". Empty when nothing is set. */
export function modeProfileSummary(profile: ChannelModeProfile, lookup: ModeSummaryLookup): string {
  const parts: string[] = [];
  switch (profile.mode) {
    case 'fm':
    case 'am': {
      parts.push(...analogToneSummaryParts(profile.rxTone, profile.txTone));
      if (profile.bandwidthKHz === 12.5) parts.push('12.5k');
      break;
    }
    case 'ssb': {
      const sideband = profile.ssbSideband ?? 'usb';
      parts.push(sideband === 'lsb' ? 'LSB' : 'USB');
      break;
    }
    case 'dmr': {
      if (profile.colourCode != null) parts.push(`CC${profile.colourCode}`);
      if (profile.timeslot != null) parts.push(`TS${profile.timeslot}`);
      const contact = contactRefSummary(profile.contactRef, lookup);
      if (contact) parts.push(contact);
      break;
    }
    case 'nxdn': {
      const ran = nxdnRanSummary(profile.rxRan, profile.txRan);
      if (ran) parts.push(ran);
      if (profile.nxdnRate === 'nxdn96') parts.push('NXDN96');
      const contact = contactRefSummary(profile.contactRef, lookup);
      if (contact) parts.push(contact);
      break;
    }
    case 'dstar': {
      const ur = profile.urCall.trim();
      if (ur) parts.push(`→ ${ur}`);
      const rpt1 = profile.rpt1Call.trim();
      if (rpt1) parts.push(`via ${rpt1}`);
      break;
    }
    case 'ysf': {
      if (profile.dgId != null) parts.push(`DG${profile.dgId}`);
      break;
    }
    case 'tetra': {
      if (profile.mcc != null && profile.mnc != null) {
        parts.push(`${profile.mcc}-${profile.mnc}`);
      }
      const tgFromRef = contactRefSummary(profile.talkGroupRef, lookup);
      if (tgFromRef) {
        parts.push(tgFromRef);
      } else if (profile.gssi != null) {
        parts.push(`TG${profile.gssi}`);
      }
      break;
    }
    case 'p25':
    case 'm17':
      break;
    default: {
      const _exhaustive: never = profile;
      return _exhaustive;
    }
  }
  return parts.join(' ');
}

/** Every mode on the channel, main mode first when there are two or more, then profile order. None: []. */
export function channelModeSummaries(
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode'>,
  lookup: ModeSummaryLookup,
): ChannelModeSummary[] {
  const { modeProfiles } = channel;
  if (modeProfiles.length === 0) return [];

  const multi = modeProfiles.length >= 2;
  const mainMode = multi ? resolveChannelPrimaryMode(channel) : null;

  let ordered: ChannelModeProfile[];
  if (multi && mainMode != null) {
    const mainProfile = modeProfiles.find((p) => p.mode === mainMode);
    const rest = modeProfiles.filter((p) => p.mode !== mainMode);
    ordered = mainProfile != null ? [mainProfile, ...rest] : modeProfiles;
  } else {
    ordered = modeProfiles;
  }

  return ordered.map((profile) => ({
    mode: profile.mode,
    label: modeLabel(profile.mode),
    detail: modeProfileSummary(profile, lookup),
    isMain: multi && profile.mode === mainMode,
  }));
}

/** Plain text for headers and popups: "DMR CC1 TS2 TG2351 · FM T 103.5". */
export function channelModeSummaryText(
  channel: Pick<Channel, 'modeProfiles' | 'primaryMode'>,
  lookup: ModeSummaryLookup,
): string {
  return channelModeSummaries(channel, lookup)
    .map((entry) => (entry.detail ? `${entry.label} ${entry.detail}` : entry.label))
    .join(' · ');
}
