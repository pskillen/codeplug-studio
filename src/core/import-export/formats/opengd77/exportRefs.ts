import type { AssembledBuild } from '@core/services/assemble.ts';
import type { Channel, ChannelModeProfile } from '@core/models/library.ts';
import type { ChannelMode, EntityRef } from '@core/models/libraryTypes.ts';
import { isDigitalMode } from './channelModes.ts';

export function primaryChannelMode(channel: Channel): ChannelMode {
  return channel.modeProfiles[0]?.mode ?? 'fm';
}

export function primaryModeProfile(channel: Channel): ChannelModeProfile | null {
  return channel.modeProfiles[0] ?? null;
}

export function contactRefWireName(
  assembled: AssembledBuild,
  contactRef: EntityRef | null,
  mode: ChannelMode,
): string {
  if (!contactRef) return isDigitalMode(mode) ? 'None' : '';

  if (contactRef.kind === 'talkGroup') {
    const row = assembled.talkGroups.find((t) => t.entity.id === contactRef.id);
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

export function memberRefWireName(assembled: AssembledBuild, ref: EntityRef): string {
  switch (ref.kind) {
    case 'talkGroup':
      return assembled.talkGroups.find((t) => t.entity.id === ref.id)?.wireName ?? '';
    case 'digitalContact':
      return assembled.digitalContacts.find((c) => c.entity.id === ref.id)?.wireName ?? '';
    case 'analogContact':
      return assembled.analogContacts.find((c) => c.entity.id === ref.id)?.wireName ?? '';
    default:
      return '';
  }
}

export function channelWireNameById(assembled: AssembledBuild): Map<string, string> {
  return new Map(assembled.channels.map((c) => [c.entity.id, c.wireName]));
}
