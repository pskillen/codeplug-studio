/**
 * Page through the RadioID directory shadow for Write assemble — yields between pages
 * so the UI can paint and report progress without holding one IndexedDB cursor open.
 */

import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';
import type { ProgressFn } from '@integrations/radio-io/types.ts';

export const DIRECTORY_WRITE_PAGE_SIZE = 500;
const PROGRESS_THROTTLE_MS = 100;

export interface PageDigitalIdDirectoryForWriteArgs {
  store: ProjectPersistence;
  projectId: string;
  cap: number;
  onProgress?: ProgressFn;
  progressMsg?: string;
  acceptRow: (row: DigitalIdDirectoryEntry) => boolean;
  onAcceptedRow: (row: DigitalIdDirectoryEntry) => void;
}

export interface PageDigitalIdDirectoryForWriteResult {
  total: number;
  collected: number;
}

export async function pageDigitalIdDirectoryForWrite(
  args: PageDigitalIdDirectoryForWriteArgs,
): Promise<PageDigitalIdDirectoryForWriteResult> {
  let offset = 0;
  let total = 0;
  let collected = 0;
  let lastProgressAt = 0;

  const reportProgress = (force = false): void => {
    if (!args.onProgress) return;
    const now = Date.now();
    if (!force && now - lastProgressAt < PROGRESS_THROTTLE_MS) return;
    lastProgressAt = now;
    const max = total > 0 ? Math.min(total, args.cap) : Math.max(args.cap, 1);
    args.onProgress({
      cur: Math.min(collected, max),
      max,
      msg: args.progressMsg ?? 'Loading directory contacts',
    });
  };

  while (true) {
    const page = await args.store.queryDigitalIdDirectoryPage({
      projectId: args.projectId,
      offset,
      limit: DIRECTORY_WRITE_PAGE_SIZE,
      orderBy: 'name',
    });
    if (offset === 0) {
      total = page.total;
      reportProgress(true);
    }
    if (page.rows.length === 0) break;

    for (const row of page.rows) {
      if (collected >= args.cap) break;
      if (!args.acceptRow(row)) continue;
      args.onAcceptedRow(row);
      collected++;
    }

    if (collected >= args.cap) break;
    offset += page.rows.length;
    if (offset >= total) break;
    reportProgress();
    await Promise.resolve();
  }

  reportProgress(true);
  return { total, collected };
}
