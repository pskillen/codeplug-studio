export interface EncodedNameEntry {
  id: string;
  encodedName: string;
}

export interface EncodedNameCollisionGroup {
  encodedName: string;
  ids: string[];
}

/** Case-sensitive collision groups among trimmed encoded names (2+ entries share the same string). */
export function findEncodedNameCollisions(
  entries: readonly EncodedNameEntry[],
): EncodedNameCollisionGroup[] {
  const byName = new Map<string, string[]>();
  for (const entry of entries) {
    const key = entry.encodedName.trimEnd();
    if (!key) continue;
    const ids = byName.get(key) ?? [];
    ids.push(entry.id);
    byName.set(key, ids);
  }
  const groups: EncodedNameCollisionGroup[] = [];
  for (const [encodedName, ids] of byName) {
    if (ids.length > 1) {
      groups.push({ encodedName, ids: [...ids] });
    }
  }
  groups.sort((a, b) => a.encodedName.localeCompare(b.encodedName));
  return groups;
}
