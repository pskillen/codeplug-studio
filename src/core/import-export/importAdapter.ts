import type { ProjectAggregate } from './projectDocument.ts';
import type {
  FormatId,
  FormatStatus,
  ImportAdapterCapabilities,
  ImportDocumentResult,
  ImportEntityKind,
  ImportFileKind,
} from './types.ts';

/** Passed to profile-aware CPS parsers (Phase 4+). */
export interface ImportParseContext {
  profileId: string;
}

export interface BaseImportAdapter {
  readonly id: FormatId;
  readonly label: string;
  readonly status: FormatStatus;
  readonly capabilities: ImportAdapterCapabilities;
}

/** Full-project single-file interchange (native YAML). */
export interface SingleFileProjectImportAdapter extends BaseImportAdapter {
  readonly capabilities: ImportAdapterCapabilities & { delivery: 'single-file' };
  parseDocument(text: string): ImportDocumentResult;
}

/** CPS batch import — one file per entity kind (Phase 4+). */
export interface MultiFileImportAdapter extends BaseImportAdapter {
  readonly capabilities: ImportAdapterCapabilities & { delivery: 'multi-file' };
  detectKind(fileName: string, headerRow: string[]): ImportFileKind;
  parseChannels(text: string, ctx?: ImportParseContext): never;
}

export type ImportAdapter = SingleFileProjectImportAdapter | MultiFileImportAdapter;

export function isSingleFileProjectImportAdapter(
  adapter: ImportAdapter,
): adapter is SingleFileProjectImportAdapter {
  return adapter.capabilities.delivery === 'single-file';
}

export function isMultiFileImportAdapter(adapter: ImportAdapter): adapter is MultiFileImportAdapter {
  return adapter.capabilities.delivery === 'multi-file';
}

export function adapterSupportsKind(
  adapter: ImportAdapter,
  kind: ImportFileKind,
): kind is ImportEntityKind {
  if (!isMultiFileImportAdapter(adapter)) return false;
  return kind !== 'unknown' && adapter.capabilities.entityKinds.includes(kind);
}

export type { ProjectAggregate };
