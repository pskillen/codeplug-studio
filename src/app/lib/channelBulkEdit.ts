import type { Channel } from '@core/models/library.ts';
import {
  applyChannelBulkPatch,
  channelBulkEditWouldChange,
  type ChannelBulkEditPatch,
} from '@core/domain/channelBulkEdit.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';

export interface PersistChannelBulkEditOptions {
  persistence: ProjectPersistence;
  channels: readonly Channel[];
  patch: ChannelBulkEditPatch;
}

export interface ChannelBulkEditFailure {
  channelId: string;
  channelName: string;
  reason: Extract<PutResult, { ok: false }>['reason'];
}

export interface PersistChannelBulkEditSuccess {
  ok: true;
  updatedCount: number;
  skippedCount: number;
}

export interface PersistChannelBulkEditFailure {
  ok: false;
  reason: 'revision_conflict' | 'not_found' | 'persist_failed';
  message: string;
  updatedCount: number;
  skippedCount: number;
  failures: ChannelBulkEditFailure[];
}

export type PersistChannelBulkEditOutcome =
  PersistChannelBulkEditSuccess | PersistChannelBulkEditFailure;

export async function persistChannelBulkEdit(
  options: PersistChannelBulkEditOptions,
): Promise<PersistChannelBulkEditOutcome> {
  const { persistence, channels, patch } = options;
  let updatedCount = 0;
  let skippedCount = 0;
  const failures: ChannelBulkEditFailure[] = [];

  for (const channel of channels) {
    if (!channelBulkEditWouldChange(channel, patch)) {
      skippedCount++;
      continue;
    }

    const patched = applyChannelBulkPatch(channel, patch);
    const result = await persistence.putChannel(patched, channel.revision);
    if (!result.ok) {
      failures.push({
        channelId: channel.id,
        channelName: channel.name,
        reason: result.reason,
      });
      return persistFailure(result, updatedCount, skippedCount, failures);
    }
    updatedCount++;
  }

  return { ok: true, updatedCount, skippedCount };
}

function persistFailure(
  result: Extract<PutResult, { ok: false }>,
  updatedCount: number,
  skippedCount: number,
  failures: ChannelBulkEditFailure[],
): PersistChannelBulkEditFailure {
  if (result.reason === 'revision_conflict') {
    return {
      ok: false,
      reason: 'revision_conflict',
      message: 'Library was updated elsewhere. Reload and try again.',
      updatedCount,
      skippedCount,
      failures,
    };
  }
  return {
    ok: false,
    reason: result.reason,
    message: 'Could not save bulk channel edits.',
    updatedCount,
    skippedCount,
    failures,
  };
}

export function formatChannelBulkEditMessage(outcome: PersistChannelBulkEditSuccess): string {
  const parts: string[] = [];
  if (outcome.updatedCount > 0) {
    parts.push(`Updated ${outcome.updatedCount} channel${outcome.updatedCount === 1 ? '' : 's'}`);
  }
  if (outcome.skippedCount > 0) {
    parts.push(
      `${outcome.skippedCount} unchanged (values already matched or no applicable mode profile)`,
    );
  }
  if (parts.length === 0) {
    return 'No channels were changed.';
  }
  return `${parts.join('; ')}.`;
}
