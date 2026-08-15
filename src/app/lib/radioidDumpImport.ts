import {
  ingestRadioidUserDump,
  type RadioidDumpIngestOptions,
  type RadioidDumpIngestResult,
} from '@integrations/radioid/ingestUserDump.ts';

export type {
  RadioidDumpIngestProgress,
  RadioidDumpIngestResult,
} from '@integrations/radioid/ingestUserDump.ts';

export async function runRadioidDumpImport(
  options: RadioidDumpIngestOptions,
): Promise<RadioidDumpIngestResult> {
  return options.persistence.runWithoutNotifications(() => ingestRadioidUserDump(options));
}

export function formatRadioidDumpProgressPercent(
  bytesRead: number,
  totalBytes: number | null,
): number | null {
  if (totalBytes == null || totalBytes <= 0) return null;
  return Math.min(100, Math.round((bytesRead / totalBytes) * 100));
}
