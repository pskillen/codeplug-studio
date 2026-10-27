import { describe, expect, it } from 'vitest';
import {
  RADIO_BACKUP_FORMAT,
  RADIO_BACKUP_VERSION,
  type RadioBackupManifestV1,
} from '../../backup/types.ts';
import { regionsFromDownload } from '../../backup/regionsFromDownload.ts';
import { createMemoryMap } from '../../kit/memoryMap.ts';
import { AT_D890_MAP_SIZE, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import {
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
  listWriteChunks,
} from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import {
  AtD890ScriptedPipe,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890UploadReadResponder,
  writePayloadAt,
} from './__fixtures__/scriptedPipe.ts';
import { allowLeakedD890MarkersInThisFile } from '../../../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

const SERIAL = 'SN-TEST-WIPED001';

/** Every extent a range change wipes that Studio's backup did not cover before. */
const WIPED = [
  { id: 'settings-store', start: D890_MAP.SettingsStore, length: D890_MAP.SettingsStoreLength },
  { id: 'dtmf-list', start: D890_MAP.DtmfList, length: D890_MAP.DtmfListLength },
  {
    id: 'optional-settings-ext-tail',
    start: D890_MAP.OptionalSettingsExtTail,
    length: D890_MAP.OptionalSettingsExtTailLength,
  },
  { id: 'aprs-text-tail', start: D890_MAP.AprsTextTail, length: D890_MAP.AprsTextTailLength },
  { id: 'gps-info-tail', start: D890_MAP.GpsInfoTail, length: D890_MAP.GpsInfoTailLength },
  { id: 'gps-zone-switch', start: D890_MAP.GpsZoneSwitch, length: D890_MAP.GpsZoneSwitchLength },
  {
    id: 'aprs-beacon-names',
    start: D890_MAP.AprsBeaconNames,
    length: D890_MAP.AprsBeaconNamesLength,
  },
  { id: 'vfo-channels', start: D890_MAP.VfoChannels, length: D890_MAP.VfoChannelsLength },
] as const;

function fillByte(i: number): number {
  return 0x60 + i;
}

/** Non-`FF` ramp byte for extent `i` at offset `off`, so a shifted or truncated copy is caught. */
function rampByte(i: number, off: number): number {
  return 0x20 + ((i * 31 + off) % 0x80);
}

/** Scripted radio memory: zeroed bitmaps, and non-`FF` bytes in every wiped extent. */
function radioMemory(): Map<number, Uint8Array> {
  const m = new Map<number, Uint8Array>([
    [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
    [D890_MAP.ChannelSet, new Uint8Array(0x200)],
    [D890_MAP.ZoneSet, new Uint8Array(0x20)],
    [D890_MAP.ZoneHide, new Uint8Array(0x20)],
    [D890_MAP.ZoneAChannel, new Uint8Array(0x200)],
    [D890_MAP.ZoneBChannel, new Uint8Array(0x200)],
    [D890_MAP.ScanListSet, new Uint8Array(0x20)],
    [D890_MAP.ReceiveGroupSet, new Uint8Array(0x20)],
    [D890_MAP.RadioIdSet, new Uint8Array(0x20)],
    [D890_MAP.MasterIdData, new Uint8Array(0x40)],
    [D890_MAP.AmAirSet, new Uint8Array(D890_MAP.AmAirSetLength)],
    [D890_MAP.AmAirVfo, new Uint8Array(D890_MAP.AmAirVfoLength)],
    [D890_MAP.AmZoneSet, new Uint8Array(D890_MAP.AmZoneSetLength)],
    [D890_MAP.AmZoneAChannel, new Uint8Array(D890_MAP.AmZoneAChannelLength)],
    [D890_MAP.AmZoneScan, new Uint8Array(D890_MAP.AmZoneScanLength)],
  ]);
  WIPED.forEach((w, i) => m.set(w.start, new Uint8Array(w.length).fill(fillByte(i))));
  return m;
}

function manifestFor(regions: RadioBackupManifestV1['regions']): RadioBackupManifestV1 {
  return {
    format: RADIO_BACKUP_FORMAT,
    version: RADIO_BACKUP_VERSION,
    capturedAt: '2026-10-26T12:00:00.000Z',
    capturedVia: 'web-serial',
    app: { buildEnv: 'test', buildVersion: '0' },
    radioModelId: 'AT-D890UV',
    descriptorLabel: 'Anytone AT-D890UV',
    coverage: 'known-map-regions',
    imageByteLength: AT_D890_MAP_SIZE,
    regions,
  };
}

describe('AT-D890 backup of the extents a range change wipes', () => {
  it('Read puts all eight new regions, with the radio bytes, in the backup', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, radioMemory());

    const image = await radio.download({});
    const cache = radio.getDownloadCache()!;
    const extract = regionsFromDownload({
      modelId: 'AT-D890UV',
      image,
      sparseBlocks: [...cache.blocks.entries()].map(([address, data]) => ({ address, data })),
    });

    WIPED.forEach((w, i) => {
      const region = extract.regions.find((r) => r.id === w.id);
      expect(region, w.id).toMatchObject({
        address: w.start,
        byteLength: w.length,
        restoreRole: 'restorable',
      });
      const bytes = extract.regionBytes[w.id]!;
      expect(
        bytes.every((b) => b === fillByte(i)),
        w.id,
      ).toBe(true);
    });
  });

  it('Write is unchanged by the new cache blocks (no VFO unit touched)', async () => {
    const frames = async (withWiped: boolean) => {
      const pipe = new AtD890ScriptedPipe();
      scriptAtD890ConnectWithNegotiation(pipe);
      const radio = new AtD890uvProtocol();
      await radio.connect(pipe);
      const unit350 = makeAtD890EraseUnitBuffer();
      unit350[0] = 0x01;
      unit350[0x900] = 0x02;
      unit350[0x1280] = 0x03;
      scriptAtD890UploadReadResponder(
        pipe,
        new Map<number, Uint8Array>([
          [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
          [0x100_0000, makeAtD890EraseUnitBuffer()],
          [0x1f8_0000, makeAtD890EraseUnitBuffer()],
          [0x350_0000, unit350],
        ]),
      );

      const channelSet = new Uint8Array(0x200);
      setBitmapBit(channelSet, 0, true);
      // A real radio's bitmap also has the VFO A/B slots (4000/4001) set.
      setBitmapBit(channelSet, 4000, true);
      setBitmapBit(channelSet, 4001, true);
      const primary = new Uint8Array(0x40);
      primary.set(encodeBcdFrequencyHz(145_520_000), 0);
      const blocks = new Map<number, Uint8Array>([
        [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
        [D890_MAP.ChannelSet, channelSet],
        [channelPrimaryAddress(0), primary],
        [channelSecondaryAddress(0), new Uint8Array(0x40)],
        [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
      ]);
      for (const slot of [4000, 4001]) {
        blocks.set(channelPrimaryAddress(slot), new Uint8Array(0x40).fill(0x77));
        blocks.set(channelSecondaryAddress(slot), new Uint8Array(0x40).fill(0x78));
      }
      if (withWiped) {
        WIPED.forEach((w, i) => blocks.set(w.start, new Uint8Array(w.length).fill(fillByte(i))));
      }
      radio.seedDownloadCache({ blocks });
      const image = cacheToMemoryMap(radio.getDownloadCache()!);
      enableAtD890AutoWriteAck(pipe);
      await radio.upload(image, {});
      return pipe.writes.filter((w) => w[0] === 0x57).map((w) => Array.from(w).join(','));
    };

    const without = await frames(false);
    const withNew = await frames(true);
    expect(without.length).toBeGreaterThan(0);
    expect(withNew).toEqual(without);
    // No write frame lands in the VFO erase unit (0x01F80000..0x01FBFFFF).
    const vfoUnit = withNew.filter((f) => {
      const [, a, b, c, d] = f.split(',').map(Number);
      const addr = ((a! << 24) | (b! << 16) | (c! << 8) | d!) >>> 0;
      return addr >= 0x1f8_0000 && addr < 0x1fc_0000;
    });
    expect(vfoUnit).toEqual([]);
  }, 30_000);

  it('listWriteChunks ignores the settings-unit extents', () => {
    const blocks = new Map<number, Uint8Array>();
    WIPED.forEach((w, i) => blocks.set(w.start, new Uint8Array(w.length).fill(fillByte(i))));
    const chunks = listWriteChunks({ blocks }, AT_D890_SAFE_SKIP_WRITE_ADDR);
    for (const w of WIPED.filter((x) => x.id !== 'vfo-channels')) {
      expect(chunks.some((c) => c.address >= w.start && c.address < w.start + w.length)).toBe(
        false,
      );
    }
  });
});

describe('AT-D890 Restore of the wiped extents', () => {
  async function restore(ids: string[], regionsIn: RadioBackupManifestV1['regions']) {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    const unit350 = makeAtD890EraseUnitBuffer();
    unit350[0] = 0x01;
    unit350[D890_MAP.SettingsStore - 0x350_0000] = 0x5a; // fresh-read byte
    scriptAtD890UploadReadResponder(
      pipe,
      new Map([
        [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
        [0x350_0000, unit350],
        [0x1f8_0000, makeAtD890EraseUnitBuffer()],
      ]),
    );
    enableAtD890AutoWriteAck(pipe);

    const image = createMemoryMap(AT_D890_MAP_SIZE);
    WIPED.forEach((w, i) => {
      for (let off = 0; off < w.length; off++) image.fill(w.start + off, 1, rampByte(i, off));
    });
    image.fill(D890_MAP.OptionalSettingsMain, D890_MAP.OptionalSettingsMainLength, 0x41);
    await radio.restoreFromBackup({ manifest: manifestFor(regionsIn), image }, { regionIds: ids });
    return pipe;
  }

  const region = (id: string, address: number, byteLength: number) => ({
    id,
    label: id,
    address,
    byteLength,
    path: `regions/${id}.bin`,
    restoreRole: 'restorable' as const,
  });

  it('writes every new region back with the zip bytes', async () => {
    const regions = [
      region(
        'optional-settings-main',
        D890_MAP.OptionalSettingsMain,
        D890_MAP.OptionalSettingsMainLength,
      ),
      ...WIPED.map((w) => region(w.id, w.start, w.length)),
    ];
    const pipe = await restore(
      regions.map((r) => r.id),
      regions,
    );
    const written = collectAtD890WriteDataAddresses(pipe);
    WIPED.forEach((w, i) => {
      // Every 16-byte block of the extent is sent, with the zip's bytes at that offset.
      for (let off = 0; off < w.length; off += 16) {
        const addr = w.start + off;
        expect(written, `${w.id}+${off}`).toContain(addr);
        const payload = writePayloadAt(pipe, addr);
        expect(payload, `${w.id}+${off}`).toBeDefined();
        expect(Array.from(payload!.subarray(0, 16)), `${w.id}+${off}`).toEqual(
          Array.from({ length: 16 }, (_, k) => rampByte(i, off + k)),
        );
      }
    });
  });

  it('restores an older backup (no new ids) and keeps the fresh-read bytes there', async () => {
    const regions = [
      region(
        'optional-settings-main',
        D890_MAP.OptionalSettingsMain,
        D890_MAP.OptionalSettingsMainLength,
      ),
    ];
    const pipe = await restore(['optional-settings-main'], regions);
    const written = collectAtD890WriteDataAddresses(pipe);
    expect(written).toContain(D890_MAP.OptionalSettingsMain);
    expect(writePayloadAt(pipe, D890_MAP.SettingsStore)?.[0]).toBe(0x5a);
  });
});
