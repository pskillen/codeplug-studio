import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { Channel } from '@core/models/library.ts';
import type { AssembledBuild } from '@core/services/assemble.ts';
import { buildDm32uvChannelNumberMap, singletonChannelNumbersById } from './exportContext.ts';
import { NEONPLUG_DM32UV_PROFILE } from './profiles.ts';
import { serialiseNeonplugCodeplug } from './serialise.ts';
import { serialiseNeonplugZones } from './zones.ts';

const projectId = '11111111-1111-4111-8111-111111111111';

function fmChannel(id: string, name: string): Channel {
  return {
    ...newChannel(projectId, name),
    id,
    rxFrequency: 145_500_000,
    txFrequency: 145_500_000,
    modeProfiles: [
      {
        mode: 'fm',
        rxTone: 'none',
        txTone: 'none',
        squelch: null,
        bandwidthKHz: 12.5,
      },
    ],
  };
}

describe('neonplug/zones', () => {
  it('emits zones with unique ordered channel numbers', () => {
    const ch1 = fmChannel('ch-1', 'Alpha');
    const ch2 = fmChannel('ch-2', 'Bravo');
    const ch3 = fmChannel('ch-3', 'Charlie');
    const assembled: AssembledBuild = {
      buildId: 'b1',
      formatId: 'neonplug',
      profileId: 'neonplug-dm32uv',
      buildName: 'DM32 Neon',
      channels: [
        { entity: ch1, wireName: 'Alpha' },
        { entity: ch2, wireName: 'Bravo' },
        { entity: ch3, wireName: 'Charlie' },
      ],
      zones: [
        {
          zoneId: 'zone-1',
          wireName: 'Local',
          memberChannelIds: ['ch-1', 'ch-3', 'ch-1'],
        },
      ],
      talkGroups: [],
      digitalContacts: [],
      analogContacts: [],
      rxGroupLists: [],
      scanLists: [],
    };

    const warnings: string[] = [];
    const numbersBySource = singletonChannelNumbersById(
      buildDm32uvChannelNumberMap(assembled, 4000),
    );
    const zones = serialiseNeonplugZones(
      assembled,
      NEONPLUG_DM32UV_PROFILE,
      numbersBySource,
      { shortenNames: false },
      warnings,
    );

    expect(warnings).toEqual([]);
    expect(zones).toEqual([{ id: 'zone-1', name: 'Local', channels: [1, 3] }]);

    const { data } = serialiseNeonplugCodeplug(assembled, {
      exportDate: '2026-07-20T12:00:00.000Z',
      shortenNames: false,
    });
    expect(data.zones).toEqual(zones);
  });
});
