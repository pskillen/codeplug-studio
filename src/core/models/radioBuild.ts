import type {
  ExpandRxGroupListMembers,
  MultiTalkGroupExportNameMode,
  DigitalContactExportNameMode,
} from '@core/import-export/types.ts';
import type { DualBankRadioWriteOptions } from '@core/domain/digitalIdDirectoryProjection.ts';
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

/** Channel distance display unit for the MM9PDY channel location table. */
export type ChannelDistanceUnit = 'km' | 'mi';

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
  /**
   * When true (default), channels outside the radio target's supported frequency ranges are
   * hidden from Radio Build lists and omitted from export.
   */
  hideChannelsOutsideFrequencyRange?: boolean;
  /** AT-D890UV `ScanList.CSV` Look Back Time A[s] (0.5–5.0). Unset → 3.0 s. */
  scanListLookBackASeconds?: number;
  /** AT-D890UV `ScanList.CSV` Look Back Time B[s] (0.5–5.0). Unset → 3.0 s. */
  scanListLookBackBSeconds?: number;
  /** AT-D890UV `ScanList.CSV` Dropout Delay Time[s] (0.1–5.0). Unset → 3.0 s. */
  scanListDropoutDelaySeconds?: number;
  /** AT-D890UV `ScanList.CSV` Dwell Time[s] (0.1–5.0). Unset → 3.0 s. */
  scanListDwellTimeSeconds?: number;
  /**
   * DM-32UV MM9PDY only. When true, Write sets P1 short to TG previous and P2 short to TG next.
   * Ignored on the AT-D890UV since #1393 (old projects and YAML files may still carry it; it loads,
   * saves and validates, and produces no patch). The D890's step keys come from the Review nudge.
   */
  assignMm9pdyStepKeys?: boolean;
  /**
   * RT95 MM9PDY only. Put Zone on a P-key: Write sets that one key-table byte to the stock DIR
   * function (the MM9PDY firmware opens the zone selector on it). Absent = off, key table as read.
   */
  rt95ZoneKey?: { group: 1 | 2; key: 1 | 2 | 3 | 4 | 5 | 6 };
  /**
   * MM9PDY AT-D890UV and DM-32UV only. Unit the modded firmware shows channel distances in;
   * written into the channel location table header on Write. Unset → kilometres.
   */
  channelDistanceUnit?: ChannelDistanceUnit;
  /** CPS export: dual-bank directory toggles (`SeparateDigitalIdList` profiles). */
  cpsDualBankDirectory?: DualBankRadioWriteOptions;
  /**
   * @deprecated Pre-#1433 Anytone single-bank CPS mode. Read once as a fallback for
   * cpsDualBankDirectory; never written.
   */
  cpsSingleBankProjectionMode?: 'contacts-only' | 'directory-only' | 'merge' | 'skip';
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
   * RT95 MM9PDY channel description override; other targets ignore it. An explicit empty string
   * means "no description" (distinct from unset, which derives it from the channel Name).
   */
  wireDescription?: string;
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
  /**
   * OpenGD77 satellite bank slot this transmitter occupies on this build (`fm` = Freq 1,
   * `aprs` = Freq 2, `beacon` = Freq 3). Ignored by D890. Keyed by transmitter UUID.
   */
  satelliteBankSlot?: 'fm' | 'aprs' | 'beacon';
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
  /** Per-transmitter encoded wire name overrides for keps write (sparse — `libraryEntityId` = transmitter id). */
  satelliteOverrides: BuildEntityOverride[];
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
  /**
   * Denormalised default pathway ids — mirror the egress row so assemble/preview can
   * resolve format/profile without loading egress paths (#654).
   */
  defaultEgressFormatId?: string;
  defaultEgressProfileId?: string;
}
