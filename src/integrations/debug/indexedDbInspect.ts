import { DEFAULT_DB_NAME, STORE_NAMES } from '@integrations/persistence/stores.ts';

export interface ProjectRowCount {
  projectId: string;
  count: number;
}

export interface StoreSummary {
  storeName: string;
  totalRows: number;
  byProject: ProjectRowCount[];
}

export interface IndexedDbRowSummary {
  projectId: string;
  id: string;
  name: string;
  callsign: string | null;
}

export function summarizeIndexedDbRow(row: unknown): IndexedDbRowSummary | null {
  if (!row || typeof row !== 'object') return null;
  const record = row as { projectId?: unknown; id?: unknown; name?: unknown; callsign?: unknown };
  if (typeof record.projectId !== 'string' || typeof record.id !== 'string') return null;
  const name = typeof record.name === 'string' ? record.name : record.id;
  const callsign =
    typeof record.callsign === 'string' && record.callsign.length > 0 ? record.callsign : null;
  return { projectId: record.projectId, id: record.id, name, callsign };
}

export function filterIndexedDbRowSummaries(
  rows: IndexedDbRowSummary[],
  query: string,
): IndexedDbRowSummary[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) =>
    [row.name, row.callsign, row.projectId, row.id]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .some((value) => value.toLowerCase().includes(q)),
  );
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function openDb(dbName: string = DEFAULT_DB_NAME): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    throw new Error('IndexedDB is not available in this environment');
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(dbName);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function rowProjectId(row: unknown): string | null {
  if (!row || typeof row !== 'object') return null;
  const projectId = (row as { projectId?: unknown }).projectId;
  return typeof projectId === 'string' ? projectId : null;
}

function summarizeRows(rows: unknown[]): ProjectRowCount[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const projectId = rowProjectId(row);
    if (!projectId) continue;
    counts.set(projectId, (counts.get(projectId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([projectId, count]) => ({ projectId, count }))
    .sort((a, b) => a.projectId.localeCompare(b.projectId));
}

export function isKnownStoreName(storeName: string): boolean {
  return (STORE_NAMES as string[]).includes(storeName);
}

export async function listStoreSummaries(
  dbName: string = DEFAULT_DB_NAME,
): Promise<StoreSummary[]> {
  const db = await openDb(dbName);
  try {
    const summaries: StoreSummary[] = [];
    for (const storeName of STORE_NAMES) {
      if (!db.objectStoreNames.contains(storeName)) {
        summaries.push({ storeName, totalRows: 0, byProject: [] });
        continue;
      }
      const tx = db.transaction(storeName, 'readonly');
      const rows = await promisifyRequest<unknown[]>(tx.objectStore(storeName).getAll());
      summaries.push({
        storeName,
        totalRows: rows.length,
        byProject: summarizeRows(rows),
      });
    }
    return summaries;
  } finally {
    db.close();
  }
}

export async function listStoreRows(
  storeName: string,
  projectId?: string,
  dbName: string = DEFAULT_DB_NAME,
): Promise<unknown[]> {
  if (!isKnownStoreName(storeName)) {
    throw new Error(`Unknown object store: ${storeName}`);
  }
  const db = await openDb(dbName);
  try {
    if (!db.objectStoreNames.contains(storeName)) return [];
    const tx = db.transaction(storeName, 'readonly');
    const os = tx.objectStore(storeName);
    let rows: unknown[];
    if (projectId) {
      const index = os.index('byProject');
      rows = await promisifyRequest<unknown[]>(index.getAll(projectId));
    } else {
      rows = await promisifyRequest<unknown[]>(os.getAll());
    }
    return rows.sort((a, b) => {
      const aName = (a as { name?: string }).name ?? '';
      const bName = (b as { name?: string }).name ?? '';
      return aName.localeCompare(bName);
    });
  } finally {
    db.close();
  }
}

export async function getStoreRow(
  storeName: string,
  projectId: string,
  id: string,
  dbName: string = DEFAULT_DB_NAME,
): Promise<unknown | null> {
  if (!isKnownStoreName(storeName)) {
    throw new Error(`Unknown object store: ${storeName}`);
  }
  const db = await openDb(dbName);
  try {
    if (!db.objectStoreNames.contains(storeName)) return null;
    const tx = db.transaction(storeName, 'readonly');
    const row = await promisifyRequest<unknown | undefined>(
      tx.objectStore(storeName).get([projectId, id]),
    );
    return row ?? null;
  } finally {
    db.close();
  }
}

export function indexedDbRowViewerPath(storeName: string, projectId: string, id: string): string {
  return `/debug/indexed-db/${encodeURIComponent(storeName)}/${encodeURIComponent(projectId)}/${encodeURIComponent(id)}`;
}

export function indexedDbStorePath(storeName: string): string {
  return `/debug/indexed-db/${encodeURIComponent(storeName)}`;
}

export function decodeIndexedDbParam(param: string): string {
  return decodeURIComponent(param);
}
