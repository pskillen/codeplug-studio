import { describe, expect, it } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { ChannelModeProfileAnalog } from '@core/models/library.ts';
import { defaultModeProfile } from '@core/domain/modeProfiles.ts';
import { mapReadChannel } from '@core/services/radioRead/mapReadChannel.ts';
import {
  encodeChannelRecord,
  decodeChannelRecord,
} from '@integrations/radio-io/radios/uv17pro-family/channelCodec.ts';
import { UV5R_MINI_LAYOUT } from '@integrations/radio-io/radios/uv17pro-family/layout.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

describe('Mini channel write and read', () => {
  it.each(['none', '88.5', '123.0', 'D023N', 'D023I'])(
    'round trips %s on each tone direction',
    (tone) => {
      for (const direction of ['rxTone', 'txTone'] as const)
        for (const bandwidthKHz of [12.5, 25] as const)
          for (const power of [20, 100]) {
            const profile = {
              ...(defaultModeProfile('fm') as ChannelModeProfileAnalog),
              mode: 'fm' as const,
              rxTone: 'none',
              txTone: 'none',
              [direction]: tone,
              bandwidthKHz,
            };
            const entity = {
              ...newChannel('project', 'Test'),
              rxFrequency: 145500000,
              txFrequency: 145000000,
              power,
              primaryMode: 'fm' as const,
              modeProfiles: [profile],
              scanInclusion: (power === 20 ? 'skip' : 'alwaysScan') as 'skip' | 'alwaysScan',
              forbidTransmit: 'allow' as const,
            };
            const { build } = newRadioBuildForProfile('project', 'radio-io-uv5r-mini');
            const dto = assembledChannelsToRadioDtos([{ entity, wireName: 'Test' }], build, {
              formatId: 'radio-io',
              profileId: 'radio-io-uv5r-mini',
            })[0]!;
            // Real writes stamp this in stampUv17ProFlatMemoryChannelBehaviour.
            dto.scanAdd = entity.scanInclusion === 'alwaysScan';
            const read = mapReadChannel(
              decodeChannelRecord(UV5R_MINI_LAYOUT, encodeChannelRecord(UV5R_MINI_LAYOUT, dto), 1),
            )!;
            expect(read.fields).toMatchObject({
              rxFrequency: entity.rxFrequency,
              txFrequency: entity.txFrequency,
              power,
              scanInclusion: entity.scanInclusion,
              forbidTransmit: 'allow',
              mode: 'fm',
              analog: { rxTone: profile.rxTone, txTone: profile.txTone, bandwidthKHz },
            });
          }
    },
  );
  it('preserves receive-only and applies the lossy power ladder', () => {
    const entity = {
      ...newChannel('project', 'Test'),
      rxFrequency: 145500000,
      txFrequency: 145000000,
      power: 50,
      primaryMode: 'fm' as const,
      modeProfiles: [defaultModeProfile('fm')],
      forbidTransmit: 'forbid' as const,
    };
    const { build } = newRadioBuildForProfile('project', 'radio-io-uv5r-mini');
    const dto = assembledChannelsToRadioDtos([{ entity, wireName: 'Test' }], build, {
      formatId: 'radio-io',
      profileId: 'radio-io-uv5r-mini',
    })[0]!;
    const read = mapReadChannel(
      decodeChannelRecord(UV5R_MINI_LAYOUT, encodeChannelRecord(UV5R_MINI_LAYOUT, dto), 1),
    )!;
    expect(read.fields).toMatchObject({
      power: 20,
      forbidTransmit: 'forbid',
      txFrequency: entity.rxFrequency,
    });
  });
});
