import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_DESCRIPTOR } from '@integrations/radio-io/radios/uv5r-mini/descriptor.ts';
import {
  extractUv5rMiniHydration,
  mergeChannelsIntoUv5rMiniHydration,
} from '@integrations/radio-io/radios/uv5r-mini/hydration.ts';
import { Uv17ProProtocol } from '@integrations/radio-io/radios/uv17pro-family/protocol.ts';
import { memoryMapFromBytes } from '@integrations/radio-io/kit/memoryMap.ts';
import { UV5R_MINI_MEM_TOTAL } from '@integrations/radio-io/radios/uv5r-mini/constants.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioHydrationHooks,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import {
  buildHasRadioCloneHydration,
  descriptorsForBuild,
  openRadioSessionForBuild,
  prepareRadioWriteImage,
  RadioWriteBlockedError,
  uploadPreparedRadioWrite,
  verifyRadioWrite,
  writeBuildToRadio,
} from './radioIoSession.ts';
import { AT_D890_WRITE_VERIFY_HOOKS } from '@integrations/radio-io/radios/at-d890uv/writeVerifyHooks.ts';
import { AT_D890UV_DESCRIPTOR } from '@integrations/radio-io/radios/at-d890uv/descriptor.ts';
import * as radioIo from '@integrations/radio-io/index.ts';
import * as radioWriteEnvGate from './radioWriteEnvGate.ts';

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

function uv5rMiniRadioIo() {
  return newRadioBuildForProfile('p1', 'radio-io-uv5r-mini');
}

const miniHydration: RadioHydrationHooks = {
  extractHydration: extractUv5rMiniHydration,
  mergeChannelsIntoHydration: mergeChannelsIntoUv5rMiniHydration,
};

function miniDescriptor(radio: CloneImageRadio): RadioDescriptor {
  return {
    modelIds: ['UV5R-Mini'],
    label: 'Mini',
    supportsBle: false,
    protocolFactory: () => radio,
    capabilities: {
      maxChannels: 999,
      supportsZones: false,
      supportsScanLists: false,
      analogOnly: true,
    },
    attributionIds: ['chirp', 'neonplug'],
    compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' }],
    writeStrategy: 'full-image',
    hydrationRequiredForWrite: true,
    baudRate: 115200,
    baudRateFallback: 38400,
    hydration: miniHydration,
  };
}

describe('radioIoSession helpers', () => {
  it('lists Mini descriptor for radio-io-uv5r-mini egress', () => {
    const { egress } = uv5rMiniRadioIo();
    expect(descriptorsForBuild(egress).length).toBeGreaterThan(0);
  });

  it('does not list Mini for NeonPlug file egress', () => {
    const { egress } = newRadioBuildForProfile('p1', 'neonplug-uv5rmini');
    expect(descriptorsForBuild(egress)).toHaveLength(0);
  });

  it('detects radio-clone hydration on egress', () => {
    const image = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    image.fill(0xff);
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: image,
    });
    const { egress } = uv5rMiniRadioIo();
    expect(buildHasRadioCloneHydration({ ...egress, hydration })).toBe(true);
    expect(buildHasRadioCloneHydration(egress)).toBe(false);
  });

  it('prepares UV-5R Mini write without persisted hydration bag', async () => {
    const ch = {
      ...newChannel('p1', 'Test'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = uv5rMiniRadioIo();
    const { image, channels } = await prepareRadioWriteImage(
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      egress,
      emptyLibrary([ch]),
    );
    expect(image).toBeUndefined();
    expect(channels.length).toBeGreaterThan(0);
  });

  it('prepares OpenGD77 DM-1701 write without persisted hydration bag', async () => {
    const ch = {
      ...newChannel('p1', 'Test'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-opengd77-1701');
    const { image, channels } = await prepareRadioWriteImage(
      {
        ...build,
        channelOverrides: [{ libraryEntityId: 'ch-1', wireName: 'TEST', orderOrSlot: 1 }],
      },
      egress,
      emptyLibrary([ch]),
    );
    expect(image).toBeUndefined();
    expect(channels.length).toBeGreaterThan(0);
  });

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
    const session: RadioSession = {
      descriptor: miniDescriptor(radio),
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { build, egress } = uv5rMiniRadioIo();
    await expect(writeBuildToRadio(session, build, egress, emptyLibrary())).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(radio.upload).not.toHaveBeenCalled();
  });

  it('blocks prepare when prod write gate is hidden', async () => {
    vi.spyOn(radioWriteEnvGate, 'resolveRadioWriteGate').mockReturnValue('hidden');
    const imageBytes = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    imageBytes.fill(0xff);
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes,
    });
    const { build, egress } = uv5rMiniRadioIo();
    await expect(
      prepareRadioWriteImage(build, { ...egress, hydration }, emptyLibrary()),
    ).rejects.toBeInstanceOf(RadioWriteBlockedError);
    vi.restoreAllMocks();
  });

  it('writes via in-session pre-read when no persisted hydration bag', async () => {
    const priorBytes = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    priorBytes.fill(0xff);
    const download = vi.fn(async () => memoryMapFromBytes(priorBytes));
    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const encodeChannels = vi.fn((prior: MemoryMap, _channels: unknown[]) => {
      const next = memoryMapFromBytes(prior.bytes);
      next.bytes[0] = 0xaa;
      void _channels;
      return next;
    });
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
    const ch = {
      ...newChannel('p1', 'Test'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const { build, egress } = uv5rMiniRadioIo();
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
    expect(upload).toHaveBeenCalledTimes(1);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    expect(uploaded.size).toBe(UV5R_MINI_MEM_TOTAL);
    expect(uploaded.bytes[0]).toBe(0xaa);
  });

  it('closes the serial pipe when connect/handshake fails', async () => {
    const close = vi.fn(async () => undefined);
    const pipe = {
      write: vi.fn(),
      readExact: vi.fn(),
      flush: vi.fn(),
      close,
    };
    const port = {
      readable: null,
      writable: null,
      open: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    };
    const portSpy = vi.spyOn(radioIo, 'requestWebSerialPort').mockResolvedValue(port);
    const openSpy = vi.spyOn(radioIo, 'openWebSerialPipe').mockResolvedValue(pipe);
    const listSpy = vi.spyOn(radioIo, 'listDescriptorsForProfile').mockReturnValue([
      {
        modelIds: ['UV5R-Mini'],
        label: 'Mini',
        supportsBle: false,
        protocolFactory: () => ({
          connect: async () => {
            throw new radioIo.RadioTimeoutError('ident timeout');
          },
          disconnect: vi.fn(),
          download: vi.fn(),
          upload: vi.fn(),
          decodeChannels: () => [],
          encodeChannels: (img) => img,
          readFirmware: () => undefined,
        }),
        capabilities: {
          maxChannels: 999,
          supportsZones: false,
          supportsScanLists: false,
          analogOnly: true,
        },
        attributionIds: [],
        compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' }],
        writeStrategy: 'full-image',
        hydrationRequiredForWrite: true,
        baudRate: 115200,
        baudRateFallback: 38400,
        hydration: miniHydration,
      },
    ]);

    const { egress } = uv5rMiniRadioIo();
    await expect(openRadioSessionForBuild(egress)).rejects.toThrow(/ident timeout/);
    expect(close).toHaveBeenCalledTimes(2);
    expect(openSpy).toHaveBeenCalledTimes(2);

    portSpy.mockRestore();
    openSpy.mockRestore();
    listSpy.mockRestore();
  });

  it('returns writeVerifyPending when descriptor writeVerify captures after upload', async () => {
    const captureAfterUpload = vi.fn(() => ({
      staging: {
        capturedAt: '2026-07-29T00:00:00.000Z',
        chunks: [{ address: 0x1000, data: Uint8Array.from([0xaa]) }],
      },
      kept: { entries: [{ id: 'alarm', data: [0xff] }] },
    }));
    const upload = vi.fn(async () => undefined);
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload,
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const session: RadioSession = {
      descriptor: {
        ...AT_D890UV_DESCRIPTOR,
        writeVerify: {
          ...AT_D890_WRITE_VERIFY_HOOKS,
          captureAfterUpload,
        },
      },
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'AT-D890UV',
      imageBytes: new Uint8Array(1024),
    });
    const { egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const image = {
      size: 1024,
      bytes: new Uint8Array(1024),
      get: () => new Uint8Array(16),
      set: () => undefined,
      fill: () => undefined,
    } as MemoryMap;
    const result = await uploadPreparedRadioWrite(session, { ...egress, hydration }, image);
    expect(captureAfterUpload).toHaveBeenCalledWith(session);
    expect(result.writeVerifyPending?.staging.chunks.length).toBe(1);
    expect(result.writeVerifyPending?.kept).toBeDefined();
  });

  it('returns no writeVerifyPending for descriptors without writeVerify hooks', async () => {
    const upload = vi.fn(async () => undefined);
    const radio: CloneImageRadio = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      download: vi.fn(),
      upload,
      decodeChannels: () => [],
      encodeChannels: (img) => img,
      readFirmware: () => undefined,
    };
    const session: RadioSession = {
      descriptor: miniDescriptor(radio),
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes: new Uint8Array(UV5R_MINI_MEM_TOTAL),
    });
    const { egress } = uv5rMiniRadioIo();
    const image = {
      size: UV5R_MINI_MEM_TOTAL,
      bytes: new Uint8Array(UV5R_MINI_MEM_TOTAL),
      get: () => new Uint8Array(16),
      set: () => undefined,
      fill: () => undefined,
    } as MemoryMap;
    const result = await uploadPreparedRadioWrite(session, { ...egress, hydration }, image);
    expect(result.writeVerifyPending).toBeUndefined();
  });

  it('verifyRadioWrite delegates to descriptor writeVerify hooks', async () => {
    const runVerify = vi.fn(async () => ({
      ok: true,
      model: 'AT-D890UV',
      elapsedMs: 1,
      totalBytesRead: 16,
      stagingCapturedAt: 't',
      staging: {
        totalChunks: 0,
        mismatchedChunks: 0,
        mismatches: [],
      },
      regions: [],
      regionGroups: [],
    }));
    const session: RadioSession = {
      descriptor: {
        ...AT_D890UV_DESCRIPTOR,
        writeVerify: { ...AT_D890_WRITE_VERIFY_HOOKS, runVerify },
      },
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio: {
        connect: vi.fn(),
        disconnect: vi.fn(),
        download: vi.fn(),
        upload: vi.fn(),
        decodeChannels: () => [],
        encodeChannels: (img) => img,
        readFirmware: () => undefined,
      },
    };
    const pending = { staging: { capturedAt: 't', chunks: [] } };
    const result = await verifyRadioWrite(session, pending);
    expect(runVerify).toHaveBeenCalledWith(session, pending, undefined);
    expect(result.ok).toBe(true);
  });
});
