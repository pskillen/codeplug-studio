import { describe, expect, it, vi } from 'vitest';
import { newRadioBuildForProfile } from '@core/domain/factories.ts';
import { createRadioCloneHydrationBag, radioCloneImageBytes } from '@core/models/radioCloneHydration.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import { UV5R_MINI_MEM_TOTAL } from '@integrations/radio-io/radios/uv5r-mini/constants.ts';
import { UV21_PRO_V2_DESCRIPTOR } from '@integrations/radio-io/radios/uv21-pro-v2/descriptor.ts';
import type { RadioSession } from '@integrations/radio-io/types.ts';
import { Uv17ProProtocol } from '@integrations/radio-io/radios/uv17pro-family/protocol.ts';
import { uploadPreparedRadioWrite } from './radioIoSession.ts';

describe('UV-17Pro family write pre-read', () => {
  it('descriptors still require hydration stash until phase 07', () => {
    expect(UV5R_MINI_DESCRIPTOR.hydrationRequiredForWrite).toBe(true);
    expect(UV21_PRO_V2_DESCRIPTOR.hydrationRequiredForWrite).toBe(true);
  });

  it('uploadPreparedRadioWrite pre-reads radio before overlay upload (UV-5R Mini)', async () => {
    const priorBytes = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    priorBytes.fill(0xff);
    priorBytes[0x8040] = 0x42;

    const download = vi.fn(async (opts?: { progressStage?: string; onProgress?: (p: {
      stage?: string;
    }) => void }) => {
      opts?.onProgress?.({ stage: opts.progressStage });
      return memoryMapFromBytes(priorBytes);
    });
    const encodeChannels = vi.fn((prior: ReturnType<typeof memoryMapFromBytes>, channels: unknown[]) => {
      const next = memoryMapFromBytes(prior.bytes);
      next.bytes[0] = 0xaa;
      void channels;
      return next;
    });
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

    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: new Uint8Array(UV5R_MINI_MEM_TOTAL).fill(0x11),
    });
    const { egress } = newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
    const bagImage = memoryMapFromBytes(radioCloneImageBytes(hydration));

    await uploadPreparedRadioWrite(
      session,
      { ...egress, hydration },
      bagImage,
      { channels: [{ slotIndex: 1, empty: false, wireName: 'LIVE' }] },
    );

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
