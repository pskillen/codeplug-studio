import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import type { Zone } from '@core/models/library.ts';
import { normalizeZoneMemberEntry } from './zoneMembers.ts';

function migrateZoneMembers(zone: Zone): Zone {
  const members = zone.members.map((member) => normalizeZoneMemberEntry(member));
  const changed = members.some((member, index) => member !== zone.members[index]);
  return changed ? { ...zone, members } : zone;
}

/** Migrate legacy zone member EntityRef[] to ZoneMemberEntry[] (schema v5). */
export function migrateZoneMemberEntries(aggregate: ProjectAggregate): ProjectAggregate {
  let changed = false;
  const zones = aggregate.zones.map((zone) => {
    const migrated = migrateZoneMembers(zone);
    if (migrated !== zone) changed = true;
    return migrated;
  });
  return changed ? { ...aggregate, zones } : aggregate;
}
