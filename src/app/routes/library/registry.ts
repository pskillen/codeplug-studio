import type { Library } from '@core/models/library.ts';
import type { PersistableRow } from '@core/models/revision.ts';
import type { LibraryEntityKind } from '@integrations/persistence/index.ts';

export interface LibraryKindMeta {
  kind: LibraryEntityKind;
  slug: string;
  label: string;
  plural: string;
}

export const LIBRARY_KINDS: LibraryKindMeta[] = [
  { kind: 'channel', slug: 'channels', label: 'Channel', plural: 'Channels' },
  { kind: 'talkGroup', slug: 'talk-groups', label: 'Talk group', plural: 'Talk groups' },
  {
    kind: 'digitalContact',
    slug: 'digital-contacts',
    label: 'Digital contact',
    plural: 'Digital contacts',
  },
  {
    kind: 'analogContact',
    slug: 'analog-contacts',
    label: 'Analog contact',
    plural: 'Analog contacts',
  },
  { kind: 'rxGroupList', slug: 'rx-group-lists', label: 'RX group list', plural: 'RX group lists' },
  { kind: 'scanList', slug: 'scan-lists', label: 'Scan list', plural: 'Scan lists' },
  {
    kind: 'aprsConfiguration',
    slug: 'aprs-configuration',
    label: 'APRS configuration',
    plural: 'APRS configuration',
  },
  { kind: 'zone', slug: 'zones', label: 'Zone', plural: 'Zones' },
];

export function kindBySlug(slug: string): LibraryKindMeta | undefined {
  return LIBRARY_KINDS.find((k) => k.slug === slug);
}

export function kindMeta(kind: LibraryEntityKind): LibraryKindMeta {
  const meta = LIBRARY_KINDS.find((k) => k.kind === kind);
  if (!meta) throw new Error(`Unknown library kind: ${kind}`);
  return meta;
}

export type NamedRow = PersistableRow & { name: string };

export function entitiesForKind(library: Library, kind: LibraryEntityKind): NamedRow[] {
  switch (kind) {
    case 'channel':
      return library.channels;
    case 'talkGroup':
      return library.talkGroups;
    case 'digitalContact':
      return library.digitalContacts;
    case 'analogContact':
      return library.analogContacts;
    case 'rxGroupList':
      return library.rxGroupLists;
    case 'scanList':
      return library.scanLists;
    case 'aprsConfiguration':
      return library.aprsConfiguration ? [library.aprsConfiguration] : [];
    case 'zone':
      return library.zones;
  }
}

/** Short secondary description for list rows. */
export function describeEntity(library: Library, kind: LibraryEntityKind, id: string): string {
  switch (kind) {
    case 'channel': {
      const c = library.channels.find((x) => x.id === id);
      if (!c) return '';
      const modes = c.modeProfiles.map((p) => p.mode.toUpperCase());
      const modeLabel = modes.length > 0 ? modes.join(' + ') : '—';
      const rx = c.rxFrequency ? `${(c.rxFrequency / 1_000_000).toFixed(4)} MHz` : 'no RX';
      return `${modeLabel} · ${rx}`;
    }
    case 'talkGroup': {
      const t = library.talkGroups.find((x) => x.id === id);
      return t ? `${t.mode.toUpperCase()} · ID ${t.digitalId}` : '';
    }
    case 'digitalContact': {
      const d = library.digitalContacts.find((x) => x.id === id);
      return d ? `${d.mode.toUpperCase()} · ID ${d.digitalId}` : '';
    }
    case 'analogContact': {
      const a = library.analogContacts.find((x) => x.id === id);
      return a ? a.code : '';
    }
    case 'rxGroupList': {
      const r = library.rxGroupLists.find((x) => x.id === id);
      return r ? `${r.members.length} member(s)` : '';
    }
    case 'scanList': {
      const s = library.scanLists.find((x) => x.id === id);
      return s ? `${s.memberChannelIds.length} channel(s)` : '';
    }
    case 'aprsConfiguration': {
      const c = library.aprsConfiguration;
      if (!c) return '';
      const slots = `${c.channelSlots.length} slot(s)`;
      const position = c.positionSource === 'fixed' ? 'fixed' : 'GPS';
      return `${slots} · ${position}`;
    }
    case 'zone': {
      const z = library.zones.find((x) => x.id === id);
      return z ? `${z.members.length} channel(s)` : '';
    }
  }
}
