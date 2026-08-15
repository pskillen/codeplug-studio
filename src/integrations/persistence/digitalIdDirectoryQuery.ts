import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';

export type DigitalIdDirectoryOrderBy = 'digitalId' | 'callsign' | 'name';

export type DigitalIdDirectoryPageQuery = {
  projectId: string;
  offset: number;
  limit: number;
  orderBy?: DigitalIdDirectoryOrderBy;
  digitalIdPrefix?: string;
  callsignPrefix?: string;
  namePrefix?: string;
  countryEquals?: string;
};

export type DigitalIdDirectoryPageResult = {
  rows: DigitalIdDirectoryEntry[];
  total: number;
};

const UNICODE_MAX = '\uffff';

export function directoryPrefixUpperBound(prefix: string): string {
  return prefix + UNICODE_MAX;
}

export function normalizeDirectoryTextPrefix(prefix: string): string {
  return prefix.trim().toLocaleLowerCase('en');
}

/** Digits-only decimal prefix for digital ID filter. Undefined when empty or non-digit. */
export function normalizeDigitalIdPrefix(prefix: string): string | undefined {
  const digits = prefix.trim().replace(/\D/g, '');
  return digits.length > 0 ? digits : undefined;
}

export function directoryProjectNameRange(projectId: string): [string, string] {
  return [projectId, ''];
}

export function directoryProjectNameRangeUpper(projectId: string): [string, string] {
  return [projectId, UNICODE_MAX];
}

export function normalizedDirectoryFilterQuery(
  query: Pick<
    DigitalIdDirectoryPageQuery,
    'digitalIdPrefix' | 'callsignPrefix' | 'namePrefix' | 'countryEquals'
  >,
): Pick<
  DigitalIdDirectoryPageQuery,
  'digitalIdPrefix' | 'callsignPrefix' | 'namePrefix' | 'countryEquals'
> {
  return {
    digitalIdPrefix:
      query.digitalIdPrefix !== undefined
        ? normalizeDigitalIdPrefix(query.digitalIdPrefix)
        : undefined,
    callsignPrefix:
      query.callsignPrefix !== undefined
        ? normalizeDirectoryTextPrefix(query.callsignPrefix)
        : undefined,
    namePrefix:
      query.namePrefix !== undefined ? normalizeDirectoryTextPrefix(query.namePrefix) : undefined,
    countryEquals: query.countryEquals,
  };
}

export function matchesDirectoryFilters(
  row: DigitalIdDirectoryEntry,
  query: Pick<
    DigitalIdDirectoryPageQuery,
    'digitalIdPrefix' | 'callsignPrefix' | 'namePrefix' | 'countryEquals'
  >,
): boolean {
  if (query.digitalIdPrefix !== undefined) {
    if (!String(row.digitalId).startsWith(query.digitalIdPrefix)) return false;
  }
  if (query.countryEquals !== undefined && row.country !== query.countryEquals) return false;
  if (query.callsignPrefix !== undefined) {
    if (!row.callsign.toLocaleLowerCase('en').startsWith(query.callsignPrefix)) {
      return false;
    }
  }
  if (query.namePrefix !== undefined) {
    if (!row.name.toLocaleLowerCase('en').startsWith(query.namePrefix)) return false;
  }
  return true;
}

export function compareDirectoryRows(
  a: DigitalIdDirectoryEntry,
  b: DigitalIdDirectoryEntry,
  orderBy: DigitalIdDirectoryOrderBy,
): number {
  switch (orderBy) {
    case 'digitalId':
      return a.digitalId - b.digitalId;
    case 'callsign':
      return a.callsign.localeCompare(b.callsign);
    case 'name':
      return a.name.localeCompare(b.name);
  }
}

export function queryDigitalIdDirectoryPageInMemory(
  rows: Iterable<DigitalIdDirectoryEntry>,
  query: DigitalIdDirectoryPageQuery,
): DigitalIdDirectoryPageResult {
  const orderBy = query.orderBy ?? 'name';
  const filterQuery = normalizedDirectoryFilterQuery(query);
  const filtered = [...rows]
    .filter((row) => row.projectId === query.projectId)
    .filter((row) => matchesDirectoryFilters(row, filterQuery))
    .sort((a, b) => compareDirectoryRows(a, b, orderBy));
  return {
    rows: filtered.slice(query.offset, query.offset + query.limit),
    total: filtered.length,
  };
}
