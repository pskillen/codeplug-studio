import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { createRadioCloneHydrationBag } from '@core/models/radioCloneHydration.ts';
import { UV5R_MINI_MEM_TOTAL } from '@integrations/radio-io/radios/uv5r-mini/constants.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import {
  buildHasRadioCloneHydration,
  descriptorsForBuild,
  openRadioSessionForBuild,
  RadioWriteBlockedError,
  writeBuildToRadio,
} from './radioIoSession.ts';
import * as radioIo from '@integrations/radio-io/index.ts';

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
      attributionIds: [],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-uv5r-mini' }],
      writeStrategy: 'full-image',
      hydrationRequiredForWrite: true,
      baudRate: 38400,
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { build, egress } = uv5rMiniRadioIo();
    await expect(writeBuildToRadio(session, build, egress, emptyLibrary())).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
    expect(radio.upload).not.toHaveBeenCalled();
  });

  it('writes via assemble when hydration present', async () => {
    const imageBytes = new Uint8Array(UV5R_MINI_MEM_TOTAL);
    imageBytes.fill(0xff);
    const hydration = createRadioCloneHydrationBag({
      radioModelId: 'UV5R-Mini',
      imageBytes,
    });
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
      baudRate: 38400,
    };
    const session: RadioSession = {
      descriptor,
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
      { ...egress, hydration },
      emptyLibrary([ch]),
    );
    expect(upload).toHaveBeenCalledTimes(1);
    const uploaded = upload.mock.calls[0]![0] as MemoryMap;
    expect(uploaded.size).toBe(UV5R_MINI_MEM_TOTAL);
    expect(uploaded.bytes[0]).not.toBe(0xff);
  });

  it('closes the serial pipe when connect/handshake fails', async () => {
    const close = vi.fn(async () => undefined);
    const pipe = {
      write: vi.fn(),
      readExact: vi.fn(),
      flush: vi.fn(),
      close,
    };
    const requestSpy = vi.spyOn(radioIo, 'requestWebSerialPipe').mockResolvedValue(pipe);
    const listSpy = vi.spyOn(radioIo, 'listDescriptorsForProfile').mockReturnValue([
      {
        modelIds: ['UV5R-Mini'],
        label: 'Mini',
        supportsBle: false,
        protocolFactory: () => ({
          connect: async () => {
            throw new Error('ident timeout');
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
        baudRate: 38400,
      },
    ]);

    const { egress } = uv5rMiniRadioIo();
    await expect(openRadioSessionForBuild(egress)).rejects.toThrow(/ident timeout/);
    expect(close).toHaveBeenCalledTimes(1);

    requestSpy.mockRestore();
    listSpy.mockRestore();
  });
});
