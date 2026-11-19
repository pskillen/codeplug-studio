import type { ReadZoneUpsertPlan } from '@core/services/radioRead/upsertReadZones.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import type { PersistReadPlanOutcome } from './persistOutcome.ts';

export async function persistReadZonePlan(
  persistence: ProjectPersistence,
  plan: Pick<ReadZoneUpsertPlan, 'creates' | 'updates'>,
): Promise<PersistReadPlanOutcome> {
  let created = 0;
  let updated = 0;
  try {
    return await persistence.runWithoutNotifications(async () => {
      for (const entry of plan.creates) {
        const result = await persistence.putZone(entry, null);
        if (!result.ok)
          return {
            ok: false,
            reason: result.reason,
            message:
              result.reason === 'revision_conflict'
                ? 'Library was updated elsewhere. Reload and try again.'
                : 'Could not save zones to the library.',
            created,
            updated,
          };
        created++;
      }
      for (const entry of plan.updates) {
        const result = await persistence.putZone(entry.after, entry.before.revision);
        if (!result.ok)
          return {
            ok: false,
            reason: result.reason,
            message:
              result.reason === 'revision_conflict'
                ? 'Library was updated elsewhere. Reload and try again.'
                : 'Could not save zones to the library.',
            created,
            updated,
          };
        updated++;
      }
      return { ok: true, created, updated };
    });
  } catch {
    return {
      ok: false,
      reason: 'persist_failed',
      message: 'Could not save zones to the library.',
      created,
      updated,
    };
  }
}
