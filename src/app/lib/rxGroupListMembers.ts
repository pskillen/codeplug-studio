import type {
  DMRTimeSlot,
  EntityRef,
  Library,
  RxGroupListMember,
} from '@core/models/library.ts';
import { entityRefKey } from './entityRefs.ts';

export type RxGroupListMemberKindLabel = 'Talk group' | 'Digital contact';

export interface RxGroupListMemberDisplay {
  ref: EntityRef;
  name: string;
  kindLabel: RxGroupListMemberKindLabel;
  digitalId: number | null;
  timeSlotOverride: DMRTimeSlot | null | undefined;
  brokenRef: boolean;
}

export function formatTimeSlotOverride(slot?: DMRTimeSlot | null): string {
  if (slot === 1) return 'TS1';
  if (slot === 2) return 'TS2';
  return '—';
}

export function timeslotSegmentValue(member: RxGroupListMember): string {
  if (member.timeSlotOverride === 1) return '1';
  if (member.timeSlotOverride === 2) return '2';
  return 'auto';
}

export function applyTimeslotSegment(member: RxGroupListMember, value: string): RxGroupListMember {
  if (value === '1') return { ref: member.ref, timeSlotOverride: 1 };
  if (value === '2') return { ref: member.ref, timeSlotOverride: 2 };
  return { ref: member.ref };
}

export function memberSupportsTimeSlotOverride(
  member: RxGroupListMember,
  library: Library,
): boolean {
  if (member.ref.kind === 'talkGroup') return true;
  if (member.ref.kind === 'digitalContact') {
    const contact = library.digitalContacts.find((c) => c.id === member.ref.id);
    return contact?.mode === 'dmr';
  }
  return false;
}

export function resolveRxGroupListMemberDisplay(
  member: RxGroupListMember,
  library: Library,
): RxGroupListMemberDisplay {
  if (member.ref.kind === 'talkGroup') {
    const tg = library.talkGroups.find((t) => t.id === member.ref.id);
    if (!tg) {
      return {
        ref: member.ref,
        name: 'Missing talk group',
        kindLabel: 'Talk group',
        digitalId: null,
        timeSlotOverride: member.timeSlotOverride,
        brokenRef: true,
      };
    }
    return {
      ref: member.ref,
      name: tg.name,
      kindLabel: 'Talk group',
      digitalId: tg.digitalId,
      timeSlotOverride: member.timeSlotOverride,
      brokenRef: false,
    };
  }

  if (member.ref.kind === 'digitalContact') {
    const contact = library.digitalContacts.find((c) => c.id === member.ref.id);
    if (!contact) {
      return {
        ref: member.ref,
        name: 'Missing digital contact',
        kindLabel: 'Digital contact',
        digitalId: null,
        timeSlotOverride: member.timeSlotOverride,
        brokenRef: true,
      };
    }
    return {
      ref: member.ref,
      name: contact.name,
      kindLabel: 'Digital contact',
      digitalId: contact.digitalId,
      timeSlotOverride: member.timeSlotOverride,
      brokenRef: false,
    };
  }

  return {
    ref: member.ref,
    name: 'Unsupported member',
    kindLabel: 'Digital contact',
    digitalId: null,
    timeSlotOverride: member.timeSlotOverride,
    brokenRef: true,
  };
}

export function memberOptionMatchesFilter(
  name: string,
  digitalId: number | null,
  filterLower: string,
): boolean {
  if (!filterLower) return true;
  if (name.toLowerCase().includes(filterLower)) return true;
  if (digitalId != null && String(digitalId).includes(filterLower)) return true;
  return false;
}

export { entityRefKey };
