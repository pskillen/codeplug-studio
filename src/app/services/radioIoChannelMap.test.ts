import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { AssembledChannel } from '@core/services/assemble.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

describe('assembledChannelsToRadioDtos', () => {
  it('maps wire name, slot, Hz, and NFM bandwidth', () => {
    const projectId = 'p1';
    const { build, egress } = newRadioBuildForProfile(projectId, 'radio-io-uv5r-mini');
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
      wireNameOverride: 'WIRE12',
      orderOrSlot: 7,
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
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

  it('shortens long names to the radio-io profile nameLimit', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Very Long Channel Name Indeed'),
      id: 'ch-long',
      rxFrequency: 145_000_000,
      txFrequency: 145_000_000,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const row: AssembledChannel = {
      entity,
      wireName: 'Very Long Channel Name Indeed',
    };
    const dtos = assembledChannelsToRadioDtos([row], build, egress);
    expect(dtos[0]?.wireName.length).toBeLessThanOrEqual(12);
  });

  it('skips channels without RX frequency', () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const entity = {
      ...newChannel('p1', 'Empty'),
      id: 'ch-2',
      rxFrequency: null,
      modeProfiles: [],
    };
    expect(assembledChannelsToRadioDtos([{ entity, wireName: 'X' }], build, egress)).toEqual([]);
  });
});
