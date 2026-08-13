import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import {
  DM32_BLOCK_SIZE,
  DM32_METADATA,
  DM32_METADATA_OFFSET,
} from '@integrations/radio-io/radios/dm32uv/constants.ts';
import { DM32UV_DESCRIPTOR } from '@integrations/radio-io/radios/dm32uv/descriptor.ts';
import type { Dm32DownloadCache } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { Dm32uvProtocol } from '@integrations/radio-io/radios/dm32uv/protocol.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import type { MemoryMap, RadioSession } from '@integrations/radio-io/types.ts';
import {
  prepareRadioWriteImage,
  uploadPreparedRadioWrite,
  writeBuildToRadio,
} from './radioIoSession.ts';
import { assembledChannelsToRadioDtos } from './radioIoChannelMap.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';

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

describe('DM-32UV write without persisted hydration bag', () => {
  it('prepareRadioWriteImage succeeds without egress hydration bag', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');
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
    const prepared = await prepareRadioWriteImage(
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      { ...egress, hydration: undefined },
      emptyLibrary([ch]),
    );
    expect(prepared.image).toBeUndefined();
    expect(prepared.channels.some((row) => row.wireName === 'TEST')).toBe(true);
  });

  it('writes without an egress hydration bag onto the in-session download cache', async () => {
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
      b[1] = 0;
    });
    const settingsBlock = makeBlock(DM32_METADATA.VFO_SETTINGS, (b) => {
      b[0] = 0x42;
    });
    const liveCache: Dm32DownloadCache = {
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
    const download = vi.fn(async () => createMemoryMap(liveCache.mapSize));
    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const seedDownloadCache = vi.fn();
    const radio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download,
      upload,
      decodeChannels: () => [],
      encodeChannels: (img: MemoryMap) => img,
      readFirmware: () => undefined,
      getDownloadCache: () => liveCache,
      seedDownloadCache: seedDownloadCache as Dm32uvProtocol['seedDownloadCache'],
    } as unknown as Dm32uvProtocol;
    Object.setPrototypeOf(radio, Dm32uvProtocol.prototype);

    const session: RadioSession = {
      descriptor: DM32UV_DESCRIPTOR,
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
    expect(egress.hydration).toBeUndefined();
    await writeBuildToRadio(
      session,
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      egress,
      emptyLibrary([ch]),
    );
    expect(download).toHaveBeenCalledTimes(1);
    expect(seedDownloadCache).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    expect(uploaded.bytes[DM32_BLOCK_SIZE]).toBe(0x42);
    expect(uploaded.bytes[DM32_BLOCK_SIZE + DM32_METADATA_OFFSET]).toBe(DM32_METADATA.VFO_SETTINGS);
  });
});

describe('DM-32UV in-session pre-write content read', () => {
  it('sets hydrationRequiredForWrite false', () => {
    expect(DM32UV_DESCRIPTOR.hydrationRequiredForWrite).toBe(false);
  });

  it('does not seed the write cache from a persisted hydration bag', () => {
    expect(DM32UV_DESCRIPTOR.hydration.seedProtocolForUpload).toBeUndefined();
  });

  it('uploadPreparedRadioWrite bulk-reads live contents before overlay upload', async () => {
    const liveSettings = makeBlock(DM32_METADATA.VFO_SETTINGS, (b) => {
      b[0] = 0x42;
    });
    const channelBlock = makeBlock(DM32_METADATA.CHANNEL_FIRST, (b) => {
      b[0] = 1;
      b[1] = 0;
    });
    const liveCache: Dm32DownloadCache = {
      addressBase: 0x1000,
      mapSize: DM32_BLOCK_SIZE * 2,
      discovered: [
        { address: 0x1000, metadata: DM32_METADATA.CHANNEL_FIRST, type: 'channel' },
        { address: 0x2000, metadata: DM32_METADATA.VFO_SETTINGS, type: 'vfo' },
      ],
      blocks: new Map([
        [0x1000, channelBlock],
        [0x2000, liveSettings],
      ]),
    };

    const download = vi.fn(
      async (opts?: {
        progressStage?: string;
        onProgress?: (p: { cur: number; max: number; msg: string; stage?: string }) => void;
      }) => {
        opts?.onProgress?.({
          cur: 1,
          max: 1,
          msg: 'Reading live block contents…',
          stage: opts.progressStage,
        });
        return createMemoryMap(liveCache.mapSize);
      },
    );
    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const seedDownloadCache = vi.fn();
    const radio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download,
      upload,
      decodeChannels: () => [],
      encodeChannels: (img: MemoryMap) => img,
      readFirmware: () => undefined,
      getDownloadCache: () => liveCache,
      seedDownloadCache: seedDownloadCache as Dm32uvProtocol['seedDownloadCache'],
    } as unknown as Dm32uvProtocol;
    Object.setPrototypeOf(radio, Dm32uvProtocol.prototype);

    const session: RadioSession = {
      descriptor: DM32UV_DESCRIPTOR,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { egress } = newRadioBuildForProfile('p1', 'radio-io-dm32uv');

    const liveChannel: RadioChannelDto = {
      slotIndex: 1,
      empty: false,
      wireName: 'LIVE',
      rxHz: 145_500_000,
      txHz: 145_500_000,
      rxTone: { kind: 'none' },
      txTone: { kind: 'none' },
      powerPercent: 100,
      bandwidth: 'FM',
    };

    await uploadPreparedRadioWrite(session, egress, undefined, {
      channels: [liveChannel],
    });

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ progressStage: 'Pre-write read' }),
    );
    expect(seedDownloadCache).not.toHaveBeenCalled();
    expect(upload).toHaveBeenCalledTimes(1);
    expect(download.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]!);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    expect(uploaded.bytes[DM32_BLOCK_SIZE]).toBe(0x42);
  });

  it('hardware verify pending — operator to confirm on DM-32UV', () => {
    expect(true).toBe(true);
  });
});
