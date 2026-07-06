import type { Channel } from '@core/models/library.ts';
import type { DeleteOutcome } from '../../state/libraryService.ts';
import { LibraryService } from '../../state/libraryService.ts';
import { persistence } from '../../state/persistence.ts';
import {
  formatEntityReferences,
  referencesAreZoneMembershipOnly,
} from '../../lib/entityDeleteMessages.ts';

const service = new LibraryService(persistence);

export type ChannelDeleteFlowResult =
  | { status: 'deleted' }
  | { status: 'cancelled' }
  | { status: 'blocked'; message: string };

export async function runChannelDeleteFlow(options: {
  projectId: string;
  channel: Channel;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
}): Promise<ChannelDeleteFlowResult> {
  const { projectId, channel, deleteEntity, reload } = options;
  const label = channel.name || channel.callsign || 'this channel';
  if (!window.confirm(`Delete channel “${label}”? This cannot be undone.`)) {
    return { status: 'cancelled' };
  }

  let result = await deleteEntity('channel', channel.id);
  if (result.ok) return { status: 'deleted' };

  if (referencesAreZoneMembershipOnly(result.references)) {
    const zoneCount = result.references.length;
    const cascade = window.confirm(
      `This channel is in ${zoneCount} zone${zoneCount === 1 ? '' : 's'}. Remove from all zones and delete?`,
    );
    if (!cascade) return { status: 'cancelled' };
    await service.removeChannelFromDirectZones(projectId, channel.id);
    await reload();
    result = await deleteEntity('channel', channel.id);
    if (result.ok) return { status: 'deleted' };
  }

  return { status: 'blocked', message: `Delete blocked — ${formatEntityReferences(result.references)}` };
}
