import type { Library } from '@core/models/library.ts';
import type { ChannelSetImportPlan } from '@core/services/channelSetImport.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';

export interface PersistChannelSetImportOptions {
  persistence: ProjectPersistence;
  library: Library;
  projectId: string;
  plan: ChannelSetImportPlan;
}

export interface PersistChannelSetImportSuccess {
  ok: true;
  addedCount: number;
  skippedCount: number;
  zoneId?: string;
}

export interface PersistChannelSetImportFailure {
  ok: false;
  reason: 'revision_conflict' | 'not_found' | 'persist_failed';
  message: string;
  addedCount: number;
}

export type PersistChannelSetImportOutcome =
  PersistChannelSetImportSuccess | PersistChannelSetImportFailure;

export async function persistChannelSetImport(
  options: PersistChannelSetImportOptions,
): Promise<PersistChannelSetImportOutcome> {
  const { persistence, plan } = options;
  let addedCount = 0;

  for (const channel of plan.channelsToAdd) {
    const result = await persistence.putChannel(channel, null);
    if (!result.ok) {
      return persistFailure(result, addedCount);
    }
    addedCount++;
  }

  if (plan.zone) {
    const zoneResult = await persistence.putZone(plan.zone, null);
    if (!zoneResult.ok) {
      return persistFailure(zoneResult, addedCount);
    }
    return {
      ok: true,
      addedCount,
      skippedCount: plan.skipped.length,
      zoneId: plan.zone.id,
    };
  }

  return {
    ok: true,
    addedCount,
    skippedCount: plan.skipped.length,
  };
}

function persistFailure(
  result: Extract<PutResult, { ok: false }>,
  addedCount: number,
): PersistChannelSetImportFailure {
  if (result.reason === 'revision_conflict') {
    return {
      ok: false,
      reason: 'revision_conflict',
      message: 'Library was updated elsewhere. Reload and try again.',
      addedCount,
    };
  }
  return {
    ok: false,
    reason: result.reason,
    message: 'Could not save channel set to the library.',
    addedCount,
  };
}

export function formatChannelSetImportMessage(
  outcome: PersistChannelSetImportSuccess,
  zoneName?: string,
): string {
  const parts = [`Added ${outcome.addedCount} channel${outcome.addedCount === 1 ? '' : 's'}`];
  if (outcome.skippedCount > 0) {
    parts.push(`skipped ${outcome.skippedCount} duplicate${outcome.skippedCount === 1 ? '' : 's'}`);
  }
  if (outcome.zoneId && zoneName) {
    parts.push(`created zone “${zoneName}”`);
  }
  return parts.join('; ') + '.';
}
