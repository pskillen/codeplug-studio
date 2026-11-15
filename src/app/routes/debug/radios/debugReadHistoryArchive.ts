import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { openDebugArchive, type DebugArchive } from './captureArchive.ts';
import type { RadioDebugDescriptor } from './descriptors.ts';
import type { DebugHistoryEntry } from './debugReadHistory.ts';

type Descriptor = Pick<RadioDebugDescriptor, 'slug' | 'archiveModelId'>;
const FORMAT = 'codeplug-studio-debug-history';
const pathFor = (index: number) => `reads/${String(index + 1).padStart(6, '0')}.zip`;

export function buildDebugReadHistoryZip(
  descriptor: Descriptor,
  entries: readonly DebugHistoryEntry[],
): Uint8Array {
  const files: Record<string, Uint8Array> = {};
  const reads = entries.map((entry, index) => {
    const path = pathFor(index);
    files[path] = entry.archive.zipBytes;
    return { path, capturedAt: entry.readAt };
  });
  files['history.json'] = strToU8(
    JSON.stringify({ format: FORMAT, version: 1, ...descriptor, reads }),
  );
  return zipSync(files);
}

/** Recognise the index before trying single-backup or older Mini formats. */
export function isDebugReadHistoryZip(bytes: Uint8Array): boolean {
  try {
    return 'history.json' in unzipSync(bytes);
  } catch {
    return false;
  }
}

export function openDebugReadHistoryZip(
  bytes: Uint8Array,
  descriptor: Descriptor,
): readonly DebugArchive[] {
  const seen = new Set<string>();
  const files = unzipSync(bytes, {
    filter: (file) => {
      if (seen.has(file.name)) throw new Error('Duplicate history file.');
      seen.add(file.name);
      return true;
    },
  });
  let index: unknown;
  try {
    index = JSON.parse(strFromU8(files['history.json']!));
  } catch {
    throw new Error('Invalid history index.');
  }
  if (!index || typeof index !== 'object') throw new Error('Invalid history index.');
  const data = index as Record<string, unknown>;
  if (data.format !== FORMAT || data.version !== 1 || !Array.isArray(data.reads))
    throw new Error('Unsupported history format or version.');
  if (data.slug !== descriptor.slug || data.archiveModelId !== descriptor.archiveModelId)
    throw new Error('History model does not match this profile.');
  const expected = new Set(['history.json']);
  const archives = data.reads.map((item: unknown, i: number) => {
    if (!item || typeof item !== 'object') throw new Error('Invalid history read.');
    const read = item as Record<string, unknown>;
    const path = pathFor(i);
    if (
      read.path !== path ||
      expected.has(path) ||
      !(path in files) ||
      typeof read.capturedAt !== 'string' ||
      !Number.isFinite(Date.parse(read.capturedAt))
    )
      throw new Error('Invalid history read path or time.');
    expected.add(path);
    const archive = openDebugArchive(files[path]!, descriptor.archiveModelId);
    if (archive.manifest.capturedAt !== read.capturedAt)
      throw new Error('History capture time does not match archive.');
    return archive;
  });
  if (Object.keys(files).some((path) => !expected.has(path)))
    throw new Error('Unexpected history file.');
  return archives;
}
