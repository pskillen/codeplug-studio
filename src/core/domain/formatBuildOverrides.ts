import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import type { ScanInclusion } from '@core/models/library.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';

const SCAN_INCLUSION_VALUES: readonly ScanInclusion[] = ['default', 'skip', 'alwaysScan'];

export type OverrideField =
  | 'channelOverrides'
  | 'zoneOverrides'
  | 'scanListOverrides'
  | 'talkGroupOverrides'
  | 'rxGroupListOverrides'
  | 'contactOverrides';

/** @deprecated Legacy import shape — migrated to {@link BuildEntityOverride}. */
export interface LegacyEntitySelection {
  libraryEntityId: string;
  overrides: { name: string };
}

export function overrideByEntityId(
  overrides: readonly BuildEntityOverride[] | undefined,
): Map<string, BuildEntityOverride> {
  return new Map((overrides ?? []).map((row) => [row.libraryEntityId, row]));
}

export function isEntityExcluded(
  overrides: readonly BuildEntityOverride[] | undefined,
  entityId: string,
): boolean {
  return (overrides ?? []).find((row) => row.libraryEntityId === entityId)?.excluded === true;
}

/**
 * Whether an expanded channel projection is skipped from export.
 * Projection-key `excluded` wins for that row; parent `channelId` excluded skips all projections.
 */
export function isProjectionExcluded(
  overrides: readonly BuildEntityOverride[] | undefined,
  projectionKey: string,
  parentChannelId: string,
): boolean {
  if (isEntityExcluded(overrides, parentChannelId)) return true;
  if (projectionKey !== parentChannelId && isEntityExcluded(overrides, projectionKey)) return true;
  return false;
}

/**
 * Drop expanded wire rows whose projection key (or parent channel) is excluded on the build.
 * Shared by CPS serialise, wire preview parity tests, and Web Serial write.
 */
export function filterExpandedRowsByOverrides<
  T extends { key: string; sourceChannelId: string },
>(rows: readonly T[], overrides: readonly BuildEntityOverride[] | undefined): T[] {
  return rows.filter((row) => !isProjectionExcluded(overrides, row.key, row.sourceChannelId));
}

export function isEntityForceIncluded(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
): boolean {
  return (overrides ?? []).find((row) => row.libraryEntityId === entityId)?.forceInclude === true;
}

export function overrideOrderOrSlot(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
): number | undefined {
  const value = (overrides ?? []).find((row) => row.libraryEntityId === entityId)?.orderOrSlot;
  if (value == null || !Number.isFinite(value) || value < 1) return undefined;
  return Math.trunc(value);
}

export function overrideScanInclusion(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
): ScanInclusion | undefined {
  return (overrides ?? []).find((row) => row.libraryEntityId === entityId)?.scanInclusion;
}

export function resolveOverrideWireName(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
  generated: string,
): string {
  const wireName = (overrides ?? [])
    .find((row) => row.libraryEntityId === entityId)
    ?.wireName?.trim();
  return sanitiseAsciiWireString(wireName || generated);
}

/** Convert legacy whitelist selections to sparse opt-out overrides. */
export function migrateLegacySelections(
  legacy: LegacyEntitySelection[],
  allEntityIds: string[],
): BuildEntityOverride[] {
  if (legacy.length === 0) {
    return legacy
      .filter((row) => row.overrides.name.trim())
      .map((row) => ({
        libraryEntityId: row.libraryEntityId,
        wireName: row.overrides.name.trim(),
      }));
  }

  const included = new Set(legacy.map((row) => row.libraryEntityId));
  const result: BuildEntityOverride[] = [];

  for (const row of legacy) {
    const wireName = row.overrides.name.trim();
    if (wireName) {
      result.push({ libraryEntityId: row.libraryEntityId, wireName });
    }
  }

  for (const entityId of allEntityIds) {
    if (!included.has(entityId)) {
      result.push({ libraryEntityId: entityId, excluded: true });
    }
  }

  return result;
}

export function parseOverrideArray(raw: unknown, label: string): BuildEntityOverride[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    throw new Error(`${label} must be an array`);
  }
  return raw.map((row, index) => parseOverrideRow(row, `${label}[${index}]`));
}

function parseOverrideRow(raw: unknown, label: string): BuildEntityOverride {
  if (raw === null || typeof raw !== 'object') {
    throw new Error(`${label} must be an object`);
  }
  const record = raw as Record<string, unknown>;

  if ('overrides' in record) {
    const legacy = record as { libraryEntityId: unknown; overrides: unknown };
    const overrides = legacy.overrides as Record<string, unknown>;
    return {
      libraryEntityId: String(legacy.libraryEntityId),
      wireName: overrides.name !== undefined ? String(overrides.name) : undefined,
    };
  }

  const result: BuildEntityOverride = {
    libraryEntityId: String(record.libraryEntityId),
  };
  if (record.excluded !== undefined) {
    result.excluded = Boolean(record.excluded);
  }
  if (record.forceInclude !== undefined) {
    result.forceInclude = Boolean(record.forceInclude);
  }
  if (record.wireName !== undefined && record.wireName !== null && record.wireName !== '') {
    result.wireName = String(record.wireName);
  }
  if (record.orderOrSlot !== undefined && record.orderOrSlot !== null) {
    const orderOrSlot = Number(record.orderOrSlot);
    if (Number.isFinite(orderOrSlot) && orderOrSlot >= 1) {
      result.orderOrSlot = Math.trunc(orderOrSlot);
    }
  }
  if (
    record.scanInclusion !== undefined &&
    record.scanInclusion !== null &&
    record.scanInclusion !== ''
  ) {
    const value = String(record.scanInclusion);
    if (!(SCAN_INCLUSION_VALUES as readonly string[]).includes(value)) {
      throw new Error(`${label}.scanInclusion is invalid: ${value}`);
    }
    result.scanInclusion = value as ScanInclusion;
  }
  const legacyScanListId =
    record.scanListId !== undefined && record.scanListId !== null && record.scanListId !== ''
      ? String(record.scanListId)
      : undefined;
  if (legacyScanListId) {
    (result as { scanListId?: string }).scanListId = legacyScanListId;
  }
  return result;
}

export function upsertOverride(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
  patch: Partial<
    Pick<
      BuildEntityOverride,
      'excluded' | 'forceInclude' | 'wireName' | 'orderOrSlot' | 'scanInclusion'
    >
  >,
): BuildEntityOverride[] {
  const rows = overrides ?? [];
  const index = rows.findIndex((row) => row.libraryEntityId === entityId);
  const existing = index >= 0 ? rows[index]! : { libraryEntityId: entityId };
  const merged: BuildEntityOverride = {
    ...existing,
    ...patch,
  };

  const hasWireName = Boolean(merged.wireName?.trim());
  const isExcluded = merged.excluded === true;
  const isForceIncluded = merged.forceInclude === true;

  if ('orderOrSlot' in patch) {
    if (patch.orderOrSlot != null && Number.isFinite(patch.orderOrSlot) && patch.orderOrSlot >= 1) {
      merged.orderOrSlot = Math.trunc(patch.orderOrSlot);
    } else {
      delete merged.orderOrSlot;
    }
  }

  if ('scanInclusion' in patch) {
    if (patch.scanInclusion == null) {
      delete merged.scanInclusion;
    } else if ((SCAN_INCLUSION_VALUES as readonly string[]).includes(patch.scanInclusion)) {
      merged.scanInclusion = patch.scanInclusion;
    } else {
      delete merged.scanInclusion;
    }
  }

  const hasOrderOrSlot =
    merged.orderOrSlot != null && Number.isFinite(merged.orderOrSlot) && merged.orderOrSlot >= 1;
  const hasScanInclusion = merged.scanInclusion != null;

  if (!hasWireName && !isExcluded && !isForceIncluded && !hasOrderOrSlot && !hasScanInclusion) {
    if (index < 0) return rows;
    return rows.filter((row) => row.libraryEntityId !== entityId);
  }

  if (!hasWireName) {
    delete merged.wireName;
  } else {
    merged.wireName = merged.wireName!.trim();
  }

  if (!isForceIncluded) {
    delete merged.forceInclude;
  }

  if (!isExcluded) {
    delete merged.excluded;
  }

  if (!hasScanInclusion) {
    delete merged.scanInclusion;
  }

  if (index < 0) {
    return [...rows, merged];
  }
  const next = [...rows];
  next[index] = merged;
  return next;
}
