import { describe, expect, it, vi } from 'vitest';
import { newChannel, newRadioBuildForProfile } from '@core/domain/factories.ts';
import type { LibrarySlice } from '@core/services/assemble.ts';
import { D890_MAP } from '@integrations/radio-io/radios/at-d890uv/constants.ts';
import {
  extractAtD890uvHydrationFromProtocol,
  mergeChannelsIntoAtD890uvHydration,
} from '@integrations/radio-io/radios/at-d890uv/hydration.ts';
import type { AtD890DownloadCache } from '@integrations/radio-io/radios/at-d890uv/protocol.ts';
import { createMemoryMap } from '@integrations/radio-io/kit/memoryMap.ts';
import type {
  CloneImageRadio,
  MemoryMap,
  RadioDescriptor,
  RadioSession,
} from '@integrations/radio-io/types.ts';
import { RadioWriteBlockedError, writeBuildToRadio } from './radioIoSession.ts';
import { buildRadioWriteProjection } from './radioIoWriteProjection.ts';
import { assemble } from '@core/services/assemble.ts';

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

describe('AT-D890UV write via hydration merge', () => {
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
      modelIds: ['AT-D890UV'],
      label: 'D890',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: [],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 921600,
      hydration: {
        extractHydration: () => {
          throw new Error('unused');
        },
        mergeChannelsIntoHydration: mergeChannelsIntoAtD890uvHydration,
      },
    };
    const session: RadioSession = {
      descriptor,
      pipe: { write: vi.fn(), readExact: vi.fn(), close: vi.fn() },
      radio,
    };
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    await expect(writeBuildToRadio(session, build, egress, emptyLibrary())).rejects.toBeInstanceOf(
      RadioWriteBlockedError,
    );
  });

  it('seeds protocol and uploads merged sparse image', async () => {
    const channelSet = new Uint8Array(0x200);
    const cache: AtD890DownloadCache = {
      blocks: new Map([
        [D890_MAP.LocalInfo, new Uint8Array(0x100).fill(0xff)],
        [D890_MAP.ChannelSet, channelSet],
        [D890_MAP.ZoneSet, new Uint8Array(0x20)],
        [D890_MAP.ZoneHide, new Uint8Array(0x20)],
        [D890_MAP.ZoneAChannel, new Uint8Array(0x200)],
        [D890_MAP.ZoneBChannel, new Uint8Array(0x200)],
        [D890_MAP.ScanListSet, new Uint8Array(0x20)],
        [D890_MAP.TalkgroupSet, new Uint8Array(0x4f0).fill(0xff)],
        [D890_MAP.ReceiveGroupSet, new Uint8Array(0x10)],
        [D890_MAP.RadioIdSet, new Uint8Array(0x20)],
        [D890_MAP.MasterIdData, new Uint8Array(0x40)],
      ]),
    };
    const image = createMemoryMap(0x1000);
    const hydration = extractAtD890uvHydrationFromProtocol(image, cache);

    const upload = vi.fn(async (_img: MemoryMap) => {
      void _img;
    });
    const seedProtocolForUpload = vi.fn();
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
      modelIds: ['AT-D890UV'],
      label: 'D890',
      supportsBle: false,
      protocolFactory: () => radio,
      capabilities: {
        maxChannels: 4000,
        supportsZones: true,
        supportsScanLists: true,
        analogOnly: false,
      },
      attributionIds: ['anytone-cps'],
      compatibleProfiles: [{ formatId: 'radio-io', profileId: 'radio-io-at-d890uv' }],
      writeStrategy: 'selective-ranges',
      hydrationRequiredForWrite: true,
      baudRate: 921600,
      hydration: {
        extractHydration: () => hydration,
        mergeChannelsIntoHydration: mergeChannelsIntoAtD890uvHydration,
        seedProtocolForUpload,
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
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
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
    expect(seedProtocolForUpload).toHaveBeenCalledTimes(1);
  });
});

describe('buildRadioWriteProjection radio-io-at-d890uv', () => {
  it('builds organisation with zones and talk groups', () => {
    const ch = {
      ...newChannel('p1', 'CH1'),
      id: 'ch-1',
      rxFrequency: 145_500_000,
      txFrequency: 145_500_000,
      power: 100,
      modeProfiles: [
        { mode: 'fm' as const, squelch: null, rxTone: 'none', txTone: 'none', bandwidthKHz: 25 },
      ],
    };
    const library = emptyLibrary([ch]);
    const { build, egress } = newRadioBuildForProfile('p1', 'radio-io-at-d890uv');
    const assembled = assemble(build, library);
    const projection = buildRadioWriteProjection(assembled, build, library, egress);
    expect(projection.channels.length).toBeGreaterThan(0);
    expect(projection.organisation.zones).toBeDefined();
    expect(projection.organisation.digitalContacts).toBeUndefined();
  });
});
