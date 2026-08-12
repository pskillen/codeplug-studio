import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';

export type DigitalIdDirectoryOrderBy = 'digitalId' | 'callsign' | 'name';

export type DigitalIdDirectoryPageQuery = {
  projectId: string;
  offset: number;
  limit: number;
  orderBy?: DigitalIdDirectoryOrderBy;
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

export function directoryProjectNameRange(projectId: string): [string, string] {
  return [projectId, ''];
}

export function directoryProjectNameRangeUpper(projectId: string): [string, string] {
  return [projectId, UNICODE_MAX];
}

export function matchesDirectoryFilters(
  row: DigitalIdDirectoryEntry,
  query: Pick<DigitalIdDirectoryPageQuery, 'callsignPrefix' | 'namePrefix' | 'countryEquals'>,
): boolean {
  if (query.countryEquals !== undefined && row.country !== query.countryEquals) return false;
  if (query.callsignPrefix !== undefined && !row.callsign.startsWith(query.callsignPrefix)) {
    return false;
  }
  if (query.namePrefix !== undefined && !row.name.startsWith(query.namePrefix)) return false;
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
  const filtered = [...rows]
    .filter((row) => row.projectId === query.projectId)
    .filter((row) => matchesDirectoryFilters(row, query))
    .sort((a, b) => compareDirectoryRows(a, b, orderBy));
  return {
    rows: filtered.slice(query.offset, query.offset + query.limit),
    total: filtered.length,
  };
}
