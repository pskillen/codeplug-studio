import { parseCsv } from '@core/import-export/csvParse.ts';
import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '../persistence/types.ts';
import { resolveApiUrl } from '../platform/resolveApiUrl.ts';
import {
  RADIOID_NETWORK_ERROR_MESSAGE,
  RADIOID_USER_DUMP_PROXY_PATH,
} from './constants.ts';
import { RadioidDirectoryError } from './errors.ts';
import {
  buildRadioidDumpHeaderIndex,
  mapRadioidDumpRowToDirectoryEntry,
} from './mapDumpRowToDirectoryEntry.ts';

export const RADIOID_DUMP_BATCH_SIZE = 250;

export interface RadioidDumpIngestProgress {
  written: number;
  skipped: number;
  failed: number;
  bytesRead: number;
  totalBytes: number | null;
  message: string;
}

export interface RadioidDumpIngestResult {
  written: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  error: string | null;
}

export interface RadioidDumpIngestOptions {
  projectId: string;
  persistence: ProjectPersistence;
  url?: string;
  onProgress: (progress: RadioidDumpIngestProgress) => void;
  signal?: AbortSignal;
}

function parseCsvLine(line: string): string[] {
  const rows = parseCsv(line);
  return rows[0] ?? [];
}

async function* iterateLines(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<string> {
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let newlineIndex = buffer.indexOf('\n');
    while (newlineIndex >= 0) {
      let line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (line.length > 0) yield line;
      newlineIndex = buffer.indexOf('\n');
    }
  }

  if (buffer.length > 0) {
    const line = buffer.endsWith('\r') ? buffer.slice(0, -1) : buffer;
    if (line.length > 0) yield line;
  }
}

async function flushBatch(
  batch: DigitalIdDirectoryEntry[],
  persistence: ProjectPersistence,
  counts: Pick<RadioidDumpIngestResult, 'written' | 'failed'>,
): Promise<void> {
  if (batch.length === 0) return;
  try {
    const result = await persistence.putDigitalIdDirectoryEntriesBatch(batch);
    counts.written += result.written;
  } catch {
    counts.failed += batch.length;
  }
}

export async function ingestRadioidUserDump(
  options: RadioidDumpIngestOptions,
): Promise<RadioidDumpIngestResult> {
  const url = options.url ?? resolveApiUrl(RADIOID_USER_DUMP_PROXY_PATH);
  const counts = { written: 0, skipped: 0, failed: 0 };
  let bytesRead = 0;
  let cancelled = false;

  const report = (message: string, totalBytes: number | null = null) => {
    options.onProgress({
      written: counts.written,
      skipped: counts.skipped,
      failed: counts.failed,
      bytesRead,
      totalBytes,
      message,
    });
  };

  let response: Response;
  try {
    response = await fetch(url, { signal: options.signal });
  } catch (err) {
    if (options.signal?.aborted) {
      return { ...counts, cancelled: true, error: null };
    }
    throw new RadioidDirectoryError(RADIOID_NETWORK_ERROR_MESSAGE);
  }

  if (!response.ok || !response.body) {
    throw new RadioidDirectoryError(`RadioID.net dump returned ${response.status}.`, response.status);
  }

  const totalBytesHeader = response.headers.get('Content-Length');
  const totalBytes = totalBytesHeader ? Number.parseInt(totalBytesHeader, 10) : null;
  const fetchedAt = new Date().toISOString();

  report('Downloading user database…', Number.isFinite(totalBytes) ? totalBytes : null);

  const reader = response.body.getReader();
  let headerIndex: Map<string, number> | null = null;
  const batch: DigitalIdDirectoryEntry[] = [];

  try {
    for await (const line of iterateLines(reader)) {
      if (options.signal?.aborted) {
        cancelled = true;
        break;
      }

      bytesRead += line.length + 1;

      const fields = parseCsvLine(line);
      if (fields.length === 0) continue;

      if (!headerIndex) {
        headerIndex = buildRadioidDumpHeaderIndex(fields);
        if (!headerIndex.has('RADIO_ID')) {
          throw new RadioidDirectoryError('RadioID.net dump is missing a RADIO_ID column.');
        }
        continue;
      }

      const entry = mapRadioidDumpRowToDirectoryEntry(
        fields,
        headerIndex,
        options.projectId,
        fetchedAt,
      );
      if (!entry) {
        counts.skipped += 1;
        continue;
      }

      batch.push(entry);
      if (batch.length >= RADIOID_DUMP_BATCH_SIZE) {
        const toWrite = batch.splice(0, batch.length);
        await flushBatch(toWrite, options.persistence, counts);
        report(`Imported ${counts.written.toLocaleString()} IDs…`, totalBytes);
      }
    }

    if (!cancelled && batch.length > 0) {
      await flushBatch(batch, options.persistence, counts);
    }
  } catch (err) {
    if (options.signal?.aborted) {
      cancelled = true;
    } else if (err instanceof RadioidDirectoryError) {
      return { ...counts, cancelled, error: err.message };
    } else {
      return { ...counts, cancelled, error: 'Import failed — try again.' };
    }
  } finally {
    reader.releaseLock();
  }

  report(
    cancelled ? 'Import cancelled.' : `Finished — ${counts.written.toLocaleString()} IDs imported.`,
    totalBytes,
  );

  return { ...counts, cancelled, error: null };
}
