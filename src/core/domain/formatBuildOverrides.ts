import type { BuildEntityOverride } from '@core/models/formatBuild.ts';
import { sanitiseAsciiWireString } from '@core/import-export/sanitiseAsciiWireString.ts';

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
  overrides: BuildEntityOverride[] | undefined,
): Map<string, BuildEntityOverride> {
  return new Map((overrides ?? []).map((row) => [row.libraryEntityId, row]));
}

export function isEntityExcluded(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
): boolean {
  return (overrides ?? []).find((row) => row.libraryEntityId === entityId)?.excluded === true;
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
  if (record.scanListId !== undefined && record.scanListId !== null && record.scanListId !== '') {
    result.scanListId = String(record.scanListId);
  }
  return result;
}

export function upsertOverride(
  overrides: BuildEntityOverride[] | undefined,
  entityId: string,
  patch: Partial<
    Pick<
      BuildEntityOverride,
      'excluded' | 'forceInclude' | 'wireName' | 'orderOrSlot' | 'scanListId'
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

  if ('scanListId' in patch) {
    if (patch.scanListId?.trim()) {
      merged.scanListId = patch.scanListId.trim();
    } else {
      delete merged.scanListId;
    }
  }

  const hasOrderOrSlot =
    merged.orderOrSlot != null && Number.isFinite(merged.orderOrSlot) && merged.orderOrSlot >= 1;
  const hasScanListId = Boolean(merged.scanListId?.trim());

  if (!hasWireName && !isExcluded && !isForceIncluded && !hasOrderOrSlot && !hasScanListId) {
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

  if (index < 0) {
    return [...rows, merged];
  }
  const next = [...rows];
  next[index] = merged;
  return next;
}
