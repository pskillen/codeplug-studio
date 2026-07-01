import type { Channel } from '@core/models/library.ts';

export function channelOptionLabel(ch: Channel): string {
  if (ch.callsign && ch.callsign !== ch.name) {
    return `${ch.name} (${ch.callsign})`;
  }
  return ch.name;
}

export function channelHasLocation(ch: Channel): boolean {
  if (!ch.location) return false;
  const { lat, lon } = ch.location;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  return !(lat === 0 && lon === 0);
}

export function filterChannelOptions(
  channels: Channel[],
  query: string,
): { value: string; label: string }[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  return channels
    .filter(
      (ch) =>
        ch.name.toLowerCase().includes(q) ||
        (ch.callsign?.toLowerCase().includes(q) ?? false),
    )
    .slice(0, 25)
    .map((ch) => ({ value: ch.id, label: channelOptionLabel(ch) }));
}

/** Match Autocomplete display value (label) or option value (id) to a channel id. */
export function resolveChannelOptionId(
  value: string,
  options: { value: string; label: string }[],
  channels?: Channel[],
): string | null {
  const fromOptions = options.find((o) => o.label === value || o.value === value);
  if (fromOptions) return fromOptions.value;
  if (!channels) return null;
  const fromChannel = channels.find((ch) => channelOptionLabel(ch) === value || ch.id === value);
  return fromChannel?.id ?? null;
}
