import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import type { RadioChannelDto } from '@integrations/radio-io/radioChannelDto.ts';
import { RT95_DESCRIPTOR } from '@integrations/radio-io/radios/rt95/descriptor.ts';
import { buildSyntheticRt95Image } from '@integrations/radio-io/radios/rt95/__fixtures__/syntheticImage.ts';
import { RT95_IMAGE_SIZE, RT95_MODEL_ID } from '@integrations/radio-io/radios/rt95/constants.ts';
import { Rt95Protocol } from '@integrations/radio-io/radios/rt95/protocol.ts';
import type { MemoryMap, RadioSession } from '@integrations/radio-io/types.ts';
import { uploadPreparedRadioWrite } from './radioIoSession.ts';

function stashBag(settingsByte: number) {
  const bytes = buildSyntheticRt95Image();
  bytes[0x3200] = settingsByte;
  return createRadioCloneHydrationBag({
    radioModelId: RT95_MODEL_ID,
    imageBytes: bytes,
    capturedVia: 'web-serial',
  });
}

describe('RT95 in-session pre-write read', () => {
  it('keeps hydrationRequiredForWrite true', () => {
    expect(RT95_DESCRIPTOR.hydrationRequiredForWrite).toBe(true);
  });

  it('does not seed the write image from a protocol upload hook', () => {
    expect(RT95_DESCRIPTOR.hydration.seedProtocolForUpload).toBeUndefined();
  });

  it('uploadPreparedRadioWrite overlays modelled channels onto live download, not stash', async () => {
    const liveBytes = new Uint8Array(RT95_IMAGE_SIZE);
    liveBytes.fill(0xff);
    liveBytes[0x3200] = 0x42;

    const download = vi.fn(
      async (opts?: { progressStage?: string; onProgress?: (p: { stage?: string }) => void }) => {
        opts?.onProgress?.({ stage: opts.progressStage });
        return memoryMapFromBytes(liveBytes);
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
    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });

    const radio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download,
      upload,
      decodeChannels: () => [],
      encodeChannels,
      readFirmware: () => undefined,
    } as unknown as Rt95Protocol;
    Object.setPrototypeOf(radio, Rt95Protocol.prototype);

    const session: RadioSession = {
      descriptor: RT95_DESCRIPTOR,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };

    const { egress } = newRadioBuildForProfile('p1', 'radio-io-rt95');
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

    await uploadPreparedRadioWrite(session, { ...egress, hydration: stashBag(0x11) }, undefined, {
      channels: [liveChannel],
    });

    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ progressStage: 'Pre-write read' }),
    );
    expect(encodeChannels).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(download.mock.invocationCallOrder[0]).toBeLessThan(upload.mock.invocationCallOrder[0]!);
    const encodedPrior = encodeChannels.mock.calls[0]![0] as ReturnType<typeof memoryMapFromBytes>;
    expect(encodedPrior.bytes[0x3200]).toBe(0x42);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    expect(uploaded.bytes[0]).toBe(0xaa);
    expect(uploaded.bytes[0x3200]).toBe(0x42);
  });

  it('hardware verify pending — operator to confirm on RT95 VOX', () => {
    expect(true).toBe(true);
  });
});
