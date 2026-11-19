import { newZone } from '@core/domain/factories.ts';
import type { Library, Zone } from '@core/models/library.ts';

export interface RadioReadZone {
  wireName: string;
  /** Ordered 1-based radio channel numbers. */
  channelNumbers: readonly number[];
  /** Scan subset, or absent when the read carried no scan set. */
  scanChannelNumbers?: readonly number[];
}
export interface ReadZoneUpsertOptions {
  nameCandidatesByZoneId?: ReadonlyMap<string, readonly string[]>;
}
export interface ReadZoneWarning {
  kind: 'missing-member';
  zoneName: string;
  slot: number;
}
export interface ReadZonePlanEntry {
  readIndex: number;
  zoneId: string;
  name: string;
  action: 'create' | 'update' | 'unchanged';
  channelIds: string[];
  scanChannelIds?: string[];
}
export interface ReadZoneUpsertPlan {
  creates: Zone[];
  updates: { before: Zone; after: Zone }[];
  unchanged: string[];
  entries: ReadZonePlanEntry[];
  warnings: ReadZoneWarning[];
}

export function planReadZoneUpsert(
  library: Pick<Library, 'zones'>,
  projectId: string,
  zones: readonly RadioReadZone[],
  slotToChannelId: ReadonlyMap<number, string>,
  options?: ReadZoneUpsertOptions,
): ReadZoneUpsertPlan {
  const plan: ReadZoneUpsertPlan = {
    creates: [],
    updates: [],
    unchanged: [],
    entries: [],
    warnings: [],
  };
  const claimed = new Set<string>();
  zones.forEach((read, readIndex) => {
    const name = read.wireName.trim() || `Zone ${readIndex + 1}`;
    const available = library.zones.filter((zone) => !claimed.has(zone.id));
    const match =
      available.find((zone) => zone.name.trim() === name) ??
      available.find((zone) =>
        options?.nameCandidatesByZoneId
          ?.get(zone.id)
          ?.some((candidate) => candidate.trim() === name),
      );
    const channelIds: string[] = [];
    for (const slot of new Set(read.channelNumbers)) {
      const id = slotToChannelId.get(slot);
      if (id === undefined) plan.warnings.push({ kind: 'missing-member', zoneName: name, slot });
      else channelIds.push(id);
    }
    const scanSlots =
      read.scanChannelNumbers === undefined ? undefined : new Set(read.scanChannelNumbers);
    const scanIds =
      scanSlots === undefined
        ? undefined
        : new Set([...scanSlots].map((slot) => slotToChannelId.get(slot)));
    const scanChannelIds =
      scanIds === undefined ? undefined : channelIds.filter((id) => scanIds.has(id));
    let zone: Zone;
    let action: ReadZonePlanEntry['action'];
    if (!match) {
      zone = {
        ...newZone(projectId, name),
        members: channelIds.map((channelId) => ({ kind: 'channel', channelId })),
      };
      plan.creates.push(zone);
      action = 'create';
    } else {
      claimed.add(match.id);
      const members: Zone['members'] = channelIds.map((channelId) => {
        const existing = match.members.find(
          (member) => member.kind === 'channel' && member.channelId === channelId,
        );
        return existing ? { ...existing } : { kind: 'channel', channelId };
      });
      members.push(
        ...match.members
          .filter((member) => member.kind === 'zone')
          .map((member) => ({ ...member })),
      );
      zone = { ...match, members };
      if (JSON.stringify(members) === JSON.stringify(match.members)) {
        plan.unchanged.push(match.id);
        action = 'unchanged';
      } else {
        plan.updates.push({ before: match, after: zone });
        action = 'update';
      }
    }
    plan.entries.push({ readIndex, zoneId: zone.id, name, action, channelIds, scanChannelIds });
  });
  return plan;
}
