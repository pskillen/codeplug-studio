import { describe, expect, it, vi } from 'vitest';
import type { MemoryMap } from '../../types.ts';
import { UV5R_MINI_DESCRIPTOR } from './descriptor.ts';
import { encodeUv5rMiniZoneWrite } from './modData/index.ts';
import { FakeMiniRadio } from './__fixtures__/fakeMiniRadio.ts';
import { Uv5rMiniProtocol } from './protocol.ts';
import { analogModeForMiniRx, readUv5rMiniIntoLibrary } from './readIntoLibrary.ts';

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
});
