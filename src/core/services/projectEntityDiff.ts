import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';
import type { PersistableRow } from '@core/models/revision.ts';
import type { ProjectSeed } from './projectInterchangePort.ts';

/** Entity collections compared by the sync review — same set as `ProjectSyncCounts`. */
export type ProjectEntityKind =
  | 'channels'
  | 'zones'
  | 'talkGroups'
  | 'digitalContacts'
  | 'analogContacts'
  | 'rxGroupLists'
  | 'scanLists'
  | 'aprsConfigurations'
  | 'radioBuilds'
  | 'egressPaths';

export type ProjectEntityChangeKind = 'added' | 'removed' | 'changed';

/** One entity that differs between the local copy and the remote copy. */
export interface ProjectEntityChange {
  kind: ProjectEntityKind;
  /** Entity UUID — the only matching key. */
  id: string;
  /** Display label only; never used for matching. */
  name: string;
  /**
   * From the point of view of adopting the remote copy: `added` = only in remote,
   * `removed` = only in local, `changed` = same id, different content.
   */
  change: ProjectEntityChangeKind;
}

export type ProjectEntitySets = Record<ProjectEntityKind, ReadonlyArray<PersistableRow>>;

export const PROJECT_ENTITY_KINDS: ProjectEntityKind[] = [
  'channels',
  'zones',
  'talkGroups',
  'digitalContacts',
  'analogContacts',
  'rxGroupLists',
  'scanLists',
  'aprsConfigurations',
  'radioBuilds',
  'egressPaths',
];

/** Row fields that change on every save and say nothing about content. */
const VOLATILE_FIELDS = new Set(['updatedAt', 'revision', 'projectId']);

export function entitySetsFromSeed(seed: ProjectSeed): ProjectEntitySets {
  return {
    channels: seed.channels ?? [],
    zones: seed.zones ?? [],
    talkGroups: seed.talkGroups ?? [],
    digitalContacts: seed.digitalContacts ?? [],
    analogContacts: seed.analogContacts ?? [],
    rxGroupLists: seed.rxGroupLists ?? [],
    scanLists: seed.scanLists ?? [],
    aprsConfigurations: seed.aprsConfigurations ?? [],
    radioBuilds: seed.radioBuilds ?? [],
    egressPaths: seed.egressPaths ?? [],
  };
}

export function entitySetsFromAggregate(aggregate: ProjectAggregate): ProjectEntitySets {
  return {
    channels: aggregate.channels,
    zones: aggregate.zones,
    talkGroups: aggregate.talkGroups,
    digitalContacts: aggregate.digitalContacts,
    analogContacts: aggregate.analogContacts,
    rxGroupLists: aggregate.rxGroupLists,
    scanLists: aggregate.scanLists,
    aprsConfigurations: aggregate.aprsConfiguration ? [aggregate.aprsConfiguration] : [],
    radioBuilds: aggregate.radioBuilds,
    egressPaths: aggregate.egressPaths,
  };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record)
      .filter((key) => record[key] !== undefined)
      .sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function contentFingerprint(row: PersistableRow): string {
  const content: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (!VOLATILE_FIELDS.has(key)) content[key] = value;
  }
  return stableStringify(content);
}

/** Best available display label — never a matching key. */
export function entityDisplayName(row: PersistableRow): string {
  const record = row as unknown as Record<string, unknown>;
  for (const field of ['name', 'label', 'profileId', 'radioTargetId']) {
    const value = record[field];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return row.id;
}

const CHANGE_ORDER: Record<ProjectEntityChangeKind, number> = { added: 0, changed: 1, removed: 2 };

/**
 * Diff two projects by entity UUID `id` across the portable collections.
 * Sorted by collection order, then change (added, changed, removed), then name.
 */
export function diffProjectEntities(
  local: ProjectEntitySets,
  remote: ProjectEntitySets,
): ProjectEntityChange[] {
  const changes: ProjectEntityChange[] = [];

  for (const kind of PROJECT_ENTITY_KINDS) {
    const localById = new Map(local[kind].map((row) => [row.id, row]));
    const remoteById = new Map(remote[kind].map((row) => [row.id, row]));
    const kindChanges: ProjectEntityChange[] = [];

    for (const [id, row] of remoteById) {
      const localRow = localById.get(id);
      if (!localRow) {
        kindChanges.push({ kind, id, name: entityDisplayName(row), change: 'added' });
      } else if (contentFingerprint(localRow) !== contentFingerprint(row)) {
        kindChanges.push({ kind, id, name: entityDisplayName(row), change: 'changed' });
      }
    }
    for (const [id, row] of localById) {
      if (!remoteById.has(id)) {
        kindChanges.push({ kind, id, name: entityDisplayName(row), change: 'removed' });
      }
    }

    kindChanges.sort(
      (a, b) =>
        CHANGE_ORDER[a.change] - CHANGE_ORDER[b.change] ||
        a.name.localeCompare(b.name) ||
        (a.id < b.id ? -1 : 1),
    );
    changes.push(...kindChanges);
  }
  return changes;
}
