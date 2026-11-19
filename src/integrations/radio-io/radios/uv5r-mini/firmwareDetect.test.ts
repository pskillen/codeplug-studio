import { describe, expect, it } from 'vitest';
import {
  crc16Xmodem,
  UV5RMINI_UNKNOWN_FORMAT_REFUSAL,
  UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
} from '@core/radios/baofeng/uv-5r-mini/radioReport.ts';
import { FakeMiniRadio } from './__fixtures__/fakeMiniRadio.ts';
import { classifyUv5rMiniFirmware, uv5rMiniProfileIdForDetection } from './firmwareDetect.ts';
import { encodeUv5rMiniZoneTable } from './modData/index.ts';
import { Uv5rMiniProtocol } from './protocol.ts';
import { UV5R_MINI_MM9PDY_PROFILE_ID } from './zoneBackup.ts';

const EXAMPLE = Uint8Array.from(
  '4d4d3952020000000040090000a0060000400900341200006d6d397064792d4c322d302e322e302d72632e31000000004e52460056302e323756312e3720dd1a'
    .match(/../g)!
    .map((x) => parseInt(x, 16)),
);
const blank = () => new Uint8Array(64).fill(0xff);
const header = () => {
  const b = blank();
  b.set([0x4d, 0x4d, 0x5a, 0x31, 1]);
  return b;
};
function changed(offset: number, value: number) {
  const b = EXAMPLE.slice();
  b[offset] = value;
  const crc = crc16Xmodem(b.subarray(0, 62));
  b[62] = crc & 255;
  b[63] = crc >> 8;
  return b;
}

describe('firmware detection', () => {
  it('classifies stock, report and older zone table evidence', () => {
    expect(classifyUv5rMiniFirmware({ header: blank(), report: blank() })).toEqual({
      kind: 'stock',
    });
    expect(classifyUv5rMiniFirmware({ header: blank(), report: EXAMPLE })).toMatchObject({
      kind: 'mm9pdy',
      evidence: 'report',
      report: { layout: 'L2' },
    });
    expect(classifyUv5rMiniFirmware({ header: header(), report: blank() })).toEqual({
      kind: 'mm9pdy',
      evidence: 'zone-table',
    });
    const v2 = header();
    v2[4] = 2;
    expect(classifyUv5rMiniFirmware({ header: v2, report: blank() })).toEqual({ kind: 'stock' });
  });
  it('refuses reports it cannot interpret even when a table is present', () => {
    expect(classifyUv5rMiniFirmware({ header: header(), report: changed(4, 3) })).toEqual({
      kind: 'unsupported',
      reason: UV5RMINI_UNKNOWN_FORMAT_REFUSAL(3),
    });
    expect(classifyUv5rMiniFirmware({ header: header(), report: changed(8, 1) })).toEqual({
      kind: 'unsupported',
      reason: UV5RMINI_UNKNOWN_LAYOUT_REFUSAL,
    });
    expect(classifyUv5rMiniFirmware({ header: header(), report: changed(5, 2) })).toMatchObject({
      kind: 'unsupported',
      reason: expect.stringContaining('reserved flags'),
    });
    expect(
      classifyUv5rMiniFirmware({ header: new Uint8Array(), report: new Uint8Array() }),
    ).toMatchObject({ kind: 'unsupported' });
  });
  it('selects profiles only for supported detections', () => {
    expect(uv5rMiniProfileIdForDetection({ kind: 'stock' })).toBe('radio-io-uv5r-mini');
    expect(uv5rMiniProfileIdForDetection({ kind: 'mm9pdy', evidence: 'zone-table' })).toBe(
      UV5R_MINI_MM9PDY_PROFILE_ID,
    );
    expect(uv5rMiniProfileIdForDetection({ kind: 'unsupported', reason: 'x' })).toBeUndefined();
  });
  it.each(['stock', 'report', 'zone-table'] as const)(
    'reads only the two detection frames for %s',
    async (kind) => {
      const pipe = new FakeMiniRadio();
      if (kind === 'report') pipe.flash.set(EXAMPLE, 0xefc0);
      if (kind === 'zone-table')
        pipe.flash.set(encodeUv5rMiniZoneTable({ zones: [] }).sector, 0xc000);
      const proto = new Uv5rMiniProtocol();
      await proto.connect(pipe, { handshake: 'none' });
      pipe.writes.length = 0;
      expect(await proto.detectFirmware()).toMatchObject(
        kind === 'stock' ? { kind } : { kind: 'mm9pdy', evidence: kind },
      );
      expect(pipe.rAddresses()).toEqual([0xc000, 0xefc0]);
      expect(pipe.wAddresses()).toEqual([]);
    },
  );
  it('reads detection immediately after the stock clone plan', async () => {
    const pipe = new FakeMiniRadio();
    const proto = new Uv5rMiniProtocol();
    await proto.connect(pipe, { handshake: 'none' });
    pipe.writes.length = 0;
    await proto.download();
    const clone = pipe.rAddresses();
    const range = (start: number, size: number) =>
      Array.from({ length: size / 64 }, (_, i) => start + i * 64);
    expect(clone).toEqual([...range(0, 0x8040), ...range(0x9000, 0x40), ...range(0xa000, 0x1c0)]);
    expect(clone).not.toContain(0xc000);
    await proto.detectFirmware();
    expect(pipe.rAddresses()).toEqual([...clone, 0xc000, 0xefc0]);
    expect(pipe.wAddresses()).toEqual([]);
  });
});
