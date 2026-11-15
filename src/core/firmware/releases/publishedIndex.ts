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
import { buildNameLayout } from './layouts.ts';
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
 * A row's stock base, for a radio with release layouts (UV-5R Mini `nrf-v0.27`): its `base`, which must be one of the
 * radio's stock bases and the base of the row's own `stockVersion`; or, without one, the base of its `stockVersion`.
 * A release is keyed by base and version (D133), so a row whose base can't be told is malformed. Undefined for a radio
 * without layouts, whose rows must carry no base.
 */
function rowBase(
  row: Record<string, unknown>,
  descriptor: StockFirmwareDescriptor,
  stockVersion: string,
  where: string,
): string | undefined {
  const base = row.base;
  if (!descriptor.releaseLayouts) {
    if (base !== undefined) throw indexError(`${where}: this radio's releases have no bases`);
    return undefined;
  }
  const onVersion = stockVariants(descriptor).filter((v) => v.version === stockVersion);
  if (base === undefined) {
    const only = onVersion.length === 1 ? onVersion[0]!.baseName : undefined;
    if (only === undefined) throw indexError(`${where}: no stock base for stock ${stockVersion}`);
    return only;
  }
  if (typeof base !== 'string' || !base) throw indexError(`${where}: bad base`);
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
 * For a radio with release layouts a release is one row per stock base and version (D133), each with its `base` (or
 * the base its `stockVersion` names) and an optional `layout`; the file's layout is settled when it is loaded
 * ({@link resolvePublishedLayout}).
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
    let toStock: PublishedFirmwareRelease['toStock'];
    if (row.toStock !== undefined) {
      if (typeof row.toStock !== 'object' || row.toStock === null)
        throw indexError(`${where}: bad to-stock patch`);
      const patch = row.toStock as Record<string, unknown>;
      if (
        typeof patch.path !== 'string' ||
        !patch.path.startsWith(`releases/${radioId}/`) ||
        patch.path.includes('..') ||
        typeof patch.sha256 !== 'string' ||
        !/^[0-9a-f]{64}$/i.test(patch.sha256)
      ) {
        throw indexError(`${where}: bad to-stock patch`);
      }
      const path = patch.path;
      toStock = { sha256: patch.sha256.toLowerCase(), loadBytes: () => opts.loadPatchBytes(path) };
    }
    const layout = rowLayout(row, descriptor, where);
    const base = rowBase(row, descriptor, stockVersion, where);
    // A release is one row per stock base and version (D133): the same version on two bases is two releases.
    const key = base === undefined ? where : `${where} on ${base}`;
    if (seen.has(key)) throw indexError(`${key} is listed twice`);
    seen.add(key);

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
      ...(toStock ? { toStock } : {}),
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
 * The flash layout of a loaded published patch, for a radio with release layouts. It comes from verified metadata:
 * the row's `layout` and the layout of the row's stock base (the radio's own table, `layoutOfBase`), the base already
 * checked against the patch and its pinned stock ({@link checkPublishedPatch}). The build name only cross-checks it
 * ({@link buildNameLayout}). Every one present must agree, and with neither the row's layout nor its base's, Studio
 * can't tell: refused. Undefined for a radio without layouts. Throws FirmwareError('patch-wrong-layout').
 */
export function resolvePublishedLayout(
  release: PublishedFirmwareRelease,
  parsed: ParsedFirmwarePatch,
  descriptor: StockFirmwareDescriptor,
): string | undefined {
  const rl = descriptor.releaseLayouts;
  if (!rl) return undefined;
  const fail = (why: string) =>
    new FirmwareError(
      'patch-wrong-layout',
      `Release ${release.tag} failed Studio's checks: ${why}.`,
    );
  const { buildName } = parsed.description;
  let fromName: string | undefined;
  try {
    fromName = buildNameLayout(descriptor, parsed.description);
  } catch {
    throw fail(`its build ${buildName ?? ''} is not for a radio firmware Studio supports`);
  }
  const fromBase = release.base === undefined ? undefined : rl.layoutOfBase?.(release.base);
  const named = [release.layout, fromBase, fromName].filter((l) => l !== undefined);
  if (named.some((l) => l !== named[0])) {
    throw fail('the release list and its build are for different radio firmware');
  }
  const layout = release.layout ?? fromBase;
  if (layout === undefined) throw fail("Studio can't tell which radio firmware it is for");
  return layout;
}
