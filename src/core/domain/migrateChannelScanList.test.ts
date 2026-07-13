import { describe, expect, it } from 'vitest';
import { newChannel, newFormatBuild } from '@core/domain/factories.ts';
import { initialRevision } from '@core/models/revision.ts';
import { migrateChannelScanListFromBuildOverrides } from './migrateChannelScanList.ts';

const PROJECT_ID = 'project-1';
const SCAN_LIST_ID = 'scan-list-1';
const CH1_ID = 'ch-1';

describe('migrateChannelScanListFromBuildOverrides', () => {
  it('hoists channelOverrides.scanListId onto library channels and strips overrides', () => {
    const ch1 = { ...newChannel(PROJECT_ID, 'Alpha'), id: CH1_ID };
    const result = migrateChannelScanListFromBuildOverrides({
      meta: {
        id: PROJECT_ID,
        projectId: PROJECT_ID,
        revision: initialRevision(),
        updatedAt: '2026-07-08T00:00:00.000Z',
        createdAt: '2026-07-08T00:00:00.000Z',
        name: 'Test',
        author: '',
        description: '',
        notes: '',
      },
      channels: [ch1],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      aprsConfiguration: null,
      formatBuilds: [
        {
          ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
          channelOverrides: [
            { libraryEntityId: CH1_ID, scanListId: SCAN_LIST_ID } as {
              libraryEntityId: string;
              scanListId: string;
            },
          ],
        },
      ],
    });

    expect(result.channels[0]?.scanListId).toBe(SCAN_LIST_ID);
    expect(result.formatBuilds[0]?.channelOverrides).toEqual([]);
  });
});
