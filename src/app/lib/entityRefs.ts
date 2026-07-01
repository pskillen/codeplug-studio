import type { EntityRef, Library } from '@core/models/library.ts';

export function entityRefDisplayName(ref: EntityRef | null, library: Library): string {
  if (!ref) return '';
  switch (ref.kind) {
    case 'channel':
      return library.channels.find((c) => c.id === ref.id)?.name ?? '';
    case 'talkGroup':
      return library.talkGroups.find((t) => t.id === ref.id)?.name ?? '';
    case 'digitalContact':
      return library.digitalContacts.find((c) => c.id === ref.id)?.name ?? '';
    case 'analogContact':
      return library.analogContacts.find((c) => c.id === ref.id)?.name ?? '';
  }
}

export function dmrContactDisplayName(library: Library, channelId: string): string {
  const channel = library.channels.find((c) => c.id === channelId);
  if (!channel) return '';
  const dmr = channel.modeProfiles.find((p) => p.mode === 'dmr');
  if (!dmr || dmr.mode !== 'dmr' || !dmr.contactRef) return '';
  return entityRefDisplayName(dmr.contactRef, library);
}

export function dmrRxGroupListName(library: Library, channelId: string): string {
  const channel = library.channels.find((c) => c.id === channelId);
  if (!channel) return '';
  const dmr = channel.modeProfiles.find((p) => p.mode === 'dmr');
  if (!dmr || dmr.mode !== 'dmr' || !dmr.rxGroupListId) return '';
  return library.rxGroupLists.find((r) => r.id === dmr.rxGroupListId)?.name ?? '';
}
