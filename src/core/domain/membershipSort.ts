import type {
  Channel,
  DigitalContact,
  RxGroupListMember,
  TalkGroup,
  Zone,
  ZoneMemberEntry,
} from '@core/models/library.ts';
import { bandForFrequencyHz } from '@core/domain/bandPlan.ts';
import { applyDenseZoneOrders } from '@core/domain/zoneOrder.ts';
import { normalizeZoneMemberEntry } from '@core/domain/zoneMembers.ts';
import { rxGroupListMemberKey } from '@core/domain/membershipOrder.ts';

/** One-shot library sort modes (rewrite order; not a persisted export setting). */
export type MembershipSortMode = 'name' | 'callsign' | 'duplex' | 'band' | 'mode';

export const MEMBERSHIP_SORT_MODE_LABELS: Record<MembershipSortMode, string> = {
  name: 'Alphabetical by name',
  callsign: 'Alphabetical by callsign',
  duplex: 'Simplex, then split',
  band: 'By band',
  mode: 'By mode',
};

function isSimplex(rxHz: number | null, txHz: number | null): boolean {
  if (rxHz == null || txHz == null) return false;
  return rxHz === txHz;
}

function primaryMode(channel: Channel): string {
  return channel.modeProfiles[0]?.mode ?? 'fm';
}

function channelSortTuple(channel: Channel, mode: MembershipSortMode): (string | number)[] {
  const name = channel.name;
  switch (mode) {
    case 'name':
      return [name.toLocaleLowerCase(), name];
    case 'callsign': {
      const call = channel.callsign.trim();
      return [call ? 0 : 1, call.toLocaleLowerCase(), name.toLocaleLowerCase()];
    }
    case 'duplex':
      return [
        isSimplex(channel.rxFrequency, channel.txFrequency) ? 0 : 1,
        name.toLocaleLowerCase(),
      ];
    case 'band': {
      const band = bandForFrequencyHz(channel.rxFrequency);
      return [band?.startHz ?? Number.MAX_SAFE_INTEGER, name.toLocaleLowerCase()];
    }
    case 'mode':
      return [primaryMode(channel), name.toLocaleLowerCase()];
  }
}

function compareTuples(a: (string | number)[], b: (string | number)[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const av = a[i] ?? '';
    const bv = b[i] ?? '';
    if (typeof av === 'number' && typeof bv === 'number') {
      if (av !== bv) return av - bv;
      continue;
    }
    const cmp = String(av).localeCompare(String(bv));
    if (cmp !== 0) return cmp;
  }
  return 0;
}

/** Sort channel ids by library channel fields; unknown ids append at end. */
export function sortChannelIdsByMode(
  channelIds: string[],
  channelsById: ReadonlyMap<string, Channel>,
  mode: MembershipSortMode,
): string[] {
  return [...channelIds].sort((idA, idB) => {
    const a = channelsById.get(idA);
    const b = channelsById.get(idB);
    if (!a && !b) return idA.localeCompare(idB);
    if (!a) return 1;
    if (!b) return -1;
    return compareTuples(channelSortTuple(a, mode), channelSortTuple(b, mode));
  });
}

/** Rewrite zone member order (channels + nested zones). */
export function sortZoneMembersByMode(
  members: ZoneMemberEntry[],
  channelsById: ReadonlyMap<string, Channel>,
  zonesById: ReadonlyMap<string, Zone>,
  mode: MembershipSortMode,
): ZoneMemberEntry[] {
  const normalized = members.map((m) => normalizeZoneMemberEntry(m));
  return [...normalized].sort((left, right) => {
    if (left.kind === 'channel' && right.kind === 'channel') {
      const a = channelsById.get(left.channelId);
      const b = channelsById.get(right.channelId);
      if (!a && !b) return left.channelId.localeCompare(right.channelId);
      if (!a) return 1;
      if (!b) return -1;
      return compareTuples(channelSortTuple(a, mode), channelSortTuple(b, mode));
    }
    if (left.kind === 'zone' && right.kind === 'zone') {
      const a = zonesById.get(left.zoneId)?.name ?? left.zoneId;
      const b = zonesById.get(right.zoneId)?.name ?? right.zoneId;
      return a.localeCompare(b);
    }
    // Channels before nested zones when mixed kinds differ under channel-oriented sorts.
    if (left.kind === 'channel') return -1;
    return 1;
  });
}

function entityName(
  member: RxGroupListMember,
  talkGroupsById: ReadonlyMap<string, TalkGroup>,
  digitalContactsById: ReadonlyMap<string, DigitalContact>,
): string {
  if (member.ref.kind === 'talkGroup') {
    return talkGroupsById.get(member.ref.id)?.name ?? member.ref.id;
  }
  return digitalContactsById.get(member.ref.id)?.name ?? member.ref.id;
}

/** Sort RGL members by entity display name (callsign mode uses contact callsign when present). */
export function sortRxGroupListMembersByMode(
  members: RxGroupListMember[],
  talkGroupsById: ReadonlyMap<string, TalkGroup>,
  digitalContactsById: ReadonlyMap<string, DigitalContact>,
  mode: MembershipSortMode,
): RxGroupListMember[] {
  return [...members].sort((left, right) => {
    if (mode === 'callsign') {
      const leftCall =
        left.ref.kind === 'digitalContact'
          ? (digitalContactsById.get(left.ref.id)?.callsign.trim() ?? '')
          : '';
      const rightCall =
        right.ref.kind === 'digitalContact'
          ? (digitalContactsById.get(right.ref.id)?.callsign.trim() ?? '')
          : '';
      const callCmp = compareTuples(
        [leftCall ? 0 : 1, leftCall.toLocaleLowerCase()],
        [rightCall ? 0 : 1, rightCall.toLocaleLowerCase()],
      );
      if (callCmp !== 0) return callCmp;
    }
    const nameCmp = entityName(left, talkGroupsById, digitalContactsById).localeCompare(
      entityName(right, talkGroupsById, digitalContactsById),
    );
    if (nameCmp !== 0) return nameCmp;
    return rxGroupListMemberKey(left).localeCompare(rxGroupListMemberKey(right));
  });
}

/** Apply dense Zone.order after sorting zones by name (only `name` mode is meaningful). */
export function sortZonesByName(zones: Zone[]): Zone[] {
  const ordered = [...zones].sort((a, b) => a.name.localeCompare(b.name));
  return applyDenseZoneOrders(
    zones,
    ordered.map((z) => z.id),
  );
}

export function membershipSortConfirmMessage(mode: MembershipSortMode): string {
  return (
    `Sort by “${MEMBERSHIP_SORT_MODE_LABELS[mode]}”?\n\n` +
    'This overwrites the current order. Restoring it requires manual reorder or another Sort.'
  );
}

/** Confirm copy for build/export one-shot Sort… (does not rewrite the library). */
export function buildExportSortConfirmMessage(mode: MembershipSortMode): string {
  return (
    `Sort this build’s export order by “${MEMBERSHIP_SORT_MODE_LABELS[mode]}”?\n\n` +
    'This only changes this radio build. Your library order stays the same. ' +
    'Existing build order overrides for this list will be replaced.'
  );
}
