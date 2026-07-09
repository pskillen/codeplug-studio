import type { Channel } from '@core/models/library.ts';
import type { DeleteOutcome } from '../state/libraryService.ts';
import { deleteChannelWithOptionalZoneCascade } from './channelDeleteFlow.ts';

export interface ChannelBulkDeleteFailure {
  channelId: string;
  channelName: string;
  message: string;
}

export interface PersistChannelBulkDeleteOutcome {
  deletedCount: number;
  failures: ChannelBulkDeleteFailure[];
}

export interface PersistChannelBulkDeleteOptions {
  projectId: string;
  channels: readonly Channel[];
  deleteEntity: (kind: 'channel', id: string) => Promise<DeleteOutcome>;
  reload: () => Promise<void>;
  removeChannelFromDirectZones?: (projectId: string, channelId: string) => Promise<void>;
}

function channelDisplayName(channel: Channel): string {
  return channel.name || channel.callsign || 'Untitled channel';
}

export async function persistChannelBulkDelete(
  options: PersistChannelBulkDeleteOptions,
): Promise<PersistChannelBulkDeleteOutcome> {
  const { projectId, channels, deleteEntity, reload, removeChannelFromDirectZones } = options;
  let deletedCount = 0;
  const failures: ChannelBulkDeleteFailure[] = [];

  for (const channel of channels) {
    const result = await deleteChannelWithOptionalZoneCascade({
      projectId,
      channel,
      deleteEntity,
      reload,
      zoneCascade: 'auto',
      removeChannelFromDirectZones,
    });

    if (result.status === 'deleted') {
      deletedCount++;
      continue;
    }

    if (result.status === 'blocked') {
      failures.push({
        channelId: channel.id,
        channelName: channelDisplayName(channel),
        message: result.message,
      });
    }
  }

  await reload();

  return { deletedCount, failures };
}

export function formatChannelBulkDeleteMessage(outcome: PersistChannelBulkDeleteOutcome): string {
  const parts: string[] = [];

  if (outcome.deletedCount > 0) {
    parts.push(
      `Deleted ${outcome.deletedCount} channel${outcome.deletedCount === 1 ? '' : 's'}`,
    );
  }

  if (outcome.failures.length > 0) {
    const blockedSummary = outcome.failures
      .map((failure) => `${failure.channelName}: ${failure.message}`)
      .join('; ');
    parts.push(
      `${outcome.failures.length} not deleted — ${blockedSummary}`,
    );
  }

  if (parts.length === 0) {
    return 'No channels were deleted.';
  }

  return `${parts.join('. ')}.`;
}

export function bulkDeleteAlertColor(
  outcome: PersistChannelBulkDeleteOutcome,
): 'green' | 'orange' | 'red' {
  if (outcome.deletedCount > 0 && outcome.failures.length === 0) return 'green';
  if (outcome.deletedCount > 0 && outcome.failures.length > 0) return 'orange';
  return 'red';
}
