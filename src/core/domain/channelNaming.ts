import type { Channel } from '@core/models/library.ts';
import { CALLSIGN_TOKEN_PATTERNS } from './channelNaming/patterns.ts';

export type ChannelExportNameMode =
  'callsign_name' | 'callsign_only' | 'name_only' | 'callsign_suffix';

export const DEFAULT_CHANNEL_EXPORT_NAME_MODE: ChannelExportNameMode = 'callsign_name';

export const EXPORT_NAME_MODE_OPTIONS: ReadonlyArray<{
  value: ChannelExportNameMode;
  label: string;
}> = [
  { value: 'callsign_name', label: 'Callsign + name' },
  { value: 'callsign_only', label: 'Callsign only' },
  { value: 'name_only', label: 'Name only' },
  { value: 'callsign_suffix', label: 'Callsign suffix + name' },
];

const EDGE_PUNCTUATION = /^[.,;:]+|[.,;:]+$/g;

export function normalizeCallsignToken(token: string): string {
  return token.trim().replace(EDGE_PUNCTUATION, '').toUpperCase();
}

export function isCallsignToken(token: string): boolean {
  const normalized = normalizeCallsignToken(token);
  if (!normalized || !/\d/.test(normalized)) return false;
  const base = normalized.split('/')[0];
  return CALLSIGN_TOKEN_PATTERNS.some((pattern) => pattern.regex.test(base));
}

export interface ChannelWireExportPick {
  callsign: string;
  name: string;
  exportNameMode: ChannelExportNameMode;
}

export function composeChannelWireName(channel: ChannelWireExportPick): string {
  const callsign = (channel.callsign ?? '').trim();
  const name = (channel.name ?? '').trim();

  switch (channel.exportNameMode) {
    case 'callsign_name':
      if (callsign && name) return `${callsign} ${name}`;
      return callsign || name;
    case 'callsign_only':
      return callsign || name;
    case 'name_only':
      return name || callsign;
    case 'callsign_suffix': {
      const suffix =
        callsign.length >= 2 ? callsign.slice(-2).toUpperCase() : callsign.toUpperCase();
      if (suffix && name) return `${suffix} ${name}`;
      return suffix || name;
    }
    default:
      return name || callsign;
  }
}

export interface ChannelWireExportPickOptions {
  nameModeOverride?: ChannelExportNameMode;
  useChannelAbbreviation?: boolean;
}

export function channelPickForWireExport(
  channel: Channel,
  options: ChannelWireExportPickOptions = {},
): ChannelWireExportPick {
  const exportNameMode = options.nameModeOverride ?? DEFAULT_CHANNEL_EXPORT_NAME_MODE;
  const base: ChannelWireExportPick = {
    callsign: channel.callsign,
    name: channel.name,
    exportNameMode,
  };
  if (options.useChannelAbbreviation) {
    const abbrev = channel.abbreviation?.trim();
    if (abbrev) return { ...base, name: abbrev };
  }
  return base;
}

/** Default CPS wire name before mode suffixes and build overrides. */
export function defaultChannelWireName(
  channel: Channel,
  options: ChannelWireExportPickOptions = {},
): string {
  return composeChannelWireName(channelPickForWireExport(channel, options));
}

export function channelDisplayLabel(channel: Channel): string {
  const parts = [channel.callsign, channel.name].filter(Boolean);
  return parts.length > 0 ? parts.join(' — ') : channel.name || channel.id;
}
