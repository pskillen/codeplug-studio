import type { PublicServiceImportPlan } from '@core/services/publicServiceImport.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';

export interface PersistPublicServiceImportOptions {
  persistence: ProjectPersistence;
  plan: PublicServiceImportPlan;
}

export interface PersistPublicServiceImportSuccess {
  ok: true;
  addedCount: number;
  skippedCount: number;
  advisoryCount: number;
  zoneIds: string[];
}

export interface PersistPublicServiceImportFailure {
  ok: false;
  reason: 'revision_conflict' | 'not_found' | 'persist_failed';
  message: string;
  addedCount: number;
}

export type PersistPublicServiceImportOutcome =
  | PersistPublicServiceImportSuccess
  | PersistPublicServiceImportFailure;

export async function persistPublicServiceImport(
  options: PersistPublicServiceImportOptions,
): Promise<PersistPublicServiceImportOutcome> {
  const { persistence, plan } = options;
  let addedCount = 0;

  for (const channel of plan.channelsToAdd) {
    const result = await persistence.putChannel(channel, null);
    if (!result.ok) {
      return persistFailure(result, addedCount);
    }
    addedCount += 1;
  }

  const zoneIds: string[] = [];
  for (const zone of plan.zones) {
    const zoneResult = await persistence.putZone(zone, null);
    if (!zoneResult.ok) {
      return persistFailure(zoneResult, addedCount);
    }
    zoneIds.push(zone.id);
  }

  return {
    ok: true,
    addedCount,
    skippedCount: plan.skipped.length,
    advisoryCount: plan.advisories.length,
    zoneIds,
  };
}

function persistFailure(
  result: Extract<PutResult, { ok: false }>,
  addedCount: number,
): PersistPublicServiceImportFailure {
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
    message: 'Could not save public service channels to the library.',
    addedCount,
  };
}

export function formatPublicServiceImportMessage(
  outcome: PersistPublicServiceImportSuccess,
  zoneNames: readonly string[] = [],
): string {
  const parts = [`Added ${outcome.addedCount} channel${outcome.addedCount === 1 ? '' : 's'}`];
  if (outcome.skippedCount > 0) {
    parts.push(`skipped ${outcome.skippedCount} duplicate${outcome.skippedCount === 1 ? '' : 's'}`);
  }
  if (zoneNames.length === 1) {
    parts.push(`created zone “${zoneNames[0]}”`);
  } else if (zoneNames.length > 1) {
    parts.push(`created ${zoneNames.length} zones`);
  }
  return `${parts.join('; ')}.`;
}
