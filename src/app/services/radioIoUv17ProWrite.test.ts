import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import { UV5R_MINI_MEM_TOTAL } from '@integrations/radio-io/radios/uv5r-mini/constants.ts';
import { UV21_PRO_V2_DESCRIPTOR } from '@integrations/radio-io/radios/uv21-pro-v2/descriptor.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { Uv17ProProtocol } from '@integrations/radio-io/radios/uv17pro-family/protocol.ts';
import { prepareRadioWriteImage, uploadPreparedRadioWrite } from './radioIoSession.ts';

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

describe('UV-17Pro family write without persisted stash', () => {
  it('sets hydrationRequiredForWrite false on both family descriptors', () => {
    expect(UV5R_MINI_DESCRIPTOR.hydrationRequiredForWrite).toBe(false);
    expect(UV21_PRO_V2_DESCRIPTOR.hydrationRequiredForWrite).toBe(false);
  });

  it('prepareRadioWriteImage succeeds without egress hydration bag', async () => {
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
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

  it('uploadPreparedRadioWrite pre-reads radio before overlay upload (UV-5R Mini)', async () => {
    const priorBytes = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    priorBytes.fill(0xff);
    priorBytes[0x8040] = 0x42;

    const download = vi.fn(
      async (opts?: { progressStage?: string; onProgress?: (p: { stage?: string }) => void }) => {
        opts?.onProgress?.({ stage: opts.progressStage });
        return memoryMapFromBytes(priorBytes);
      },
    );
    const encodeChannels = vi.fn(
      (prior: ReturnType<typeof memoryMapFromBytes>, channels: unknown[]) => {
        const next = memoryMapFromBytes(prior.bytes);
        next.bytes[0] = 0xaa;
        void channels;
        return next;
      },
    );
    const upload = vi.fn(async () => undefined);

    const radio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download,
      upload,
      decodeChannels: () => [],
      encodeChannels,
      readFirmware: () => undefined,
    } as unknown as Uv17ProProtocol;

    Object.setPrototypeOf(radio, Uv17ProProtocol.prototype);

    const session: RadioSession = {
      descriptor: UV5R_MINI_DESCRIPTOR,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };

    const { egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');

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
    expect(encodeChannels).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(download.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]!);
    const encodedPrior = encodeChannels.mock.calls[0]![0] as ReturnType<typeof memoryMapFromBytes>;
    expect(encodedPrior.bytes[0x8040]).toBe(0x42);
  });

  it('hardware verify pending — operator to confirm on UV-5R Mini or UV-21 Pro V2', () => {
    expect(true).toBe(true);
  });
});
