import type { Channel } from '@core/models/library.ts';

/** FormPage title for the channel editor — reflects live draft identity fields. */
export function channelEditorPageTitle(isNew: boolean, channel: Channel): string {
  if (isNew) return 'New channel';

  const callsign = channel.callsign.trim();
  const name = channel.name.trim();
  if (callsign) return `Edit channel — ${callsign}`;
  if (name) return `Edit channel — ${name}`;
  return 'Edit channel';
}
