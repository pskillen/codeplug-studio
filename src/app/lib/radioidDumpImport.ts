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

export function formatRadioidDumpDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} sec`;
  return `${minutes} mins ${seconds} sec`;
}

export function estimateRadioidDumpRemainingMs(
  elapsedMs: number,
  bytesRead: number,
  totalBytes: number | null,
): number | null {
  if (totalBytes == null || totalBytes <= 0 || bytesRead <= 0 || elapsedMs <= 0) {
    return null;
  }
  const remainingBytes = totalBytes - bytesRead;
  if (remainingBytes <= 0) return 0;
  return (remainingBytes / bytesRead) * elapsedMs;
}
