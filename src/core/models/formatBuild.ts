import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';

/**
 * Sparse per-entity customisation for a format build.
 * No row → entity included with generated wire name at export.
 */
export interface BuildEntityOverride {
  libraryEntityId: string;
  excluded?: boolean;
  wireName?: string;
}

export interface FormatBuild extends PersistableRow {
  formatId: string;
  profileId: string;
  name: string;
  layout: TraitLayout;
  channelOverrides: BuildEntityOverride[];
  zoneOverrides: BuildEntityOverride[];
  talkGroupOverrides: BuildEntityOverride[];
  rxGroupListOverrides: BuildEntityOverride[];
  contactOverrides: BuildEntityOverride[];
  /** Include library channels not in any zone member list. Default true. */
  exportUnlinkedChannels?: boolean;
  /** Include talk groups not referenced by exported channels. Default true. */
  exportUnlinkedTalkGroups?: boolean;
  /** Include RX group lists not referenced by exported channels. Default true. */
  exportUnlinkedRxGroupLists?: boolean;
}
