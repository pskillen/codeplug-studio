import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { DM32_BLOCK_SIZE, DM32_METADATA, DM32_METADATA_OFFSET } from '@integrations/radio-io/radios/dm32uv/constants.ts';
import {
  extractDm32uvHydrationFromProtocol,
  mergeChannelsIntoDm32uvHydration,
} from '@integrations/radio-io/radios/dm32uv/hydration.ts';
import type { Dm32DownloadCache } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { RadioWriteBlockedError, writeBuildToRadio } from './radioIoSession.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';

function emptyLibrary(channels: LibrarySlice['channels'] = []): LibrarySlice {
  return {
    channels,
    zones: [],
    scanLists: [],
    talkGroups: [],
    digitalContacts: [],
    analogContacts: [],
    rxGroupLists: [],
    aprsConfiguration: null,
  };
}

function makeBlock(metadata: number, mutate?: (b: Uint8Array) => void): Uint8Array {
  const b = new Uint8Array(DM32_BLOCK_SIZE);
  b.fill(0xff);
  b[DM32_METADATA_OFFSET] = metadata;
  mutate?.(b);
  return b;
}

describe('assembledChannelsToRadioDtos digital fields', () => {
  it('maps DMR colour code and timeslot', () => {
    const ch = {
      ...newChannel('p1', 'DIG'),
      id: 'ch-d',
      rxFrequency: 440_000_000,
      txFrequency: 440_000_000,
      modeProfiles: [
        {
          mode: 'dmr' as const,
          colourCode: 3,
          timeslot: 2 as const,
          dmrId: null,
          contactRef: null,
          rxGroupListId: null,
        },
      ],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    const dtos = assembledChannelsToRadioDtos(
      [
        {
          entity: ch,
          wireName: 'DIG',
          orderOrSlot: 1,
          excluded: false,
          forceInclude: false,
        },
      ],
      build,
      egress,
    );
    expect(dtos[0]?.mode).toBe('digital');
    expect(dtos[0]?.colorCode).toBe(3);
    expect(dtos[0]?.timeslot).toBe(2);
  });
});

describe('DM-32UV write via hydration merge', () => {
  it('blocks write without hydration', async () => {
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload: vi.fn(),
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const descriptor: RadioDescriptor = {
      modelIds: ['DM-32UV'],
      label: 'DM-32',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: [],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-dm32uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 115200,
      hydration: {
        extractHydration: () => {
          throw new Error('unused');
        },
        mergeChannelsIntoHydration: mergeChannelsIntoDm32uvHydration,
      },
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    await expect(writeBuildToRadio(session, build, egress, emptyLibrary())).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
  });

  it('merges channels into sparse hydration and uploads', async () => {
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
      b[1] = 0;
    });
    const settingsBlock = makeBlock(DM32_METADATA.VFO_SETTINGS);
    const cache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 2,
      discovered: [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [0x1000, channelBlock],
        [0x2000, settingsBlock],
      ]),
    };
    const image = createMemoryMap(cache.mapSize);
    image.fill(0, cache.mapSize, 0xff);
    image.set(0, channelBlock);
    image.set(DM32_BLOCK_SIZE, settingsBlock);
    const hydration = extractDm32uvHydrationFromProtocol(image, cache);

    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload,
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const descriptor: RadioDescriptor = {
      modelIds: ['DM-32UV'],
      label: 'DM-32',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: ['neonplug'],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-dm32uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 115200,
      hydration: {
        extractHydration: () => hydration,
        mergeChannelsIntoHydration: mergeChannelsIntoDm32uvHydration,
      },
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const ch = {
      ...newChannel('p1', 'TEST'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
    await writeBuildToRadio(
      session,
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      { ...egress, hydration },
      emptyLibrary([ch]),
    );
    expect(upload).toHaveBeenCalledTimes(1);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    // Settings block metadata preserved
    expect(uploaded.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.VFO_SETTINGS);
  });
});
