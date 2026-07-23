import type {
  ExpandRxGroupListMembers,
  MultiTalkGroupExportNameMode,
  DigitalContactExportNameMode,
} from '@core/import-export/types.ts';
import type {
  AnalogSquelchMode,
  EffectiveForbidTransmit,
  SendTalkerAliasMode,
  TxPermitMode,
} from './channelBehaviourDefaults.ts';
import type { ChannelExportNameMode, ScanInclusion } from './library.ts';
import type { PersistableRow } from './revision.ts';
import type { TraitLayout } from './traitLayout.ts';

/** How channels with `scanInclusion: default` serialise when build omits an override. */
export type DefaultScanInclusion = 'skip' | 'scan';

/**
 * Per-radio-build export preferences — persisted on {@link RadioBuild}.
 * These affect `assemble` (wire names, expansion, scan defaults), not a single CPS egress.
 */
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
  /**
   * Build override: default zone-derived scan membership when member override is `default`
   * (wins over library zoneDefaults when set).
   */
  defaultIncludeInZoneDerivedScanList?: boolean;
}

/**
 * Sparse per-entity customisation for a radio build.
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
  /**
   * Per-build scan participation for flat-memory / per-channel scan flag profiles.
   * When set, wins over library `Channel.scanInclusion` at export (then build/format default).
   */
  scanInclusion?: ScanInclusion;
}

/**
 * Radio-centric build — one **named configuration** for a catalog radio target
 * (wire names, slots, inclusions, trait layout). Not unique per `radioTargetId`:
 * a project may hold many builds for the same handheld type (e.g. “UV-5R Team A”
 * vs “UV-5R Team B”) sharing the library but with different overrides / scan
 * settings. Each build owns its own {@link EgressPath} children for Web Serial /
 * CPS file pathways (#654).
 */
export interface RadioBuild extends PersistableRow {
  /**
   * Catalog radio target id (e.g. `baofeng-uv5r-mini`).
   * Many builds in one project may share the same id — identity is {@link PersistableRow.id}.
   */
  radioTargetId: string;
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
  /** Assemble-affecting preferences (name shortening, scan defaults, …). */
  exportSettings?: BuildExportSettings;
  /** Preferred egress for Export UI. */
  defaultEgressPathId?: string;
}
