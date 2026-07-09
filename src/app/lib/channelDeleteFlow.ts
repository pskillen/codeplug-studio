import type { Channel } from '@core/models/library.ts';
import type { DeleteOutcome } from '../state/libraryService.ts';
import { LibraryService } from '../state/libraryService.ts';
import { persistence } from '../state/persistence.ts';
import { formatEntityReferences, referencesAreZoneMembershipOnly } from './entityDeleteMessages.ts';
import { kindMeta } from '../routes/library/registry.ts';

const defaultService = new LibraryService(persistence);

export type ChannelZoneCascadeMode = 'prompt' | 'auto';

export type ChannelDeleteAttemptResult =
  { status: 'deleted' } | { status: 'cancelled' } | { status: 'blocked'; message: string };

export type ChannelDeleteFlowResult = ChannelDeleteAttemptResult;

function channelDeleteConfirmMessage(label: string): string {
  const entityName = kindMeta('channel').label.toLowerCase();
  return `Delete ${entityName} “${label}”? This cannot be undone.`;
}

export async function deleteChannelWithOptionalZoneCascade(options: {
  projectId: string;
  channel: Channel;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  zoneCascade: ChannelZoneCascadeMode;
  removeChannelFromDirectZones?: (projectId: string, channelId: string) => Promise<void>;
}): Promise<ChannelDeleteAttemptResult> {
  const {
    projectId,
    channel,
    deleteEntity,
    reload,
    zoneCascade,
    removeChannelFromDirectZones = (pid, channelId) =>
      defaultService.removeChannelFromDirectZones(pid, channelId),
  } = options;

  let result = await deleteEntity('channel', channel.id);
  if (result.ok) return { status: 'deleted' };

  if (!referencesAreZoneMembershipOnly(result.references)) {
    return {
      status: 'blocked',
      message: `Delete blocked — ${formatEntityReferences(result.references)}`,
    };
  }

  if (zoneCascade === 'prompt') {
    const zoneCount = result.references.length;
    const confirmed = window.confirm(
      `This channel is in ${zoneCount} zone${zoneCount === 1 ? '' : 's'}. Remove from all zones and delete?`,
    );
    if (!confirmed) return { status: 'cancelled' };
  }

  await removeChannelFromDirectZones(projectId, channel.id);
  await reload();

  result = await deleteEntity('channel', channel.id);
  if (result.ok) return { status: 'deleted' };

  return {
    status: 'blocked',
    message: `Delete blocked — ${formatEntityReferences(result.references)}`,
  };
}

export async function runChannelDeleteFlow(options: {
  projectId: string;
  channel: Channel;
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
}): Promise<ChannelDeleteFlowResult> {
  const { projectId, channel, deleteEntity, reload } = options;
  const label = channel.name || channel.callsign || 'this channel';

  if (!window.confirm(channelDeleteConfirmMessage(label))) {
    return { status: 'cancelled' };
  }

  return deleteChannelWithOptionalZoneCascade({
    projectId,
    channel,
    deleteEntity,
    reload,
    zoneCascade: 'prompt',
  });
}
