import type { AssembledBuild } from '@core/services/assemble.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { ChannelMode, DMRTimeSlot, EntityRef } from '@core/models/libraryTypes.ts';
import type { TalkGroupTimeslotCloneIndex } from '@core/import-export/channelExpansion/talkGroupTimeslotClones.ts';
import { isDigitalMode } from './channelModes.ts';

export function primaryChannelMode(channel: Channel): ChannelMode {
  return channel.modeProfiles[0]?.mode ?? 'fm';
}

export function primaryModeProfile(channel: Channel): ChannelModeProfile | null {
  return channel.modeProfiles[0] ?? null;
}

export interface ContactRefWireNameOptions {
  cloneIndex?: TalkGroupTimeslotCloneIndex | null;
  channelTimeslot?: DMRTimeSlot | null;
}

export function contactRefWireName(
  assembled: AssembledBuild,
  contactRef: EntityRef | null,
  mode: ChannelMode,
  opts?: ContactRefWireNameOptions,
): string {
  if (!contactRef) return isDigitalMode(mode) ? 'None' : '';

  if (contactRef.kind === 'talkGroup') {
    const row = assembled.talkGroups.find((t) => t.entity.id === contactRef.id);
    if (opts?.cloneIndex) {
      const slot = opts.cloneIndex.resolveTxSlot(opts.channelTimeslot);
      const cloneName = opts.cloneIndex.wireNameFor(contactRef.id, slot);
      if (cloneName) return cloneName;
    }
    return row?.wireName ?? (isDigitalMode(mode) ? 'None' : '');
  }
  if (contactRef.kind === 'digitalContact') {
    const row = assembled.digitalContacts.find((c) => c.entity.id === contactRef.id);
    return row?.wireName ?? (isDigitalMode(mode) ? 'None' : '');
  }
  if (contactRef.kind === 'analogContact') {
    const row = assembled.analogContacts.find((c) => c.entity.id === contactRef.id);
    return row?.wireName ?? '';
  }
  return isDigitalMode(mode) ? 'None' : '';
}

export function rxGroupListWireName(
  assembled: AssembledBuild,
  listId: string | null,
  mode: ChannelMode,
): string {
  if (!listId) return isDigitalMode(mode) ? 'None' : '';
  const row = assembled.rxGroupLists.find((r) => r.entity.id === listId);
  return row?.wireName ?? (isDigitalMode(mode) ? 'None' : '');
}

export function memberRefWireName(
  assembled: AssembledBuild,
  ref: EntityRef,
  opts?: {
    cloneIndex?: TalkGroupTimeslotCloneIndex | null;
    memberTimeSlotOverride?: DMRTimeSlot | null;
  },
): string {
  switch (ref.kind) {
    case 'talkGroup': {
      if (opts?.cloneIndex) {
        const slot = opts.cloneIndex.resolveRxMemberSlot(opts.memberTimeSlotOverride);
        const cloneName = opts.cloneIndex.wireNameFor(ref.id, slot);
        if (cloneName) return cloneName;
      }
      return assembled.talkGroups.find((t) => t.entity.id === ref.id)?.wireName ?? '';
    }
    case 'digitalContact':
      return assembled.digitalContacts.find((c) => c.entity.id === ref.id)?.wireName ?? '';
    case 'analogContact':
      return assembled.analogContacts.find((c) => c.entity.id === ref.id)?.wireName ?? '';
    default:
      return '';
  }
}

export function channelWireNameById(assembled: AssembledBuild): Map<string, string> {
  return new Map(
    assembled.channels.flatMap((row) =>
      row.wireNameOverride ? [[row.entity.id, row.wireNameOverride] as const] : [],
    ),
  );
}
