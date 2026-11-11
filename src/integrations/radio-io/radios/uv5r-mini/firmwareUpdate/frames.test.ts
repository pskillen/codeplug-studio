import { describe, expect, it } from 'vitest';

import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import {
  encodeUv5rMiniFrame,
  Uv5rMiniFrameParser,
  uv5rMiniReadU32,
  uv5rMiniU32,
} from './frames.ts';

describe('UV-5R Mini update frames', () => {
  it('lays out AA 55, length, cmd, data, CRC-16/XMODEM over everything before it', () => {
    const f = encodeUv5rMiniFrame(6);
    expect(Array.from(f.subarray(0, 5))).toEqual([0xaa, 0x55, 0x01, 0x00, 0x06]);
    expect(f.length).toBe(7);
    const crc = crc16Xmodem(f.subarray(0, 5));
    expect(f[5]).toBe(crc & 0xff);
    expect(f[6]).toBe(crc >>> 8);
    const g = encodeUv5rMiniFrame(1, uv5rMiniU32(38400));
    expect(Array.from(g.subarray(0, 9))).toEqual([
      0xaa, 0x55, 0x05, 0x00, 0x01, 0x00, 0x96, 0x00, 0x00,
    ]);
    expect(uv5rMiniReadU32(g, 5)).toBe(38400);
  });

  it('parses frames split across feeds and drops bytes before the sync', () => {
    const a = encodeUv5rMiniFrame(2, Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]));
    const b = encodeUv5rMiniFrame(3, Uint8Array.from([0]));
    const p = new Uv5rMiniFrameParser();
    const all = Uint8Array.from([0x00, 0xaa, 0x13, ...a, ...b]);
    expect(p.feed(all.subarray(0, 6))).toEqual([]);
    const got = p.feed(all.subarray(6));
    expect(got).toEqual([
      { kind: 'frame', cmd: 2, data: Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]) },
      { kind: 'frame', cmd: 3, data: Uint8Array.from([0]) },
    ]);
  });

  it('keeps a trailing 0xAA that may start the next sync', () => {
    const f = encodeUv5rMiniFrame(6);
    const p = new Uv5rMiniFrameParser();
    expect(p.feed(Uint8Array.from([0x11, 0xaa]))).toEqual([]);
    expect(p.feed(f.subarray(1))).toEqual([{ kind: 'frame', cmd: 6, data: new Uint8Array(0) }]);
  });

  it('reports a bad CRC and never uses the frame; the next good one still parses', () => {
    const bad = encodeUv5rMiniFrame(1, uv5rMiniU32(9600));
    bad[bad.length - 1] ^= 0xff;
    const good = encodeUv5rMiniFrame(6);
    const got = new Uv5rMiniFrameParser().feed(Uint8Array.from([...bad, ...good]));
    expect(got).toHaveLength(2);
    expect(got[0]).toEqual({
      kind: 'bad-crc',
      hex: Array.from(bad, (x) => x.toString(16).padStart(2, '0')).join(''),
    });
    expect(got[1]).toEqual({ kind: 'frame', cmd: 6, data: new Uint8Array(0) });
  });

  it('treats a zero length as junk and resyncs', () => {
    const good = encodeUv5rMiniFrame(6);
    const got = new Uv5rMiniFrameParser().feed(Uint8Array.from([0xaa, 0x55, 0x00, 0x00, ...good]));
    expect(got.map((g) => g.kind)).toEqual(['bad-crc', 'frame']);
  });
});
