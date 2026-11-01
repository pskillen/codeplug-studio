import { describe, expect, it } from 'vitest';
import type { PersistableRow } from '@core/models/revision.ts';
import {
  diffProjectEntities,
  PROJECT_ENTITY_KINDS,
  type ProjectEntitySets,
} from './projectEntityDiff.ts';

function row(id: string, extra: Record<string, unknown> = {}): PersistableRow {
  return {
    id,
    projectId: 'p1',
    revision: 1,
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...extra,
  };
}

function sets(partial: Partial<ProjectEntitySets>): ProjectEntitySets {
  const empty = Object.fromEntries(PROJECT_ENTITY_KINDS.map((k) => [k, []]));
  return { ...empty, ...partial } as ProjectEntitySets;
}

describe('diffProjectEntities', () => {
  it('returns nothing for identical sets', () => {
    const a = sets({ channels: [row('c1', { name: 'A', freq: 1 })] });
    expect(diffProjectEntities(a, a)).toEqual([]);
  });

  it('ignores updatedAt, revision and projectId', () => {
    const local = sets({ channels: [row('c1', { name: 'A' })] });
    const remote = sets({
      channels: [
        row('c1', {
          name: 'A',
          updatedAt: '2030-01-01T00:00:00.000Z',
          revision: 9,
          projectId: 'x',
        }),
      ],
    });
    expect(diffProjectEntities(local, remote)).toEqual([]);
  });

  it('reports added (remote only), removed (local only) and changed by id', () => {
    const local = sets({
      channels: [row('c1', { name: 'A', n: 1 }), row('c2', { name: 'Gone' })],
    });
    const remote = sets({
      channels: [row('c1', { name: 'A', n: 2 }), row('c3', { name: 'New' })],
      radioBuilds: [row('b1', { name: 'Build' })],
    });
    expect(diffProjectEntities(local, remote)).toEqual([
      { kind: 'channels', id: 'c3', name: 'New', change: 'added' },
      { kind: 'channels', id: 'c1', name: 'A', change: 'changed' },
      { kind: 'channels', id: 'c2', name: 'Gone', change: 'removed' },
      { kind: 'radioBuilds', id: 'b1', name: 'Build', change: 'added' },
    ]);
  });

  it('treats a rename with the same id as changed, not add+remove', () => {
    const local = sets({ zones: [row('z1', { name: 'Old' })] });
    const remote = sets({ zones: [row('z1', { name: 'New' })] });
    expect(diffProjectEntities(local, remote)).toEqual([
      { kind: 'zones', id: 'z1', name: 'New', change: 'changed' },
    ]);
  });

  it('matches by id, not by name', () => {
    const local = sets({ zones: [row('z1', { name: 'Same' })] });
    const remote = sets({ zones: [row('z2', { name: 'Same' })] });
    const changes = diffProjectEntities(local, remote).map((c) => c.change);
    expect(changes).toEqual(['added', 'removed']);
  });

  it('is insensitive to object key order', () => {
    const local = sets({ channels: [row('c1', { a: 1, b: { x: 1, y: 2 } })] });
    const remote = sets({ channels: [row('c1', { b: { y: 2, x: 1 }, a: 1 })] });
    expect(diffProjectEntities(local, remote)).toEqual([]);
  });

  it('falls back to label then id for display names', () => {
    const remote = sets({
      egressPaths: [row('e1', { label: 'My path' }), row('e2')],
    });
    const names = diffProjectEntities(sets({}), remote).map((c) => c.name);
    expect(names.sort()).toEqual(['My path', 'e2'].sort());
  });
});
