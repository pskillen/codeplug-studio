import { describe, expect, it } from 'vitest';
import { migrateZoneMemberEntries } from './migrateZoneMembers.ts';
import type { ProjectAggregate } from '@core/import-export/projectDocument.ts';

describe('migrateZoneMemberEntries', () => {
  it('normalises v5 channelId-only members to discriminated channel entries', () => {
    const aggregate = {
      meta: {
        id: 'p1',
        projectId: 'p1',
        name: 'Test',
        author: '',
        description: '',
        notes: '',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
        revision: 1,
      },
      channels: [],
      zones: [
        {
          id: 'z1',
          projectId: 'p1',
          revision: 1,
          updatedAt: '2026-01-01T00:00:00.000Z',
          name: 'Zone',
          comment: '',
          members: [{ channelId: 'ch-1' } as ProjectAggregate['zones'][number]['members'][number]],
        },
      ],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: null,
      formatBuilds: [],
    } satisfies ProjectAggregate;

    const migrated = migrateZoneMemberEntries(aggregate);
    expect(migrated.zones[0]?.members).toEqual([{ kind: 'channel', channelId: 'ch-1' }]);
  });
});
