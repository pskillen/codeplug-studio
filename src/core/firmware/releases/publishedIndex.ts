/**
 * The firmware project's public release index (`releases.json` in pskillen/mm9pdy-firmware), and the checks a
 * downloaded release patch must pass before Studio uses it. Pure: fetching lives in integrations. Never vendor
 * firmware: the index lists release patches only. See docs/features/firmware-flashing/releases.md.
 */
import { FirmwareError } from '../errors.ts';
import type { ParsedFirmwarePatch } from '../patch/types.ts';
import { listStockFirmwareDescriptors } from '../stockCatalog.ts';
import { stockVariants } from '../stockVariants.ts';
import type { StockFirmwareDescriptor } from '../types.ts';
import { layoutFromBuildName } from './layouts.ts';
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

/** A row's optional `layout`: only for a radio with release layouts, and only one of them. */
function rowLayout(
  row: Record<string, unknown>,
  descriptor: StockFirmwareDescriptor,
  where: string,
): string | undefined {
  const layout = row.layout;
  if (layout === undefined) return undefined;
  if (typeof layout !== 'string' || !layout) throw indexError(`${where}: bad layout`);
  const layouts = descriptor.releaseLayouts?.layouts;
  if (!layouts) throw indexError(`${where}: this radio's releases have no layouts`);
  if (!layouts.includes(layout)) throw indexError(`${where}: ${layout} is not a release layout`);
  return layout;
}

/**
 * A row's optional `base` (UV-5R Mini `nrf-v0.27`): only for a radio with release layouts, naming one of its stock
 * bases, and the base of the row's own `stockVersion`.
 */
function rowBase(
  row: Record<string, unknown>,
  descriptor: StockFirmwareDescriptor,
  stockVersion: string,
  where: string,
): string | undefined {
  const base = row.base;
  if (base === undefined) return undefined;
  if (typeof base !== 'string' || !base) throw indexError(`${where}: bad base`);
  if (!descriptor.releaseLayouts) throw indexError(`${where}: this radio's releases have no bases`);
  const variant = stockVariants(descriptor).find((v) => v.baseName === base);
  if (!variant) throw indexError(`${where}: ${base} is not a stock base Studio knows`);
  if (variant.version !== stockVersion) {
    throw indexError(`${where}: base ${base} is not stock ${stockVersion}`);
  }
  return base;
}

/**
 * Parse the index into release rows. A malformed index or row throws. A row for a radio Studio does not know, or
 * built on a stock version other than the radio's pin, is left out: the index can run ahead of a Studio deploy.
 * For a radio with release layouts a release is one row per layout, each with an optional `layout`; a row without one
 * takes it from the patch's build name when it is loaded ({@link resolvePublishedLayout}).
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
    if (!stockVariants(descriptor).some((v) => v.version === stockVersion)) continue;

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
    const layout = rowLayout(row, descriptor, where);
    const base = rowBase(row, descriptor, stockVersion, where);
    // A layout radio's row without a layout is checked against its partners once loaded. A release has one row per
    // layout and stock base (its stock version names the base).
    const key = descriptor.releaseLayouts
      ? layout
        ? `${where} ${layout} on stock ${stockVersion}`
        : null
      : where;
    if (key !== null) {
      if (seen.has(key)) throw indexError(`${key} is listed twice`);
      seen.add(key);
    }

    out.push({
      radioId: descriptor.radioId,
      tag,
      patchName,
      channel,
      patchFile: str(row, 'patchFile', where),
      patchSha256,
      stockVersion,
      ...(layout ? { layout } : {}),
      ...(base ? { base } : {}),
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
  // Built on the release's own stock version, which must be one the radio accepts.
  const variant = stockVariants(descriptor).find((v) => v.version === release.stockVersion);
  if (!variant) throw fail(`it is not built on a stock version Studio accepts`);
  const roles = variant.members.map((m) => m.role).sort();
  if (Object.keys(description.stock).sort().join() !== roles.join()) {
    throw fail(`it is not built on stock ${variant.version}`);
  }
  for (const m of variant.members) {
    const s = description.stock[m.role];
    if (s?.sha256 !== m.sha256 || s.size !== m.size) {
      throw fail(`it is not built on stock ${variant.version}`);
    }
  }
  // The base the patch names is the row's, and its stock's.
  if (release.base !== undefined && description.base !== release.base) {
    throw fail(
      `the release list says ${release.base}, but its patch is on ${description.base ?? 'no base'}`,
    );
  }
  if (
    variant.baseName !== undefined &&
    description.base !== undefined &&
    description.base !== variant.baseName
  ) {
    throw fail(`its patch names ${description.base}, but it is built on ${variant.baseName}`);
  }
  const results = Object.entries(description.result);
  if (
    results.length !== Object.keys(release.resultSha256).length ||
    results.some(([role, h]) => release.resultSha256[role] !== h.sha256)
  ) {
    throw fail('its result hashes do not match the release list');
  }
}

/**
 * The flash layout of a loaded published patch, for a radio with release layouts: the row's `layout`, or else the one
 * its build name names. Both present must agree; neither is a refusal, and so is a build name with a test-only tag.
 * Undefined for a radio without layouts. Throws FirmwareError('patch-wrong-layout').
 */
export function resolvePublishedLayout(
  release: PublishedFirmwareRelease,
  parsed: ParsedFirmwarePatch,
  descriptor: StockFirmwareDescriptor,
): string | undefined {
  if (!descriptor.releaseLayouts) return undefined;
  const fail = (why: string) =>
    new FirmwareError(
      'patch-wrong-layout',
      `Release ${release.tag} failed Studio's checks: ${why}.`,
    );
  const buildName = parsed.description.buildName;
  let fromName: string | undefined;
  try {
    fromName = layoutFromBuildName(descriptor, buildName);
  } catch {
    throw fail(`its build ${buildName ?? ''} is not for a radio firmware Studio supports`);
  }
  if (release.layout !== undefined && fromName !== undefined && release.layout !== fromName) {
    throw fail('the release list and its build name different radio firmware');
  }
  const layout = release.layout ?? fromName;
  if (layout === undefined) throw fail("Studio can't tell which radio firmware it is for");
  return layout;
}
