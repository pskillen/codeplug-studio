/** Canonical format ids — shared by registry and future UI. */
export type FormatId = 'native-yaml' | 'opengd77' | 'chirp' | 'dm32' | 'qdmr';

export type FormatStatus = 'shipped' | 'planned';

export type ImportDelivery = 'single-file' | 'multi-file';

export type ExportDelivery = 'single-file' | 'multi-file';

export type ImportEntityKind =
  | 'channels'
  | 'zones'
  | 'contacts'
  | 'talkGroups'
  | 'dtmfContacts'
  | 'rxGroupLists';

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

export interface ImportDocumentResult extends ExportResult {
  project: import('./projectDocument.ts').ProjectAggregate;
}
