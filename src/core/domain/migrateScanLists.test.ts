import { describe, expect, it } from 'vitest';
import { newFormatBuild } from '@core/domain/factories.ts';
import { initialRevision } from '@core/models/revision.ts';
import { migrateBuildScanListsToLibrary } from './migrateScanLists.ts';

const PROJECT_ID = 'project-1';
const SCAN_LIST_ID = 'scan-list-1';

describe('migrateBuildScanListsToLibrary', () => {
  it('hoists layout scan lists into library and strips layout sections', () => {
    const aggregate = migrateBuildScanListsToLibrary({
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
      channels: [],
      zones: [],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
      channelDefaults: { forbidTransmit: false, txPermit: 'permitAlways', sendTalkerAlias: 'on', analogSquelchMode: 'carrier' },
      aprsConfiguration: null,
      formatBuilds: [
        {
          ...newFormatBuild(PROJECT_ID, 'anytone-at-d890uv'),
          layout: {
            sections: [
              {
                kind: 'scanLists',
                scanLists: [
                  {
                    id: SCAN_LIST_ID,
                    name: 'Zone A SCL',
                    channelIds: ['ch-1', 'ch-2'],
                  },
                ],
              },
            ],
          },
          channelOverrides: [
            { libraryEntityId: 'ch-1', scanListId: SCAN_LIST_ID } as {
              libraryEntityId: string;
              scanListId: string;
            },
          ],
        },
      ],
    });

    expect(aggregate.scanLists).toHaveLength(1);
    expect(aggregate.scanLists[0]).toMatchObject({
      id: SCAN_LIST_ID,
      name: 'Zone A SCL',
      memberChannelIds: ['ch-1', 'ch-2'],
    });
    expect(aggregate.formatBuilds[0]?.layout.sections).toEqual([]);
    expect(
      (aggregate.formatBuilds[0]?.channelOverrides[0] as { scanListId?: string }).scanListId,
    ).toBe(SCAN_LIST_ID);
  });
});
