/** Classify only archive entries with recognisable debug provenance. Ends are exclusive. */
import type { RadioBackupRegionV1 } from '../../backup/types.ts';
import { AT_D890_BACKUP_REGION_SPANS } from './backupRestoreRoles.ts';
import { AT_D890_MAP_SIZE, D890_MAP } from './constants.ts';
import { parseAtD890Ident } from './connection.ts';
import { formatAtD890LocalInfoSerial } from './identityCheck.ts';
import { AT_D890_VITAL_UNITS, AT_D890_VITAL_UNIT_BYTES } from './vitalBackup.ts';

export function classifyAtD890DebugCoverage(regions: readonly RadioBackupRegionV1[]) {
  const known = regions.filter(
    (r) =>
      /^sparse-[0-9a-f]+$/.test(r.id) &&
      r.id === `sparse-${r.address.toString(16)}` &&
      r.byteLength > 0 &&
      r.restoreRole === 'inspect-only',
  );
  const vital = regions.filter((r) =>
    AT_D890_VITAL_UNITS.some(
      (u) =>
        r.id === `vital-${u.id}` &&
        r.address === u.address &&
        r.byteLength === AT_D890_VITAL_UNIT_BYTES &&
        r.restoreRole === 'inspect-only',
    ),
  );
  const captured = known.map((r) => ({
    start: r.address,
    end: r.address + r.byteLength,
  }));
  const spans = AT_D890_BACKUP_REGION_SPANS.flatMap((s) => {
    const start = Math.max(0, s.start),
      end = Math.min(AT_D890_MAP_SIZE, s.start + s.length);
    if (start >= end) return [];
    const bounds = [
      ...new Set([
        start,
        end,
        ...captured.flatMap((r) => [
          Math.max(start, Math.min(end, r.start)),
          Math.max(start, Math.min(end, r.end)),
        ]),
      ]),
    ].sort((a, b) => a - b);
    return bounds.slice(0, -1).map((a, i) => ({
      label: s.label,
      start: a,
      end: bounds[i + 1]!,
      captured: captured.some((r) => r.start <= a && r.end >= bounds[i + 1]!),
    }));
  });
  const inMap = captured
    .map((r) => ({ start: Math.max(0, r.start), end: Math.min(AT_D890_MAP_SIZE, r.end) }))
    .filter((r) => r.start < r.end)
    .sort((a, b) => a.start - b.start);
  const merged: { start: number; end: number }[] = [];
  for (const range of inMap) {
    const previous = merged.at(-1);
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end);
    else merged.push({ ...range });
  }
  let cursor = 0;
  const map: { start: number; end: number; captured: boolean }[] = [];
  for (const range of merged) {
    if (cursor < range.start) map.push({ start: cursor, end: range.start, captured: false });
    map.push({ ...range, captured: true });
    cursor = range.end;
  }
  if (cursor < AT_D890_MAP_SIZE)
    map.push({ start: cursor, end: AT_D890_MAP_SIZE, captured: false });
  return {
    map,
    spans,
    outside: known.filter((r) => r.address + r.byteLength > AT_D890_MAP_SIZE),
    vital: AT_D890_VITAL_UNITS.map((def) => ({
      def,
      region: vital.find((r) => r.id === `vital-${def.id}`),
    })),
    unclassified: regions.filter((r) => !known.includes(r) && !vital.includes(r)),
  };
}

/** Ident and serial are evidence from named bytes, never from manifest claims. */
export function atD890DebugIdentity(
  identBytes: Uint8Array | undefined,
  regions: readonly RadioBackupRegionV1[],
  bytes: Record<string, Uint8Array>,
) {
  let ident: ReturnType<typeof parseAtD890Ident> | undefined;
  if (identBytes?.length === 16) {
    try {
      ident = parseAtD890Ident(identBytes);
    } catch {
      /* Unrecognised ident is not evidence. */
    }
  }
  const local = regions.find(
    (r) =>
      r.id === 'vital-local-info' &&
      r.address === D890_MAP.LocalInfo &&
      r.byteLength === AT_D890_VITAL_UNIT_BYTES &&
      r.restoreRole === 'inspect-only',
  );
  const localBytes = local && bytes[local.id];
  const serial =
    localBytes?.length === AT_D890_VITAL_UNIT_BYTES ? formatAtD890LocalInfoSerial(localBytes) : '';
  return { ident, serial: serial || undefined };
}

/** Comparison metadata is an archive claim; validate its shape before displaying it. */
export function atD890VitalComparison(sidecar: Uint8Array | undefined): boolean {
  if (!sidecar) return false;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(sidecar));
    if (
      typeof value !== 'object' ||
      value === null ||
      !('bothReadsMatched' in value) ||
      value.bothReadsMatched !== true ||
      !('units' in value) ||
      !Array.isArray(value.units) ||
      value.units.length !== AT_D890_VITAL_UNITS.length
    )
      return false;
    const units: unknown[] = value.units;
    return AT_D890_VITAL_UNITS.every((def, i) => {
      const unit: unknown = units[i];
      return (
        typeof unit === 'object' &&
        unit !== null &&
        'id' in unit &&
        unit.id === def.id &&
        'address' in unit &&
        unit.address === def.address &&
        'asReturned' in unit &&
        unit.asReturned === def.asReturned
      );
    });
  } catch {
    return false;
  }
}
