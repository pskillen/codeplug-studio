import type {
  Channel,
  ChannelModeProfileAnalog,
  ChannelModeProfileDMR,
  ChannelTone,
} from '@core/models/library.ts';
import { findAnalogProfile, findDmrProfile } from '@core/domain/modeProfiles.ts';
import type { RepeaterListing } from './types.ts';
import { repeaterListingToChannel } from './mapToChannel.ts';

function hzToMhzString(hz: number | null): string {
  if (hz === null) return '';
  return (hz / 1_000_000).toFixed(5).replace(/0+$/, '').replace(/\.$/, '');
}

export type ChannelDiffField =
  | 'callsign'
  | 'name'
  | 'rxFrequency'
  | 'txFrequency'
  | 'rxTone'
  | 'txTone'
  | 'colourCode'
  | 'mode'
  | 'location'
  | 'maidenheadLocator'
  | 'useLocation'
  | 'comment';

export interface ChannelDiffRow {
  field: ChannelDiffField;
  label: string;
  local: string;
  remote: string;
  changed: boolean;
}

const FIELD_LABELS: Record<ChannelDiffField, string> = {
  callsign: 'Callsign',
  name: 'Name',
  rxFrequency: 'RX frequency',
  txFrequency: 'TX frequency',
  rxTone: 'RX tone',
  txTone: 'TX tone',
  colourCode: 'Colour code',
  mode: 'Mode',
  location: 'Locator / coordinates',
  maidenheadLocator: 'Maidenhead locator',
  useLocation: 'Use location',
  comment: 'Comment',
};

function findFmProfile(channel: Channel): ChannelModeProfileAnalog | null {
  const profile = findAnalogProfile(channel);
  return profile?.mode === 'fm' ? profile : null;
}

function formatTone(tone: ChannelTone): string {
  return tone === 'none' ? 'None' : tone;
}

function formatLocation(channel: Channel): string {
  if (channel.maidenheadLocator) return channel.maidenheadLocator;
  if (!channel.location) return '—';
  const { lat, lon } = channel.location;
  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function formatMode(channel: Channel): string {
  const modes = channel.modeProfiles.map((p) => p.mode.toUpperCase());
  return modes.length ? modes.join(' + ') : '—';
}

function formatRemoteMode(remote: Channel): string {
  return formatMode(remote);
}

function locationEqual(a: Channel['location'], b: Channel['location']): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return Math.abs(a.lat - b.lat) < 0.0001 && Math.abs(a.lon - b.lon) < 0.0001;
}

export function diffChannelFromListing(
  channel: Channel,
  listing: RepeaterListing,
): ChannelDiffRow[] {
  const remote = repeaterListingToChannel(listing, channel.projectId);
  const rows: ChannelDiffRow[] = [];

  const push = (field: ChannelDiffField, local: string, remoteVal: string, changed: boolean) => {
    rows.push({ field, label: FIELD_LABELS[field], local, remote: remoteVal, changed });
  };

  const localFm = findFmProfile(channel);
  const remoteFm = findFmProfile(remote);
  const localDmr = findDmrProfile(channel);
  const remoteDmr = findDmrProfile(remote);

  push(
    'callsign',
    channel.callsign || '—',
    remote.callsign || '—',
    channel.callsign !== remote.callsign,
  );
  push('name', channel.name, remote.name, channel.name !== remote.name);
  push(
    'rxFrequency',
    hzToMhzString(channel.rxFrequency) || '—',
    hzToMhzString(remote.rxFrequency) || '—',
    channel.rxFrequency !== remote.rxFrequency,
  );
  push(
    'txFrequency',
    hzToMhzString(channel.txFrequency) || '—',
    hzToMhzString(remote.txFrequency) || '—',
    channel.txFrequency !== remote.txFrequency,
  );

  if (localFm && remoteFm) {
    push(
      'rxTone',
      formatTone(localFm.rxTone),
      formatTone(remoteFm.rxTone),
      localFm.rxTone !== remoteFm.rxTone,
    );
    push(
      'txTone',
      formatTone(localFm.txTone),
      formatTone(remoteFm.txTone),
      localFm.txTone !== remoteFm.txTone,
    );
  }

  if (localDmr && remoteDmr) {
    push(
      'colourCode',
      localDmr.colourCode == null ? '—' : String(localDmr.colourCode),
      remoteDmr.colourCode == null ? '—' : String(remoteDmr.colourCode),
      localDmr.colourCode !== remoteDmr.colourCode,
    );
  }

  push(
    'mode',
    formatMode(channel),
    formatRemoteMode(remote),
    formatMode(channel) !== formatMode(remote),
  );
  push(
    'location',
    formatLocation(channel),
    formatLocation(remote),
    !locationEqual(channel.location, remote.location),
  );
  push(
    'maidenheadLocator',
    channel.maidenheadLocator ?? '—',
    remote.maidenheadLocator ?? '—',
    (channel.maidenheadLocator ?? '') !== (remote.maidenheadLocator ?? ''),
  );
  push(
    'useLocation',
    channel.useLocation ? 'Yes' : 'No',
    remote.useLocation ? 'Yes' : 'No',
    channel.useLocation !== remote.useLocation,
  );
  push(
    'comment',
    channel.comment || '—',
    remote.comment || '—',
    channel.comment !== remote.comment,
  );

  return rows;
}

export function diffHasChanges(rows: ChannelDiffRow[]): boolean {
  return rows.some((r) => r.changed);
}

export function buildPatchFromDiff(
  channel: Channel,
  listing: RepeaterListing,
  selectedFields: ChannelDiffField[],
): Channel {
  const remote = repeaterListingToChannel(listing, channel.projectId);
  const selected = new Set(selectedFields);
  const next: Channel = { ...channel };

  if (selected.has('callsign')) next.callsign = remote.callsign;
  if (selected.has('name')) next.name = remote.name;
  if (selected.has('rxFrequency')) next.rxFrequency = remote.rxFrequency;
  if (selected.has('txFrequency')) next.txFrequency = remote.txFrequency;
  if (selected.has('comment')) next.comment = remote.comment;
  if (selected.has('location')) {
    next.location = remote.location;
    next.maidenheadLocator = remote.maidenheadLocator;
  }
  if (selected.has('maidenheadLocator')) next.maidenheadLocator = remote.maidenheadLocator;
  if (selected.has('useLocation')) next.useLocation = remote.useLocation;
  if (selected.has('mode')) next.modeProfiles = remote.modeProfiles;

  const remoteFm = findFmProfile(remote);
  const remoteDmr = findDmrProfile(remote);

  if (selected.has('rxTone') || selected.has('txTone') || selected.has('colourCode')) {
    next.modeProfiles = next.modeProfiles.map((profile) => {
      if (profile.mode === 'fm' && remoteFm) {
        const fm = profile as ChannelModeProfileAnalog;
        return {
          ...fm,
          rxTone: selected.has('rxTone') ? remoteFm.rxTone : fm.rxTone,
          txTone: selected.has('txTone') ? remoteFm.txTone : fm.txTone,
        };
      }
      if (profile.mode === 'dmr' && remoteDmr) {
        const dmr = profile as ChannelModeProfileDMR;
        return {
          ...dmr,
          colourCode: selected.has('colourCode') ? remoteDmr.colourCode : dmr.colourCode,
        };
      }
      return profile;
    });
  }

  return next;
}
