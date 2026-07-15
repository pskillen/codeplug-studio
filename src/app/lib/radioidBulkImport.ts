import type { DigitalContact } from '@core/models/library.ts';
import {
  applyRadioidListingUpdates,
  buildRadioidDmrUserSearchParams,
  mapRadioidUserToDigitalContact,
  RadioidDirectoryError,
  searchRadioidDmrUsers,
  type RadioidDmrUserListing,
  type RadioidSearchFilterInput,
} from '@integrations/radioid/index.ts';
import type { DigitalContactPut, ProjectPersistence } from '@integrations/persistence/types.ts';

export type RadioidBulkImportScope = 'page' | 'selected' | 'all';

export interface RadioidBulkImportProgress {
  processed: number;
  total: number;
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  currentPage?: number;
  totalPages?: number;
  message: string;
  etaMs: number | null;
}

export interface RadioidBulkImportResult {
  added: number;
  updated: number;
  skipped: number;
  failed: number;
  cancelled: boolean;
  error: string | null;
}

export interface RadioidBulkImportOptions {
  scope: RadioidBulkImportScope;
  updateExisting: boolean;
  projectId: string;
  contacts: readonly DigitalContact[];
  listings?: readonly RadioidDmrUserListing[];
  filters?: RadioidSearchFilterInput;
  totalPages?: number;
  totalCount?: number;
  persistence: ProjectPersistence;
  onProgress: (progress: RadioidBulkImportProgress) => void;
  isCancelled?: () => boolean;
}

type ListingWriteOutcome = 'added' | 'updated';

interface PendingListingWrite {
  digitalId: number;
  outcome: ListingWriteOutcome;
  put: DigitalContactPut;
}

function contactMapFromLibrary(contacts: readonly DigitalContact[]): Map<number, DigitalContact> {
  const map = new Map<number, DigitalContact>();
  for (const contact of contacts) {
    map.set(contact.digitalId, contact);
  }
  return map;
}

function estimateEtaMs(startedAt: number, processed: number, total: number): number | null {
  if (processed <= 0 || total <= processed) return null;
  const elapsed = Date.now() - startedAt;
  const rate = processed / elapsed;
  if (rate <= 0) return null;
  return (total - processed) / rate;
}

function prepareListingWrite(
  listing: RadioidDmrUserListing,
  contactByDigitalId: Map<number, DigitalContact>,
  options: Pick<RadioidBulkImportOptions, 'projectId' | 'updateExisting'>,
): PendingListingWrite | null {
  const existing = contactByDigitalId.get(listing.id);
  if (existing) {
    if (!options.updateExisting) return null;
    const patched = applyRadioidListingUpdates(existing, listing);
    if (!patched) return null;
    return {
      digitalId: listing.id,
      outcome: 'updated',
      put: { row: patched, expectedRevision: existing.revision },
    };
  }

  const contact = mapRadioidUserToDigitalContact(listing, options.projectId);
  return {
    digitalId: listing.id,
    outcome: 'added',
    put: { row: contact, expectedRevision: null },
  };
}

function reportProgress(
  onProgress: RadioidBulkImportOptions['onProgress'],
  startedAt: number,
  partial: Omit<RadioidBulkImportProgress, 'etaMs'>,
): void {
  onProgress({
    ...partial,
    etaMs: estimateEtaMs(startedAt, partial.processed, partial.total),
  });
}

async function persistListingBatch(
  pending: readonly PendingListingWrite[],
  contactByDigitalId: Map<number, DigitalContact>,
  persistence: ProjectPersistence,
  counts: Pick<RadioidBulkImportResult, 'added' | 'updated' | 'failed'>,
): Promise<void> {
  if (pending.length === 0) return;

  const batch = await persistence.putDigitalContactsBatch(pending.map((item) => item.put));
  for (let i = 0; i < pending.length; i++) {
    const item = pending[i]!;
    const result = batch.results[i];
    if (!result?.ok) {
      counts.failed += 1;
      continue;
    }
    counts[item.outcome] += 1;
    contactByDigitalId.set(item.digitalId, { ...item.put.row, revision: result.revision });
  }
}

export async function runRadioidBulkImport(
  options: RadioidBulkImportOptions,
): Promise<RadioidBulkImportResult> {
  return options.persistence.runWithoutNotifications(() => runRadioidBulkImportInner(options));
}

async function runRadioidBulkImportInner(
  options: RadioidBulkImportOptions,
): Promise<RadioidBulkImportResult> {
  const startedAt = Date.now();
  const contactByDigitalId = contactMapFromLibrary(options.contacts);
  const counts = { added: 0, updated: 0, skipped: 0, failed: 0 };
  let processed = 0;
  let cancelled = false;

  const isCancelled = () => options.isCancelled?.() ?? false;

  async function handleListings(
    listings: readonly RadioidDmrUserListing[],
    total: number,
    messagePrefix: string,
    pageInfo?: { currentPage: number; totalPages: number },
  ): Promise<boolean> {
    const pending: PendingListingWrite[] = [];

    for (const listing of listings) {
      if (isCancelled()) {
        cancelled = true;
        break;
      }

      const write = prepareListingWrite(listing, contactByDigitalId, options);
      if (!write) {
        counts.skipped += 1;
        processed += 1;
        continue;
      }
      pending.push(write);
    }

    if (pending.length > 0) {
      await persistListingBatch(pending, contactByDigitalId, options.persistence, counts);
      processed += pending.length;
    }

    if (cancelled) return false;

    const lastListing = listings[listings.length - 1];
    reportProgress(options.onProgress, startedAt, {
      processed,
      total,
      ...counts,
      currentPage: pageInfo?.currentPage,
      totalPages: pageInfo?.totalPages,
      message: lastListing
        ? `${messagePrefix} — ${lastListing.callsign || lastListing.id}`
        : messagePrefix,
    });

    return true;
  }

  try {
    if (options.scope === 'page' || options.scope === 'selected') {
      const listings = options.listings ?? [];
      const total = listings.length;
      reportProgress(options.onProgress, startedAt, {
        processed: 0,
        total,
        ...counts,
        message: 'Starting import…',
      });
      await handleListings(listings, total, 'Importing');
    } else {
      const filters = options.filters;
      const totalPages = options.totalPages ?? 1;
      const total = options.totalCount ?? 0;

      reportProgress(options.onProgress, startedAt, {
        processed: 0,
        total,
        totalPages,
        ...counts,
        message: 'Fetching results…',
      });

      for (let page = 1; page <= totalPages; page += 1) {
        if (isCancelled()) {
          cancelled = true;
          break;
        }

        const params = filters ? buildRadioidDmrUserSearchParams(filters, page) : null;
        if (!params) {
          return { ...counts, cancelled: false, error: 'Search filters are empty.' };
        }

        reportProgress(options.onProgress, startedAt, {
          processed,
          total,
          currentPage: page,
          totalPages,
          ...counts,
          message: `Fetching page ${page} of ${totalPages}…`,
        });

        const result = await searchRadioidDmrUsers(params);
        const continued = await handleListings(result.listings, total, `Page ${page}`, {
          currentPage: page,
          totalPages,
        });
        if (!continued) break;
      }
    }
  } catch (err) {
    const message =
      err instanceof RadioidDirectoryError ? err.message : 'Import failed — try again.';
    return { ...counts, cancelled, error: message };
  }

  return { ...counts, cancelled, error: null };
}

export function countRadioidBulkImportTargets(
  listings: readonly RadioidDmrUserListing[],
  contacts: readonly DigitalContact[],
): { newCount: number; existingCount: number } {
  const existingIds = new Set(contacts.map((c) => c.digitalId));
  let newCount = 0;
  let existingCount = 0;
  for (const listing of listings) {
    if (existingIds.has(listing.id)) existingCount += 1;
    else newCount += 1;
  }
  return { newCount, existingCount };
}

export function formatRadioidBulkImportEta(etaMs: number | null): string {
  if (etaMs == null || !Number.isFinite(etaMs) || etaMs <= 0) return '—';
  const seconds = Math.ceil(etaMs / 1000);
  if (seconds < 60) return `~${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rem = seconds % 60;
  return rem > 0 ? `~${minutes}m ${rem}s` : `~${minutes}m`;
}
