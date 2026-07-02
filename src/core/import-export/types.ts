import type { MultiTalkGroupExportNameMode } from './channelExpansion/multiTalkGroupWireName.ts';

/** Canonical format ids — shared by registry and future UI. */
export type FormatId = 'native-yaml' | 'opengd77' | 'chirp' | 'dm32' | 'qdmr';

export type { MultiTalkGroupExportNameMode } from './channelExpansion/multiTalkGroupWireName.ts';
export { DEFAULT_MULTI_TG_EXPORT_NAME_MODE } from './channelExpansion/multiTalkGroupWireName.ts';

export type ExpandRxGroupListMembers = 'all' | 'talkGroupsOnly';

export type FormatStatus = 'shipped' | 'planned';

export type ImportDelivery = 'single-file' | 'multi-file';

export type ExportDelivery = 'single-file' | 'multi-file';

export type ImportEntityKind =
  'channels' | 'zones' | 'contacts' | 'talkGroups' | 'dtmfContacts' | 'rxGroupLists';

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
}

export interface ImportDocumentResult extends ExportResult {
  project: import('./projectDocument.ts').ProjectAggregate;
}
