import type { DigitalIdDirectoryEntry } from '@core/models/digitalIdDirectory.ts';
import type { DirectoryInterchangeFormat } from '@integrations/persistence/digitalIdDirectoryInterchange.ts';
import {
  defaultDirectoryExportFileName,
  parseDirectoryInterchangeFile,
  serialiseDirectoryInterchangeFile,
} from '@integrations/persistence/digitalIdDirectoryInterchange.ts';
import type { ProjectPersistence } from '@integrations/persistence/index.ts';

const DIRECTORY_IMPORT_BATCH_SIZE = 100;

async function collectDirectoryEntries(
  store: ProjectPersistence,
  projectId: string,
): Promise<DigitalIdDirectoryEntry[]> {
  const rows: DigitalIdDirectoryEntry[] = [];
  await store.iterateDigitalIdDirectory(projectId, (row) => {
    rows.push(row);
  });
  return rows;
}

export async function exportDirectoryInterchangeContent(
  store: ProjectPersistence,
  projectId: string,
  format: DirectoryInterchangeFormat,
): Promise<{ content: string; fileName: string; rowCount: number }> {
  const seed = await store.loadProjectSeed(projectId);
  if (!seed) {
    throw new Error(`Project not found: ${projectId}`);
  }
  const rows: DigitalIdDirectoryEntry[] = [];
  await store.iterateDigitalIdDirectory(projectId, (row) => {
    rows.push(row);
  });
  return {
    content: serialiseDirectoryInterchangeFile(rows, format),
    fileName: defaultDirectoryExportFileName(seed.meta.name, format),
    rowCount: rows.length,
  };
}

export async function importDirectoryInterchangeContent(
  store: ProjectPersistence,
  projectId: string,
  text: string,
  format: DirectoryInterchangeFormat,
): Promise<{ imported: number }> {
  const entries = parseDirectoryInterchangeFile(text, projectId, format);
  if (entries.length === 0) {
    return { imported: 0 };
  }
  await store.runWithoutNotifications(async () => {
    for (let offset = 0; offset < entries.length; offset += DIRECTORY_IMPORT_BATCH_SIZE) {
      const batch = entries.slice(offset, offset + DIRECTORY_IMPORT_BATCH_SIZE);
      await store.putDigitalIdDirectoryEntriesBatch(batch);
    }
  });
  return { imported: entries.length };
}

/** Test hook — round-trip directory interchange through an in-memory store. */
export async function roundTripDirectoryInterchangeForTest(
  store: ProjectPersistence,
  projectId: string,
  format: DirectoryInterchangeFormat,
): Promise<{ exported: DigitalIdDirectoryEntry[]; imported: DigitalIdDirectoryEntry[] }> {
  const exported = await collectDirectoryEntries(store, projectId);
  const content = serialiseDirectoryInterchangeFile(exported, format);
  await store.deleteDigitalIdDirectoryForProject(projectId);
  await importDirectoryInterchangeContent(store, projectId, content, format);
  const imported = await collectDirectoryEntries(store, projectId);
  return { exported, imported };
}
