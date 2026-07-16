import type { ChannelBehaviourContext } from './channelBehaviourDefaults/resolve.ts';
import type { DefaultScanInclusion } from '@core/models/formatBuild.ts';
import type { MultiTalkGroupExportNameMode } from './channelExpansion/multiTalkGroupWireName.ts';
import type { DigitalContactExportNameMode } from './digitalContactExportName.ts';

/** Canonical format ids — shared by registry and future UI. */
export type FormatId = 'native-yaml' | 'opengd77' | 'chirp' | 'dm32' | 'anytone' | 'qdmr';

export type { MultiTalkGroupExportNameMode } from './channelExpansion/multiTalkGroupWireName.ts';
export { DEFAULT_MULTI_TG_EXPORT_NAME_MODE } from './channelExpansion/multiTalkGroupWireName.ts';
export type { DigitalContactExportNameMode } from './digitalContactExportName.ts';
export {
  DEFAULT_DIGITAL_CONTACT_EXPORT_NAME_MODE,
  DIGITAL_CONTACT_EXPORT_NAME_MODES,
  digitalContactExportNameModeLabel,
  isDigitalContactExportNameMode,
} from './digitalContactExportName.ts';

export type { DefaultScanInclusion } from '@core/models/formatBuild.ts';

export type ExpandRxGroupListMembers = 'all' | 'talkGroupsOnly';

/** Format-level export defaults — registered per CPS adapter. */
export interface FormatExportDefaults {
  defaultScanInclusion: DefaultScanInclusion;
  expandModes?: boolean;
  expandRxGroupLists?: boolean;
  /** When false, skip zone-derived scan list synthesis. Format-specific default. */
  exportZoneDerivedScanLists?: boolean;
  /** When true with expandRxGroupLists, emit scratch companion rows. Format-specific default. */
  exportScratchChannels?: boolean;
}

export type FormatStatus = 'shipped' | 'planned';

export type ImportDelivery = 'single-file' | 'multi-file';

export type ExportDelivery = 'single-file' | 'multi-file';

export type ImportEntityKind =
  | 'channels'
  | 'zones'
  | 'contacts'
  | 'talkGroups'
  | 'dtmfContacts'
  | 'rxGroupLists'
  | 'scanLists'
  | 'radioIds';

export type ImportFileKind = ImportEntityKind | 'unknown';

export interface ImportAdapterCapabilities {
  delivery: ImportDelivery;
  /** Entity kinds this adapter can parse (CPS multi-file adapters). */
  entityKinds: readonly ImportEntityKind[];
}

export interface FormatCatalogEntry {
  id: FormatId;
  label: string;
  importStatus: FormatStatus;
  exportStatus: FormatStatus;
  issue?: string;
}

export interface ExportResult {
  warnings: string[];
}

export interface ExportSerialiseResult extends ExportResult {
  content: string;
}

/** CPS multi-file export options — profile limits apply at adapter boundary only. */
export interface CpsExportOptions {
  /** Radio variant profile — defaults to build `profileId`. */
  profileId?: string;
  /** Suggested download filename for ZIP export. */
  fileName?: string;
  /** When false, multi-mode channels stay on one wire row. Default true. */
  expandModes?: boolean;
  /** Target max channel wire name length; defaults to profile `nameLimit`. */
  maxNameLength?: number;
  /** Shorten names that exceed `maxNameLength`. Default true. */
  shortenNames?: boolean;
  /** Force all channels to this export name mode for this export only. */
  nameModeOverride?: string;
  /** Use talk group abbreviation in composed wire names. */
  useTalkGroupAbbreviation?: boolean;
  /** Use channel abbreviation in composed wire names. */
  useChannelAbbreviation?: boolean;
  /** Expand logical channels with RX group lists into one row per member (formats without native RGL). */
  expandRxGroupLists?: boolean;
  /** Which RX list members to expand when expandRxGroupLists is true. Default `all`. */
  expandRxGroupListMembers?: ExpandRxGroupListMembers;
  /** How multi-TG expanded rows compose wire names. Default `callsign_tg_abbrev`. */
  multiTalkGroupExportNameMode?: MultiTalkGroupExportNameMode;
  /** How digital contact CPS `Name` is composed from library fields. Default `name`. */
  digitalContactExportNameMode?: DigitalContactExportNameMode;
  /** Build contact overrides — used to honour per-contact wire name overrides at export. */
  contactOverrides?: readonly import('@core/models/formatBuild.ts').BuildEntityOverride[];
  /** When false, skip zone-derived Scan.csv synthesis on DM32 export. Default true. */
  exportZoneDerivedScanLists?: boolean;
  /** When true with expandRxGroupLists, emit one scratch companion row per expanded repeater channel. */
  exportScratchChannels?: boolean;
  /** Resolved default for channels with `scanInclusion: default`. From build or format adapter. */
  defaultScanInclusion?: DefaultScanInclusion;
  /** Library + build cascade for channel behavioural defaults at export. */
  channelBehaviourContext?: ChannelBehaviourContext;
  /** Project display name — used for Anytone `.LST` manifest filename stem. */
  projectName?: string;
}

export interface ImportDocumentResult extends ExportResult {
  project: import('./projectDocument.ts').ProjectAggregate;
}
