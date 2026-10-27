import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../radioChannelDto.ts';
import type { RadioNxdnListsDto } from '../../radioWriteProjection.ts';
import { encodeBcdFrequencyHz } from './bcd.ts';
import { setBitmapBit } from './bitmap.ts';
import { AT_D890_NXDN, AT_D890_SAFE_SKIP_WRITE_ADDR, D890_MAP } from './constants.ts';
import {
  applyAtD890WriteImageToCache,
  atD890UploadBankIntentFromOrganisation,
  cacheToMemoryMap,
  channelPrimaryAddress,
  channelSecondaryAddress,
} from './memory.ts';
import { AtD890uvProtocol } from './protocol.ts';
import { encodeAtD890NxdnList } from './nxdnListCodec.ts';
import { encodeAtD890NxdnRxGroups } from './nxdnRxGroupCodec.ts';
import {
  assertAtD890NoReadAfterWrite,
  AtD890ScriptedPipe,
  collectAtD890ReadRequestAddresses,
  collectAtD890WriteDataAddresses,
  enableAtD890AutoWriteAck,
  localInfoWithSerial,
  makeAtD890EraseUnitBuffer,
  scriptAtD890ConnectWithNegotiation,
  scriptAtD890MinimalDownload,
  scriptAtD890UploadReadResponder,
  writePayloadAt,
} from './__fixtures__/scriptedPipe.ts';
import { allowLeakedD890MarkersInThisFile } from '../../../../test/leakedD890Marker.ts';

allowLeakedD890MarkersInThisFile();

const SERIAL = 'SN-TEST-NXDN0001';

function seedChannelZeroUpload(radio: AtD890uvProtocol): ReturnType<typeof cacheToMemoryMap> {
  const channelSet = new Uint8Array(0x200);
  setBitmapBit(channelSet, 0, true);
  const primary = new Uint8Array(0x40);
  primary.set(encodeBcdFrequencyHz(145_520_000), 0);
  radio.seedDownloadCache({
    blocks: new Map([
      [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
      [D890_MAP.ChannelSet, channelSet],
      [channelPrimaryAddress(0), primary],
      [channelSecondaryAddress(0), new Uint8Array(0x40)],
      [AT_D890_SAFE_SKIP_WRITE_ADDR, new Uint8Array(0x10)],
    ]),
  });
  const image = cacheToMemoryMap(radio.getDownloadCache()!);
  applyAtD890WriteImageToCache(radio.getDownloadCache()!, image);
  return image;
}

const LIST_UNITS = [
  AT_D890_NXDN.ListIndex,
  AT_D890_NXDN.ListSet,
  AT_D890_NXDN.ListData,
  AT_D890_NXDN.ListOrder,
];
const ALL_UNITS = [...LIST_UNITS, AT_D890_NXDN.RxGroupData];

/** A live unit with a previous list in it: the stale bytes must never be carried over. */
function staleUnit(): Uint8Array {
  const unit = makeAtD890EraseUnitBuffer();
  unit.fill(0x5a, 0x2000, 0x2010);
  unit.fill(0xa5, 0x8000, 0x8010);
  return unit;
}

function uploadMemory(): Map<number, Uint8Array> {
  const unit348 = makeAtD890EraseUnitBuffer();
  unit348[D890_MAP.AlarmBitmap - 0x348_0000] = 0xab;
  unit348[D890_MAP.AlarmData - 0x348_0000] = 0xcd;
  const memory = new Map<number, Uint8Array>([
    [D890_MAP.LocalInfo, localInfoWithSerial(SERIAL)],
    [0x100_0000, makeAtD890EraseUnitBuffer()],
    [0x348_0000, unit348],
  ]);
  for (const base of ALL_UNITS) memory.set(base, staleUnit());
  return memory;
}

const CHANNEL: RadioChannelDto = {
  slotIndex: 1,
  empty: false,
  wireName: '',
  rxHz: 145_520_000,
  txHz: 145_520_000,
  rxTone: { kind: 'none' },
  txTone: { kind: 'none' },
  powerPercent: null,
  bandwidth: 'NFM',
};

const inNxdnUnit = (a: number) => ALL_UNITS.some((base) => a >= base && a < base + 0x8_0000);

const LISTS: RadioNxdnListsDto = {
  entries: [
    { wireName: 'TG 1234', nxdnId: 1234, kind: 'group' },
    { wireName: 'Alice', nxdnId: 5678, kind: 'individual' },
  ],
  rxGroups: [{ wireName: 'Local', memberSlots: [0] }],
};

describe('AtD890uvProtocol MM9PDY NXDN lists (#255)', () => {
  it('writes the four list units and the RX group unit, owns each and never carries over the old bytes', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, uploadMemory());
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation({ atD890SettingsTarget: 'mm9pdy', nxdnLists: LISTS }, [
        CHANNEL,
      ]),
    );
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const addresses = collectAtD890WriteDataAddresses(pipe).filter(inNxdnUnit);
    const has = (a: number) => addresses.includes(a);
    expect(has(AT_D890_NXDN.ListIndex)).toBe(true);
    expect(has(AT_D890_NXDN.ListSet)).toBe(true);
    expect(has(AT_D890_NXDN.ListData)).toBe(true);
    expect(has(AT_D890_NXDN.ListData + 0xc0)).toBe(true); // the second record starts at 0xC8
    expect(has(AT_D890_NXDN.ListOrder)).toBe(true);
    expect(has(AT_D890_NXDN.RxGroupData)).toBe(true);
    expect(has(AT_D890_NXDN.RxGroupSet)).toBe(true);
    // Only the A halves, and the stale test bytes in each live unit are not re-sent.
    expect(addresses.every((a) => ALL_UNITS.some((base) => a >= base && a < base + 0x4_0000))).toBe(
      true,
    );
    for (const base of ALL_UNITS) {
      expect(has(base + 0x2000)).toBe(false);
      expect(has(base + 0x8000)).toBe(false);
    }
    const index = writePayloadAt(pipe, AT_D890_NXDN.ListIndex)!;
    expect([...index.subarray(0, 8)]).toEqual([0, 0, 0, 0, 1, 0, 0, 0]);
    expect([...writePayloadAt(pipe, AT_D890_NXDN.RxGroupSet)!.subarray(0, 2)]).toEqual([1, 0]);
    assertAtD890NoReadAfterWrite(pipe.writes);
  }, 30_000);

  it('leaves every NXDN unit alone on a stock intent, even if the cache holds stale NXDN blocks', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, uploadMemory());
    const image = seedChannelZeroUpload(radio);
    for (const base of ALL_UNITS) {
      radio.getDownloadCache()!.blocks.set(base, new Uint8Array(16).fill(0x11));
    }
    radio.setUploadBankIntent(atD890UploadBankIntentFromOrganisation({}, [CHANNEL]));
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    expect(collectAtD890WriteDataAddresses(pipe).filter(inNxdnUnit)).toEqual([]);
    expect(collectAtD890ReadRequestAddresses(pipe).filter(inNxdnUnit)).toEqual([]);
  }, 30_000);

  it('does not let a stock target carry an NXDN list even if the organisation holds one', () => {
    const intent = atD890UploadBankIntentFromOrganisation({ nxdnLists: LISTS }, [CHANNEL]);
    expect(intent.nxdnLists).toBeUndefined();
  });

  it('leaves the list units alone when there are RX lists but no entries', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890ConnectWithNegotiation(pipe);
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    scriptAtD890UploadReadResponder(pipe, uploadMemory());
    const image = seedChannelZeroUpload(radio);
    radio.setUploadBankIntent(
      atD890UploadBankIntentFromOrganisation(
        {
          atD890SettingsTarget: 'mm9pdy',
          nxdnLists: { entries: [], rxGroups: [{ wireName: 'Empty', memberSlots: [] }] },
        },
        [CHANNEL],
      ),
    );
    enableAtD890AutoWriteAck(pipe);

    await radio.upload(image, {});

    const written = collectAtD890WriteDataAddresses(pipe).filter(inNxdnUnit);
    expect(written.some((a) => LIST_UNITS.some((base) => a >= base && a < base + 0x8_0000))).toBe(
      false,
    );
    // The list has no members (all FF), so its first block is its name at +0x100.
    expect(written).toContain(AT_D890_NXDN.RxGroupData + 0x100);
    expect(written).toContain(AT_D890_NXDN.RxGroupSet);
  }, 30_000);
});

describe('AtD890uvProtocol Read of the NXDN lists (backup)', () => {
  it('reads the index, set, used records, order table and RX groups into the cache', async () => {
    const pipe = new AtD890ScriptedPipe();
    scriptAtD890MinimalDownload(pipe);
    const memory = new Map<number, Uint8Array>();
    for (const { address, bytes } of [
      ...encodeAtD890NxdnList(LISTS.entries),
      ...encodeAtD890NxdnRxGroups(LISTS.rxGroups),
    ]) {
      memory.set(address, bytes);
    }
    const base = pipe.readResponder!;
    pipe.readResponder = (addr, len) => {
      for (const [start, data] of memory) {
        if (addr >= start && addr + len <= start + data.length + 0x10) {
          const out = new Uint8Array(len).fill(0xff);
          out.set(data.subarray(addr - start, addr - start + len));
          return out;
        }
      }
      return base(addr, len);
    };
    const radio = new AtD890uvProtocol();
    await radio.connect(pipe);
    await radio.download({});
    const cache = radio.getDownloadCache()!;
    expect(cache.blocks.has(AT_D890_NXDN.ListIndex)).toBe(true);
    expect(cache.blocks.get(AT_D890_NXDN.ListData)?.[0]).toBe(1);
    expect(cache.blocks.has(AT_D890_NXDN.ListData + 0xc0)).toBe(true);
    expect(cache.blocks.has(AT_D890_NXDN.ListOrder)).toBe(true);
    expect(cache.blocks.get(AT_D890_NXDN.RxGroupSet)?.[0]).toBe(1);
    expect(cache.blocks.has(AT_D890_NXDN.RxGroupData)).toBe(true);
  });
});
