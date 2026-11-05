/**
 * Collect the RadioID directory shadow for Write assemble — one linear pass over the primary key,
 * yielding between batches so the UI can paint and report progress without holding an IndexedDB
 * cursor open.
 *
 * Which rows survive a radio's cap, and the order they are emitted in, is the directory's name
 * order: lower-cased name, then Digital ID. That is the order the name index used to give, kept so
 * the owner sees the same rows. The linear pass keeps it with a bounded selection, so memory stays
 * near the cap rather than the directory size.
 */

import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import { DIRECTORY_STREAM_BATCH_SIZE } from '@integrations/persistence/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

const PROGRESS_THROTTLE_MS = 100;

export interface PageDigitalIdDirectoryForWriteArgs {
  store: ProjectPersistence;
  projectId: string;
  cap: number;
  onProgress?: ProgressFn;
  progressMsg?: string;
  /** Must be pure: it can run for rows that are later dropped by the cap. */
  acceptRow: (row: DigitalIdDirectoryEntry) => boolean;
  /** Called in name order, at most `cap` times. */
  onAcceptedRow: (row: DigitalIdDirectoryEntry) => void;
  /**
   * Called, in name order, for each rejected row that sorts before the last accepted row — the
   * rows a name-ordered walk would have stepped over before the cap filled.
   */
  onRejectedRow?: (row: DigitalIdDirectoryEntry) => void;
  /** Rows per primary-key batch. Defaults to {@link DIRECTORY_STREAM_BATCH_SIZE}. */
  batchSize?: number;
  /** Test hook: called with the buffer length after each batch is added, before it is cut. */
  onBufferLength?: (length: number) => void;
}

export interface PageDigitalIdDirectoryForWriteResult {
  total: number;
  collected: number;
}

interface Candidate {
  row: DigitalIdDirectoryEntry;
  nameLower: string;
  accepted: boolean;
}

/** Name order: lower-cased name by UTF-16 code unit (as an IndexedDB index key), then Digital ID. */
function compareNameOrder(a: Candidate, b: Candidate): number {
  if (a.nameLower !== b.nameLower) return a.nameLower < b.nameLower ? -1 : 1;
  return a.row.digitalId - b.row.digitalId;
}

/**
 * Sort `buffer` into name order and cut it just after its `cap`-th accepted row. Returns the cut
 * buffer and the cap-th accepted row (the cutoff), or a null cutoff when fewer than `cap` rows
 * are accepted.
 */
function selectToCap(
  buffer: Candidate[],
  cap: number,
): { kept: Candidate[]; cutoff: Candidate | null } {
  buffer.sort(compareNameOrder);
  let accepted = 0;
  for (let i = 0; i < buffer.length; i++) {
    if (!buffer[i]!.accepted) continue;
    accepted++;
    if (accepted === cap) return { kept: buffer.slice(0, i + 1), cutoff: buffer[i]! };
  }
  return { kept: buffer, cutoff: null };
}

export async function pageDigitalIdDirectoryForWrite(
  args: PageDigitalIdDirectoryForWriteArgs,
): Promise<PageDigitalIdDirectoryForWriteResult> {
  const { cap } = args;
  const batchSize = args.batchSize ?? DIRECTORY_STREAM_BATCH_SIZE;
  const total = await args.store.countDigitalIdDirectoryEntries(args.projectId);
  if (cap <= 0) return { total, collected: 0 };

  let seenRows = 0;
  let lastProgressAt = 0;

  const reportProgress = (force = false): void => {
    if (!args.onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
    lastProgressAt = now;
    // Rows read out of the directory, so the bar still moves while a binding cap holds the buffer.
    const max = Math.max(total, 1);
    args.onProgress({
      cur: Math.min(seenRows, max),
      max,
      msg: args.progressMsg ?? 'Loading directory contacts',
    });
  };

  let buffer: Candidate[] = [];
  /** Once the buffer has been cut, rows sorting after this one can never survive. */
  let cutoff: Candidate | null = null;
  let truncateAt = cap * 2;

  reportProgress(true);
  let afterDigitalId: number | undefined;
  while (true) {
    const rows = await args.store.readDigitalIdDirectoryBatch(args.projectId, {
      afterDigitalId,
      limit: batchSize,
    });
    for (const row of rows) {
      const candidate: Candidate = {
        row,
        nameLower: row.name.toLocaleLowerCase('en'),
        accepted: args.acceptRow(row),
      };
      seenRows++;
      if (cutoff && compareNameOrder(candidate, cutoff) > 0) continue;
      buffer.push(candidate);
    }
    args.onBufferLength?.(buffer.length);
    if (buffer.length > truncateAt) {
      const selected = selectToCap(buffer, cap);
      buffer = selected.kept;
      if (selected.cutoff) cutoff = selected.cutoff;
      // Rejected rows ahead of the cutoff are kept, so a cut may not shrink the buffer: grow the
      // threshold with it rather than re-sorting on every batch.
      truncateAt = Math.max(cap * 2, buffer.length * 2);
    }
    if (rows.length < batchSize) break;
    afterDigitalId = rows[rows.length - 1]!.digitalId;
    reportProgress();
    await Promise.resolve();
  }

  const { kept } = selectToCap(buffer, cap);
  let collected = 0;
  for (const candidate of kept) {
    if (candidate.accepted) {
      args.onAcceptedRow(candidate.row);
      collected++;
    } else {
      args.onRejectedRow?.(candidate.row);
    }
  }
  seenRows = total;
  reportProgress(true);
  return { total, collected };
}
