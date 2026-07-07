import type { Channel } from '@core/models/library.ts';
import type { DeleteOutcome } from '../state/libraryService.ts';
import { LibraryService } from '../state/libraryService.ts';
import { persistence } from '../state/persistence.ts';
import { referencesAreZoneMembershipOnly } from './entityDeleteMessages.ts';
import { runEntityDeleteFlow, type DeleteEntityFn, type EntityDeleteFlowResult } from './entityDeleteFlow.ts';

const service = new LibraryService(persistence);

export type ChannelDeleteFlowResult = EntityDeleteFlowResult;

export async function runChannelDeleteFlow(options: {
  projectId: string;
  channel: Channel;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
}): Promise<ChannelDeleteFlowResult> {
  const { projectId, channel, deleteEntity, reload } = options;
  const label = channel.name || channel.callsign || 'this channel';
  const deleteChannel: DeleteEntityFn = (kind, id) => deleteEntity(kind as 'channel', id);

  return runEntityDeleteFlow({
    kind: 'channel',
    entityId: channel.id,
    label,
    deleteEntity: deleteChannel,
    cascade: async ({ references }) => {
      if (!referencesAreZoneMembershipOnly(references)) return 'cancelled';
      const zoneCount = references.length;
      const cascade = window.confirm(
        `This channel is in ${zoneCount} zone${zoneCount === 1 ? '' : 's'}. Remove from all zones and delete?`,
      );
      if (!cascade) return 'cancelled';
      await service.removeChannelFromDirectZones(projectId, channel.id);
      await reload();
      return 'cascade_applied';
    },
  });
}
