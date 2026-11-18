import { describe, expect, it, vi } from 'vitest';
import {
  crc16Xmodem,
  UV5RMINI_UNKNOWN_FORMAT_REFUSAL,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';
import type { MemoryMap } from '../../types.ts';
import { UV5R_MINI_DESCRIPTOR } from './descriptor.ts';
import { encodeUv5rMiniZoneTable, encodeUv5rMiniZoneWrite } from './modData/index.ts';
import { encodeSyntheticRecord, SYNTHETIC_RECORDS } from './__fixtures__/realisticPriorImage.ts';
import { FakeMiniRadio } from './__fixtures__/fakeMiniRadio.ts';
import { Uv5rMiniProtocol } from './protocol.ts';
import { analogModeForMiniRx, readUv5rMiniIntoLibrary } from './readIntoLibrary.ts';

const report = Uint8Array.from(
  '4d4d3952020000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000004e52460056302e323756312e3720dd1a'
    .match(/../g)!
    .map((byte) => parseInt(byte, 16)),
);

function populateChannels(pipe: FakeMiniRadio) {
  const records = [
    { ...SYNTHETIC_RECORDS[0]!, slot: 1, name: 'AIR', rxHz: 118_100_000, tx: 145_500_000 },
    { ...SYNTHETIC_RECORDS[1]!, slot: 3 },
    { ...SYNTHETIC_RECORDS[4]!, slot: 4 },
  ];
  for (const record of records)
    pipe.flash.set(encodeSyntheticRecord(record), (record.slot - 1) * 32);
}

async function readPipe(pipe: FakeMiniRadio) {
  const radio = new Uv5rMiniProtocol();
  await radio.connect(pipe, { handshake: 'none' });
  pipe.writes.length = 0;
  return readUv5rMiniIntoLibrary({ radio, pipe, descriptor: UV5R_MINI_DESCRIPTOR }, {});
}

describe('Mini library read', () => {
  it.each([
    [107999999, 'fm'],
    [108000000, 'am'],
    [118100000, 'am'],
    [135999999, 'am'],
    [136000000, 'fm'],
    [145500000, 'fm'],
  ] as const)('infers %s Hz as %s', (hz, mode) => {
    expect(analogModeForMiniRx(hz)).toBe(mode);
  });
  it('reads in session order and passes occupied channels through', async () => {
    const radio = new Uv5rMiniProtocol();
    const order: string[] = [];
    const image = {} as MemoryMap;
    vi.spyOn(radio, 'download').mockImplementation(async () => {
      order.push('download');
      return image;
    });
    vi.spyOn(radio, 'detectFirmware').mockImplementation(async () => {
      order.push('detect');
      return { kind: 'mm9pdy', evidence: 'zone-table' };
    });
    vi.spyOn(radio, 'readZones').mockImplementation(async () => {
      order.push('zones');
      return { kind: 'zones', zones: [], memberOrderFromRadio: false, scanSetsFromRadio: false };
    });
    vi.spyOn(radio, 'decodeChannels').mockImplementation(() => {
      order.push('decode');
      return [
        {
          slotIndex: 1,
          empty: false,
          wireName: 'AIR',
          rxHz: 118100000,
          txHz: 145500000,
          rxTone: { kind: 'none' },
          txTone: { kind: 'none' },
          powerPercent: 100,
          bandwidth: 'FM',
        },
      ];
    });
    const session = { radio, pipe: new FakeMiniRadio(), descriptor: UV5R_MINI_DESCRIPTOR };
    const result = await readUv5rMiniIntoLibrary(session, {});
    expect(order).toEqual(['download', 'detect', 'zones', 'decode']);
    expect(result.channels[0].analogMode).toBe('am');
    expect(result.notes).toHaveLength(2);
  });
  it('reads stock over the fake pipe without write frames', async () => {
    const pipe = new FakeMiniRadio();
    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe, { handshake: 'none' });
    pipe.writes.length = 0;
    const result = await readUv5rMiniIntoLibrary(
      { radio, pipe, descriptor: UV5R_MINI_DESCRIPTOR },
      {},
    );
    expect(result.profileId).toBe('radio-io-uv5r-mini');
    expect(result.firmwareLabel).toBe('Stock firmware');
    expect(result.zones).toEqual([]);
    expect(result.notes).toEqual([]);
    expect(pipe.rAddresses().slice(-2)).toEqual([0xc000, 0xefc0]);
    expect(pipe.wAddresses()).toEqual([]);
  });
  it('reads MM9PDY zone order and scan set over the fake pipe', async () => {
    const pipe = new FakeMiniRadio();
    pipe.flash.set(
      encodeUv5rMiniZoneWrite({
        zones: [{ name: 'Test', slotIndexes: [40, 3, 7], scanSlotIndexes: [40, 7] }],
      }).sector,
      0xc000,
    );
    const radio = new Uv5rMiniProtocol();
    await radio.connect(pipe, { handshake: 'none' });
    pipe.writes.length = 0;
    const result = await readUv5rMiniIntoLibrary(
      { radio, pipe, descriptor: UV5R_MINI_DESCRIPTOR },
      {},
    );
    expect(result.profileId).toBe('radio-io-uv5r-mini-mm9pdy');
    expect(result.zones).toEqual([
      { wireName: 'Test', channelNumbers: [41, 4, 8], scanChannelNumbers: [41, 8] },
    ]);
    expect(result.notes).toEqual([]);
    expect(pipe.rAddresses().slice(-66, -64)).toEqual([0xc000, 0xefc0]);
    expect(pipe.wAddresses()).toEqual([]);
  });
  it('reports an unreadable MM9PDY zone table', async () => {
    const radio = new Uv5rMiniProtocol();
    vi.spyOn(radio, 'download').mockResolvedValue({} as MemoryMap);
    vi.spyOn(radio, 'detectFirmware').mockResolvedValue({ kind: 'mm9pdy', evidence: 'zone-table' });
    vi.spyOn(radio, 'readZones').mockResolvedValue({ kind: 'none', reason: 'invalid' });
    vi.spyOn(radio, 'decodeChannels').mockReturnValue([]);
    const result = await readUv5rMiniIntoLibrary(
      { radio, pipe: new FakeMiniRadio(), descriptor: UV5R_MINI_DESCRIPTOR },
      {},
    );
    expect(result.zones).toEqual([]);
    expect(result.notes).toEqual([
      'The radio reports MM9PDY firmware but has no readable zone table: no zones were read.',
    ]);
  });
  it('refuses unsupported firmware before decoding', async () => {
    const radio = new Uv5rMiniProtocol();
    vi.spyOn(radio, 'download').mockResolvedValue({} as MemoryMap);
    vi.spyOn(radio, 'detectFirmware').mockResolvedValue({
      kind: 'unsupported',
      reason: 'unsupported',
    });
    await expect(
      readUv5rMiniIntoLibrary(
        { radio, pipe: new FakeMiniRadio(), descriptor: UV5R_MINI_DESCRIPTOR },
        {},
      ),
    ).rejects.toThrow('unsupported');
  });
  it('decodes populated stock clone slots, including air band and receive-only', async () => {
    const pipe = new FakeMiniRadio();
    populateChannels(pipe);
    const result = await readPipe(pipe);
    expect(result.channels).toEqual([
      {
        slotIndex: 1,
        empty: false,
        wireName: 'AIR',
        rxHz: 118_100_000,
        txHz: 145_500_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        scanAdd: true,
        analogMode: 'am',
      },
      {
        slotIndex: 3,
        empty: false,
        wireName: 'RPT ALPHA',
        rxHz: 145_600_000,
        txHz: 145_000_000,
        rxTone: { kind: 'ctcss', hz: 88.5 },
        txTone: { kind: 'ctcss', hz: 88.5 },
        powerPercent: 20,
        bandwidth: 'NFM',
        scanAdd: true,
        analogMode: 'fm',
      },
      {
        slotIndex: 4,
        empty: false,
        wireName: 'WX RX ONLY',
        rxHz: 162_550_000,
        txHz: 162_550_000,
        rxTone: { kind: 'none' },
        txTone: { kind: 'none' },
        powerPercent: 100,
        bandwidth: 'FM',
        scanAdd: false,
        rxOnly: true,
        analogMode: 'fm',
      },
    ]);
    expect(result.droppedFields).toContain('Busy channel lockout');
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('reads older MM9PDY zones and explains missing order and scan sets', async () => {
    const pipe = new FakeMiniRadio();
    pipe.flash.set(
      encodeUv5rMiniZoneTable({
        zones: [{ name: 'Old', slotIndexes: [3, 0] }],
        writeScanSets: false,
      }).sector,
      0xc000,
    );
    const result = await readPipe(pipe);
    expect(result.profileId).toBe('radio-io-uv5r-mini-mm9pdy');
    expect(result.zones).toEqual([{ wireName: 'Old', channelNumbers: [1, 4] }]);
    expect(result.notes).toEqual([
      'This firmware does not report the order of channels inside zones, so they are listed by channel number.',
      "This firmware does not report per-zone scan sets, so the build's zone scan settings were left as they were.",
    ]);
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('reports a corrupt zone table when a valid report identifies MM9PDY', async () => {
    const pipe = new FakeMiniRadio();
    pipe.flash.set(report, 0xefc0);
    const result = await readPipe(pipe);
    expect(result.profileId).toBe('radio-io-uv5r-mini-mm9pdy');
    expect(result.zones).toEqual([]);
    expect(result.notes).toEqual([
      'The radio reports MM9PDY firmware but has no readable zone table: no zones were read.',
    ]);
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('refuses an unsupported report over the pipe', async () => {
    const pipe = new FakeMiniRadio();
    const unsupported = report.slice();
    unsupported[4] = 3;
    const crc = crc16Xmodem(unsupported.subarray(0, 62));
    unsupported[62] = crc & 255;
    unsupported[63] = crc >> 8;
    pipe.flash.set(unsupported, 0xefc0);
    await expect(readPipe(pipe)).rejects.toThrow(UV5RMINI_UNKNOWN_FORMAT_REFUSAL(3));
    expect(pipe.rAddresses().slice(-2)).toEqual([0xc000, 0xefc0]);
    expect(pipe.wAddresses()).toEqual([]);
  });

  it('keeps AM channels and zone membership on MM9PDY', async () => {
    const pipe = new FakeMiniRadio();
    populateChannels(pipe);
    pipe.flash.set(
      encodeUv5rMiniZoneWrite({
        zones: [{ name: 'Mixed', slotIndexes: [2, 0], scanSlotIndexes: [0] }],
      }).sector,
      0xc000,
    );
    const result = await readPipe(pipe);
    expect(result.channels.map(({ slotIndex, analogMode }) => [slotIndex, analogMode])).toEqual([
      [1, 'am'],
      [3, 'fm'],
      [4, 'fm'],
    ]);
    expect(result.zones).toEqual([
      { wireName: 'Mixed', channelNumbers: [3, 1], scanChannelNumbers: [1] },
    ]);
    expect(pipe.wAddresses()).toEqual([]);
  });
});
