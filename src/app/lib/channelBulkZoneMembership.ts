import type { Library, Zone, ZoneMemberEntry } from '@core/models/library.ts';
import {
  addChannelsToZoneMembers,
  removeChannelsFromZoneMembers,
} from '@core/domain/zoneMembership.ts';
import { validateZoneMembership } from '@core/domain/validation.ts';
import type { ProjectPersistence, PutResult } from '@integrations/persistence/index.ts';

export interface PersistChannelBulkZoneMembershipOptions {
  persistence: ProjectPersistence;
  library: Library;
  channelIds: readonly string[];
  addToZoneIds: readonly string[];
  removeFromZoneIds: readonly string[];
}

export interface PersistChannelBulkZoneMembershipSuccess {
  ok: true;
  updatedCount: number;
  skippedCount: number;
}

export interface PersistChannelBulkZoneMembershipFailure {
  ok: false;
  reason: 'revision_conflict' | 'not_found' | 'validation_failed';
  message: string;
  updatedCount: number;
  skippedCount: number;
}

export type PersistChannelBulkZoneMembershipOutcome =
  PersistChannelBulkZoneMembershipSuccess | PersistChannelBulkZoneMembershipFailure;

function membersUnchanged(previous: ZoneMemberEntry[], next: ZoneMemberEntry[]): boolean {
  return JSON.stringify(previous) === JSON.stringify(next);
}

function uniqueIds(ids: readonly string[]): string[] {
  return [...new Set(ids)];
}

export async function persistChannelBulkZoneMembership(
  options: PersistChannelBulkZoneMembershipOptions,
): Promise<PersistChannelBulkZoneMembershipOutcome> {
  const { persistence, channelIds } = options;
  const addToZoneIds = uniqueIds(options.addToZoneIds);
  const removeFromZoneIds = uniqueIds(options.removeFromZoneIds).filter(
    (id) => !addToZoneIds.includes(id),
  );

  let workingZones: Zone[] = [...options.library.zones];
  let updatedCount = 0;
  let skippedCount = 0;

  const applyToZone = async (
    zoneId: string,
    nextMembers: (members: ZoneMemberEntry[]) => ZoneMemberEntry[],
  ): Promise<PersistChannelBulkZoneMembershipFailure | null> => {
    const zone = workingZones.find((row) => row.id === zoneId);
    if (!zone) {
      skippedCount++;
      return null;
    }
    const next = nextMembers(zone.members);
    if (membersUnchanged(zone.members, next)) {
      skippedCount++;
      return null;
    }

    const libraryForValidation: Library = {
      ...options.library,
      zones: workingZones.map((row) => (row.id === zoneId ? { ...row, members: next } : row)),
    };
    try {
      validateZoneMembership(zoneId, next, libraryForValidation);
    } catch (error) {
      return {
        ok: false,
        reason: 'validation_failed',
        message: error instanceof Error ? error.message : 'Could not update zone membership.',
        updatedCount,
        skippedCount,
      };
    }

    const updated = { ...zone, members: next };
    const result = await persistence.putZone(updated, zone.revision);
    if (!result.ok) {
      return persistFailure(result, updatedCount, skippedCount);
    }
    workingZones = workingZones.map((row) =>
      row.id === zoneId ? { ...updated, revision: result.revision } : row,
    );
    updatedCount++;
    return null;
  };

  for (const zoneId of removeFromZoneIds) {
    const failure = await applyToZone(zoneId, (members) =>
      removeChannelsFromZoneMembers(members, channelIds),
    );
    if (failure) return failure;
  }

  for (const zoneId of addToZoneIds) {
    const failure = await applyToZone(zoneId, (members) =>
      addChannelsToZoneMembers(members, channelIds),
    );
    if (failure) return failure;
  }

  return { ok: true, updatedCount, skippedCount };
}

function persistFailure(
  result: Extract<PutResult, { ok: false }>,
  updatedCount: number,
  skippedCount: number,
): PersistChannelBulkZoneMembershipFailure {
  if (result.reason === 'revision_conflict') {
    return {
      ok: false,
      reason: 'revision_conflict',
      message: 'Library was updated elsewhere. Reload and try again.',
      updatedCount,
      skippedCount,
    };
  }
  return {
    ok: false,
    reason: result.reason,
    message: 'Could not save zone membership.',
    updatedCount,
    skippedCount,
  };
}

export function formatChannelBulkZoneMembershipMessage(
  outcome: PersistChannelBulkZoneMembershipSuccess,
): string {
  const parts: string[] = [];
  if (outcome.updatedCount > 0) {
    parts.push(`Updated ${outcome.updatedCount} zone${outcome.updatedCount === 1 ? '' : 's'}`);
  }
  if (outcome.skippedCount > 0) {
    parts.push(
      `${outcome.skippedCount} zone${outcome.skippedCount === 1 ? '' : 's'} unchanged (already members or nested-only)`,
    );
  }
  if (parts.length === 0) {
    return 'No zone memberships were changed.';
  }
  return `${parts.join('; ')}.`;
}
