import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';
import type {
  ExpandRxGroupListMembers,
  MultiTalkGroupExportNameMode,
  DigitalContactExportNameMode,
} from '@core/import-export/types.ts';
import type { ChannelExportNameMode } from './library.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from './channelBehaviourDefaults.ts';

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
  digitalContactExportNameMode?: DigitalContactExportNameMode;
  expandModes?: boolean;
  expandRxGroupLists?: boolean;
  expandRxGroupListMembers?: ExpandRxGroupListMembers;
  /** When true with expandRxGroupLists, emit one scratch companion row per expanded repeater channel. */
  exportScratchChannels?: boolean;
  /** Build override: effective TX deny when set (wins over library + channel). */
  defaultForbidTransmit?: EffectiveForbidTransmit;
  /** Build override: TX permit mode when set. */
  defaultTxPermit?: TxPermitMode;
  /** Build override: send talker alias when set. */
  defaultSendTalkerAlias?: SendTalkerAliasMode;
  /** Build override: analog squelch mode when set. */
  defaultAnalogSquelchMode?: AnalogSquelchMode;
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
  /** Include digital contacts not referenced by exported channels. Default true. */
  exportUnlinkedDigitalContacts?: boolean;
  /** Include analog contacts not referenced by exported channels. Default true. */
  exportUnlinkedAnalogContacts?: boolean;
  /** Export-affecting preferences for this build (name shortening, scan defaults, …). */
  exportSettings?: BuildExportSettings;
}
