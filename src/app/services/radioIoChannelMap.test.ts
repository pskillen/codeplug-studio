import { describe, expect, it } from 'vitest';
import { newChannel } from '@core/domain/factories.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

describe('assembledChannelsToRadioDtos', () => {
  it('maps wire name, slot, Hz, and NFM bandwidth', () => {
    const projectId = 'p1';
    const entity = {
      ...newChannel(projectId, 'Library Name'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 20,
      modeProfiles: [
        {
          mode: 'fm' as const,
          squelch: null,
          rxTone: '88.5',
          txTone: 'none',
          bandwidthKHz: 12.5,
        },
      ],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'WIRE12',
      orderOrSlot: 7,
    };
    const dtos = assembledChannelsToRadioDtos([row]);
    expect(dtos).toHaveLength(1);
    expect(dtos[0]).toMatchObject({
      slotIndex: 7,
      wireName: 'WIRE12',
      rxHz: 145_500_000,
      powerPercent: 20,
      bandwidth: 'NFM',
      rxTone: { kind: 'ctcss', hz: 88.5 },
    });
  });

  it('skips channels without RX frequency', () => {
    const entity = {
      ...newChannel('p1', 'Empty'),
      id: 'ch-2',
      rxFrequency: null,
      modeProfiles: [],
    };
    expect(assembledChannelsToRadioDtos([{ entity, wireName: 'X' }])).toEqual([]);
  });
});
