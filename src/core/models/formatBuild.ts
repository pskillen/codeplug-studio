import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';
import type {
  ExpandRxGroupListMembers,
  MultiTalkGroupExportNameMode,
} from '@core/import-export/types.ts';
import type { ChannelExportNameMode } from './library.ts';

/** How channels with `scanInclusion: default` serialise when build omits an override. */
export type DefaultScanInclusion = 'skip' | 'scan';

/** Per-build export preferences — persisted on FormatBuild and native YAML. */
export interface BuildExportSettings {
  /** Override format default for `default` channels. */
  defaultScanInclusion?: DefaultScanInclusion;
  shortenNames?: boolean;
  maxNameLength?: number | null;
  nameModeOverride?: ChannelExportNameMode;
  useChannelAbbreviation?: boolean;
  useTalkGroupAbbreviation?: boolean;
  exportZoneDerivedScanLists?: boolean;
  multiTalkGroupExportNameMode?: MultiTalkGroupExportNameMode;
  expandModes?: boolean;
  expandRxGroupLists?: boolean;
  expandRxGroupListMembers?: ExpandRxGroupListMembers;
}

/**
 * Sparse per-entity customisation for a format build.
 * No row → entity included with generated wire name at export.
 */
export interface BuildEntityOverride {
  libraryEntityId: string;
  excluded?: boolean;
  /** Per-build override: export as standalone zone despite library `omitFromExport`. */
  forceInclude?: boolean;
  wireName?: string;
  /**
   * 1-based position in this entity kind's top-level export list.
   * CHIRP: memory Location; gaps between values become blank memory slots.
   * Unset → default placement after any explicit slots (library order).
   */
  orderOrSlot?: number;
  /** Build scan list entry id (`ScanListEntry.id`) for CPS scan list assignment. */
  scanListId?: string;
}

export interface FormatBuild extends PersistableRow {
  formatId: string;
  profileId: string;
  name: string;
  layout: TraitLayout;
  channelOverrides: BuildEntityOverride[];
  zoneOverrides: BuildEntityOverride[];
  scanListOverrides: BuildEntityOverride[];
  talkGroupOverrides: BuildEntityOverride[];
  rxGroupListOverrides: BuildEntityOverride[];
  contactOverrides: BuildEntityOverride[];
  /** Include library channels not in any zone member list. Default true. */
  exportUnlinkedChannels?: boolean;
  /** Include talk groups not referenced by exported channels. Default true. */
  exportUnlinkedTalkGroups?: boolean;
  /** Include RX group lists not referenced by exported channels. Default true. */
  exportUnlinkedRxGroupLists?: boolean;
  /** Export-affecting preferences for this build (name shortening, scan defaults, …). */
  exportSettings?: BuildExportSettings;
}
