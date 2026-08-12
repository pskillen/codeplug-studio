import { describe, expect, it } from 'vitest';
import { newDigitalContact } from '@core/domain/factories.ts';
import { applyCpsDigitalDirectoryProjection } from './cpsDigitalDirectoryProjection.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';

function minimalAssembled(digitalIds: number[]): AssembledBuild {
  return {
    buildId: 'b1',
    formatId: 'opengd77',
    profileId: 'opengd77-1701',
    buildName: 'Test',
    channels: [],
    zones: [],
    talkGroups: [],
    digitalContacts: digitalIds.map((id) => {
      const entity = newDigitalContact('p1', `Lib ${id}`, id, 'dmr');
      return { entity, wireName: `Lib ${id}` };
    }),
    analogContacts: [],
    rxGroupLists: [],
    scanLists: [],
  };
}

describe('applyCpsDigitalDirectoryProjection', () => {
  it('merges dual-bank directory contacts after library rows', () => {
    const assembled = minimalAssembled([100]);
    const { assembled: out } = applyCpsDigitalDirectoryProjection(assembled, {
      directoryProjection: {
        dualBank: {
          includeLibraryContacts: true,
          directoryDigitalContacts: [
            {
              entity: newDigitalContact('p1', 'Dir 200', 200, 'dmr'),
              wireName: 'Dir 200',
            },
          ],
          dm32RadioIds: [],
          includeDm32RadioIdFile: false,
        },
      },
    });
    expect(out.digitalContacts.map((row) => row.entity.digitalId)).toEqual([100, 200]);
  });

  it('omits library contacts when dual-bank library toggle is off', () => {
    const assembled = minimalAssembled([100]);
    const { assembled: out } = applyCpsDigitalDirectoryProjection(assembled, {
      directoryProjection: {
        dualBank: {
          includeLibraryContacts: false,
          directoryDigitalContacts: [
            {
              entity: newDigitalContact('p1', 'Dir 200', 200, 'dmr'),
              wireName: 'Dir 200',
            },
          ],
          dm32RadioIds: [],
          includeDm32RadioIdFile: false,
        },
      },
    });
    expect(out.digitalContacts.map((row) => row.entity.digitalId)).toEqual([200]);
  });

  it('clears digital contacts for single-bank skip', () => {
    const assembled = minimalAssembled([100]);
    const { assembled: out } = applyCpsDigitalDirectoryProjection(assembled, {
      directoryProjection: { omitDigitalContactList: true },
    });
    expect(out.digitalContacts).toEqual([]);
  });
});
