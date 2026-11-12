import { describe, expect, it } from 'vitest';
import { crc16Xmodem } from '../../dm32uv/firmwareUpdate/crc16Xmodem.ts';
import { MMZ1_CRC_CHECK, MMZ1_VECTORS } from '../__fixtures__/mmz1Vectors.ts';
import {
  decodeUv5rMiniZoneTable,
  encodeUv5rMiniZoneTable,
  MMZ1_BASE,
  MMZ1_SECTOR_BYTES,
  Uv5rMiniZoneTableError,
  zoneTableGeneration,
} from './index.ts';

function hex(b: Uint8Array): string {
  return [...b].map((v) => v.toString(16).padStart(2, '0')).join('');
}
function fromHex(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(2 * i, 2 * i + 2), 16);
  return out;
}

const oneZone = { zones: [{ name: 'DEMO ONE', slotIndexes: [0, 1, 2, 8, 998] }] };

/** A valid sector for `oneZone`, to corrupt. */
function goodSector(): Uint8Array {
  return encodeUv5rMiniZoneTable(oneZone).sector;
}
/** Re-seal the header CRC after a deliberate edit, so only the targeted rule can fire. */
function reseal(sector: Uint8Array): Uint8Array {
  const n = sector[5]!;
  const parts = [sector.slice(0, 62)];
  for (let i = 0; i < n; i++) parts.push(sector.slice(0x200 + 16 * i, 0x200 + 16 * i + 16));
  for (let i = 0; i < n; i++) parts.push(sector.slice(0x400 + 128 * i, 0x400 + 128 * i + 128));
  const all = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) {
    all.set(p, o);
    o += p.length;
  }
  const crc = crc16Xmodem(all);
  sector[62] = crc & 0xff;
  sector[63] = crc >> 8;
  return sector;
}
function rejectOf(sector: Uint8Array): string {
  const r = decodeUv5rMiniZoneTable(sector);
  if (!('reject' in r)) throw new Error('expected a reject');
  return r.reject;
}

describe('CRC-16/XMODEM', () => {
  it('matches the contract check value', () => {
    expect(crc16Xmodem(new TextEncoder().encode(MMZ1_CRC_CHECK.input))).toBe(MMZ1_CRC_CHECK.crc);
    expect(MMZ1_CRC_CHECK.crc).toBe(0x31c3);
  });
  it('maps the two reserved generations', () => {
    expect(zoneTableGeneration(0)).toBe(1);
    expect(zoneTableGeneration(0xffff)).toBe(0xfffe);
    expect(zoneTableGeneration(0x1234)).toBe(0x1234);
  });
});

describe.each(Object.entries(MMZ1_VECTORS))('vector %s', (_id, v) => {
  const enc = encodeUv5rMiniZoneTable({ zones: v.zones });

  it('encodes to the golden frames, in order', () => {
    expect(enc.frames.map((f) => ({ address: f.address, hex: hex(f.bytes) }))).toEqual(v.frames);
    expect(enc.frames.every((f) => f.bytes.length === 64)).toBe(true);
  });
  it('writes 1 + ceil(N/4) + 2N frames', () => {
    const n = v.zones.length;
    expect(enc.frames).toHaveLength(1 + Math.ceil(n / 4) + 2 * n);
  });
  it('has the golden CRC, generation and written range', () => {
    expect(enc.crc).toBe(v.crc);
    expect(enc.generation).toBe(v.generation);
    expect(hex(enc.sector.subarray(0, v.sectorHex.length / 2))).toBe(v.sectorHex);
    expect(enc.sector).toHaveLength(MMZ1_SECTOR_BYTES);
  });
  it('decodes the golden sector back to the zones', () => {
    const sector = new Uint8Array(MMZ1_SECTOR_BYTES).fill(0xff);
    sector.set(fromHex(v.sectorHex));
    expect(decodeUv5rMiniZoneTable(sector)).toEqual({
      zones: v.zones,
      crc: v.crc,
      generation: v.generation,
    });
  });
  it('keeps frames inside the table sector, ascending addresses unique', () => {
    const addrs = enc.frames.map((f) => f.address);
    expect(new Set(addrs).size).toBe(addrs.length);
    for (const a of addrs) {
      expect(a).toBeGreaterThanOrEqual(MMZ1_BASE);
      expect(a + 64).toBeLessThanOrEqual(MMZ1_BASE + MMZ1_SECTOR_BYTES);
    }
    expect(addrs.some((a) => a >= 0xc040 && a < 0xc200)).toBe(false);
    expect(addrs.some((a) => a >= 0xc380 && a < 0xc400)).toBe(false);
  });
});

describe('encode', () => {
  it('collapses duplicate slots and ignores order', () => {
    const a = encodeUv5rMiniZoneTable({ zones: [{ name: 'Z', slotIndexes: [5, 1, 5, 3] }] });
    const b = encodeUv5rMiniZoneTable({ zones: [{ name: 'Z', slotIndexes: [1, 3, 5] }] });
    expect(a.crc).toBe(b.crc);
    expect(hex(a.sector)).toBe(hex(b.sector));
  });
  it('rejects bad input', () => {
    const bad = (zones: { name: string; slotIndexes: number[] }[]): void =>
      expect(() => encodeUv5rMiniZoneTable({ zones })).toThrow(Uv5rMiniZoneTableError);
    bad([{ name: '', slotIndexes: [0] }]);
    bad([{ name: 'ABCDEFGHIJKLM', slotIndexes: [0] }]);
    bad([{ name: 'café', slotIndexes: [0] }]);
    bad([{ name: 'tab\t', slotIndexes: [0] }]);
    bad([{ name: 'Z', slotIndexes: [] }]);
    bad([{ name: 'Z', slotIndexes: [999] }]);
    bad([{ name: 'Z', slotIndexes: [-1] }]);
    bad([{ name: 'Z', slotIndexes: [1.5] }]);
    bad(Array.from({ length: 25 }, (_, i) => ({ name: `Z${i}`, slotIndexes: [0] })));
  });
});

describe('decode rejections', () => {
  it('accepts the good sector', () => {
    expect(decodeUv5rMiniZoneTable(goodSector())).toMatchObject(oneZone);
  });
  it('rejects a wrong-sized sector', () => {
    expect(rejectOf(new Uint8Array(100))).toMatch(/4096/);
  });
  it('rejects a blank (erased) header as no table', () => {
    expect(rejectOf(new Uint8Array(MMZ1_SECTOR_BYTES).fill(0xff))).toBe('blank header');
  });
  it('rejects bad magic', () => {
    const s = goodSector();
    s[0] = 0x4e;
    expect(rejectOf(reseal(s))).toBe('bad magic');
  });
  it('rejects an unsupported version', () => {
    const s = goodSector();
    s[4] = 2;
    expect(rejectOf(reseal(s))).toMatch(/version 2/);
  });
  it('rejects set flags', () => {
    const s = goodSector();
    s[6] = 1;
    expect(rejectOf(reseal(s))).toBe('flags set');
  });
  it('rejects a zone count over 24', () => {
    const s = goodSector();
    s[5] = 25;
    expect(rejectOf(s)).toMatch(/zone count 25/);
  });
  it('rejects a wrong slot count', () => {
    const s = goodSector();
    s[8] = 0xe8;
    expect(rejectOf(reseal(s))).toMatch(/slot count/);
  });
  it('rejects bad names: empty, control byte, non-zero after the pad', () => {
    for (const edit of [
      (s: Uint8Array) => s.fill(0, 0x200, 0x20c),
      (s: Uint8Array) => (s[0x201] = 0x07),
      (s: Uint8Array) => (s[0x20b] = 0x41),
      (s: Uint8Array) => (s[0x200] = 0x80),
    ]) {
      const s = goodSector();
      edit(s);
      expect(rejectOf(reseal(s))).toBe('zone 0: bad name');
    }
  });
  it('rejects pad bits set in a bitmap', () => {
    for (const at of [0x400 + 124, 0x400 + 125, 0x400 + 127]) {
      const s = goodSector();
      s[at] = at === 0x400 + 124 ? 0x80 : 0x01;
      expect(rejectOf(reseal(s))).toBe('zone 0: pad bits set');
    }
  });
  it('rejects a CRC mismatch from any covered byte or the CRC itself', () => {
    for (const at of [10, 0x200, 0x20c, 0x400, 62, 63]) {
      const s = goodSector();
      s[at] = s[at]! ^ 0x01;
      expect(rejectOf(s)).toBe('CRC mismatch');
    }
  });
  it('treats an interrupted write (new header, old body) as a reject, never wrong zones', () => {
    const next = encodeUv5rMiniZoneTable({ zones: [{ name: 'NEW', slotIndexes: [9] }] });
    const s = goodSector();
    s.set(next.frames[0]!.bytes, 0);
    expect(rejectOf(s)).toBe('CRC mismatch');
  });
  it('accepts zero zones as a valid empty table', () => {
    expect(decodeUv5rMiniZoneTable(encodeUv5rMiniZoneTable({ zones: [] }).sector)).toMatchObject({
      zones: [],
    });
  });
});
