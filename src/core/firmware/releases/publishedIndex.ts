/**
 * The firmware project's public release index (`releases.json` in pskillen/mm9pdy-firmware), and the checks a
 * downloaded release patch must pass before Studio uses it. Pure: fetching lives in integrations. Never vendor
 * firmware: the index lists release patches only. See docs/features/firmware-flashing/releases.md.
 */
import { FirmwareError } from '../errors.ts';
import type { ParsedFirmwarePatch } from '../patch/types.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import type { PublishedFirmwareRelease } from './types.ts';

export const PUBLISHED_RELEASE_INDEX_FORMAT = 1;

const TAG = /^\d+\.\d+\.\d+(-rc\.\d+)?$/;
const SHA256 = /^[0-9a-f]{64}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;

export interface PublishedIndexOptions {
  /** Downloads a patch by its repository-relative path (`releases/<radio>/<file>.patch.json`). */
  readonly loadPatchBytes: (patchPath: string) => Promise<Uint8Array>;
  /** Every radio's stock descriptor. Default: the stock catalog. */
  readonly descriptors?: readonly StockFirmwareDescriptor[];
}

function indexError(message: string): FirmwareError {
  return new FirmwareError(
    'patch-unreadable',
    `The firmware release list is not valid: ${message}`,
  );
}

function str(row: Record<string, unknown>, key: string, where: string): string {
  const v = row[key];
  if (typeof v !== 'string' || !v) throw indexError(`${where} has no ${key}`);
  return v;
}

/**
 * Parse the index into release rows. A malformed index or row throws. A row for a radio Studio does not know, or
 * built on a stock version other than the radio's pin, is left out: the index can run ahead of a Studio deploy.
 */
export function parsePublishedReleaseIndex(
  json: unknown,
  opts: PublishedIndexOptions,
): PublishedFirmwareRelease[] {
  const descriptors = opts.descriptors ?? listStockFirmwareDescriptors();
  if (typeof json !== 'object' || json === null) throw indexError('not an object');
  const { format, releases } = json as { format?: unknown; releases?: unknown };
  if (format !== PUBLISHED_RELEASE_INDEX_FORMAT)
    throw indexError(`unknown format ${String(format)}`);
  if (!Array.isArray(releases)) throw indexError('no releases list');

  const out: PublishedFirmwareRelease[] = [];
  const seen = new Set<string>();
  for (const raw of releases as unknown[]) {
    if (typeof raw !== 'object' || raw === null) throw indexError('a release is not an object');
    const row = raw as Record<string, unknown>;
    const radioId = str(row, 'radioId', 'a release');
    const tag = str(row, 'version', radioId);
    const where = `${radioId} ${tag}`;
    const descriptor = descriptors.find((d) => d.radioId === radioId);
    if (!descriptor) continue;
    const stockVersion = str(row, 'stockVersion', where);
    if (stockVersion !== descriptor.version) continue;

    const channel = str(row, 'channel', where);
    const patchSha256 = str(row, 'patchSha256', where);
    const patchPath = str(row, 'patchPath', where);
    const publishedOn = str(row, 'publishedOn', where);
    const patchName = str(row, 'patchName', where);
    const notes = typeof row.notes === 'string' ? row.notes : '';
    const result = row.resultSha256;
    if (!TAG.test(tag)) throw indexError(`${where}: bad version`);
    if (channel !== (tag.includes('-rc.') ? 'rc' : 'final'))
      throw indexError(`${where}: bad channel`);
    if (!SHA256.test(patchSha256)) throw indexError(`${where}: bad patch hash`);
    if (!DATE.test(publishedOn)) throw indexError(`${where}: bad date`);
    if (!descriptor.patchNames.includes(patchName))
      throw indexError(`${where}: not this radio's project`);
    if (patchPath.includes('..') || !patchPath.startsWith(`releases/${radioId}/`)) {
      throw indexError(`${where}: bad patch path`);
    }
    if (
      typeof result !== 'object' ||
      result === null ||
      !Object.values(result).every((v) => typeof v === 'string' && SHA256.test(v))
    ) {
      throw indexError(`${where}: bad result hashes`);
    }
    if (seen.has(where)) throw indexError(`${where} is listed twice`);
    seen.add(where);

    out.push({
      radioId: descriptor.radioId,
      tag,
      patchName,
      channel,
      patchFile: str(row, 'patchFile', where),
      patchSha256,
      stockVersion,
      publishedOn,
      summary: str(row, 'summary', where),
      verifyHint: str(row, 'verifyHint', where),
      resultSha256: result as Record<string, string>,
      loadBytes: () => opts.loadPatchBytes(patchPath),
      loadNotes: async () => notes,
    });
  }
  return out;
}

/**
 * Everything a published patch must be before Studio prepares it: this radio's project and version, built on the
 * radio's pinned stock, with the result hashes the index declared. The bytes' SHA-256 is checked by the caller;
 * applying the patch checks the result, and the radio's updater interlocks check the image. Throws
 * FirmwareError('patch-unreadable').
 */
export function checkPublishedPatch(
  release: PublishedFirmwareRelease,
  parsed: ParsedFirmwarePatch,
  descriptor: StockFirmwareDescriptor,
): void {
  const fail = (why: string) =>
    new FirmwareError('patch-unreadable', `Release ${release.tag} failed Studio's checks: ${why}.`);
  const { description } = parsed;
  if (description.name !== release.patchName || !descriptor.patchNames.includes(description.name)) {
    throw fail('it is for a different radio');
  }
  if (description.version !== release.tag) throw fail('its version does not match the release');
  const roles = descriptor.members.map((m) => m.role).sort();
  if (Object.keys(description.stock).sort().join() !== roles.join()) {
    throw fail(`it is not built on stock ${descriptor.version}`);
  }
  for (const m of descriptor.members) {
    const s = description.stock[m.role];
    if (s?.sha256 !== m.sha256 || s.size !== m.size) {
      throw fail(`it is not built on stock ${descriptor.version}`);
    }
  }
  const results = Object.entries(description.result);
  if (
    results.length !== Object.keys(release.resultSha256).length ||
    results.some(([role, h]) => release.resultSha256[role] !== h.sha256)
  ) {
    throw fail('its result hashes do not match the release list');
  }
}
