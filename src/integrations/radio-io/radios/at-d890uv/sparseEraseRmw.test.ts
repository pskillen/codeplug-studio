import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { AT_D890_ERASE_UNIT_BYTES } from './eraseUnits.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  assertPreservedBytesMatchFreshRead,
  eraseAnchorsFromModelled,
  listEraseOnlyChunks,
  listSparseStagingChunks,
  modelledAddressSetFromChunks,
  overlayModelledChunksOntoUnit,
} from './sparseEraseRmw.ts';

const UNIT_350 = 0x350_0000;

function unitBuffer(fill: number): Uint8Array {
  return new Uint8Array(AT_D890_ERASE_UNIT_BYTES).fill(fill);
}

describe('overlayModelledChunksOntoUnit', () => {
  it('applies zone table bytes without disturbing optional settings at unit start', () => {
    const buffer = unitBuffer(0xff);
    buffer[0x05] = 0x42; // OptionalSettingsMain language byte
    const zoneChunk = {
      address: D890_MAP.ZoneAChannel,
      data: new Uint8Array(16).fill(0x11),
    };
    overlayModelledChunksOntoUnit(UNIT_350, buffer, [zoneChunk]);
    expect(buffer[0x05]).toBe(0x42);
    expect(buffer[D890_MAP.ZoneAChannel - UNIT_350]).toBe(0x11);
  });
});

describe('listSparseStagingChunks', () => {
  it('omits all-0xff gaps', () => {
    const buffer = unitBuffer(0xff);
    buffer[0x05] = 0x01;
    buffer[D890_MAP.ZoneAChannel - UNIT_350] = 0x22;
    const chunks = listSparseStagingChunks(new Map([[UNIT_350, buffer]]), new Set());
    const addrs = chunks.map((c) => c.address);
    expect(addrs).toContain(UNIT_350);
    expect(addrs).toContain(D890_MAP.ZoneAChannel);
    expect(addrs).not.toContain(UNIT_350 + 0x10);
  });

  it('returns ascending addresses across units', () => {
    const u348 = unitBuffer(0xff);
    u348[0x2a00] = 0x01; // ChannelSet region offset within 0x3480000 unit
    const u350 = unitBuffer(0xff);
    u350[0] = 0x02;
    const chunks = listSparseStagingChunks(
      new Map([
        [0x348_0000, u348],
        [UNIT_350, u350],
      ]),
      new Set(),
    );
    const addrs = chunks.map((c) => c.address);
    expect(addrs).toEqual([...addrs].sort((a, b) => a - b));
    expect(addrs[0]).toBeLessThan(addrs[addrs.length - 1]!);
  });

  it('never stages erase-unit flash sector-management markers', () => {
    const buffer = unitBuffer(0xff);
    buffer[0x05] = 0x01;
    buffer.set(
      [
        0xff, 0xff, 0xff, 0xff, 0x22, 0x33, 0x44, 0x55, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff,
        0xff,
      ],
      0x3fbf0,
    );
    buffer.set(
      [
        0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0x55, 0x55, 0xaa,
        0xaa,
      ],
      0x3fff0,
    );
    const chunks = listSparseStagingChunks(new Map([[UNIT_350, buffer]]), new Set());
    const addrs = chunks.map((c) => c.address);
    expect(addrs).toContain(UNIT_350);
    expect(addrs).not.toContain(UNIT_350 + 0x3fbf0);
    expect(addrs).not.toContain(UNIT_350 + 0x3fff0);
  });
});

describe('assertPreservedBytesMatchFreshRead', () => {
  it('passes when preserved bytes match fresh read', () => {
    const fresh = unitBuffer(0xff);
    fresh[0x05] = 0x42;
    const merged = fresh.slice();
    const modelled = new Set([D890_MAP.ZoneAChannel]);
    merged[D890_MAP.ZoneAChannel - UNIT_350] = 0x99;
    const staging = listSparseStagingChunks(new Map([[UNIT_350, merged]]), modelled);
    expect(() =>
      assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), modelled),
    ).not.toThrow();
  });

  it('fails when a preserved byte was modified', () => {
    const fresh = unitBuffer(0xff);
    fresh[0x05] = 0x42;
    const merged = fresh.slice();
    merged[0x05] = 0x00;
    const staging = listSparseStagingChunks(new Map([[UNIT_350, merged]]), new Set());
    expect(() =>
      assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), new Set()),
    ).toThrow(RadioProtocolError);
  });

  describe('with patch masks', () => {
    function stage(fresh: Uint8Array, edit: (merged: Uint8Array) => void) {
      const merged = fresh.slice();
      edit(merged);
      return listSparseStagingChunks(new Map([[UNIT_350, merged]]), new Set());
    }
    function freshSettings(): Uint8Array {
      const fresh = unitBuffer(0xff);
      fresh.fill(0x42, 0x10, 0x20);
      return fresh;
    }
    const masks = new Map<number, number>([
      [UNIT_350 + 0x13, 0xff],
      [UNIT_350 + 0x14, 0x0f],
    ]);

    it('passes when only patched bits changed', () => {
      const fresh = freshSettings();
      const staging = stage(fresh, (m) => {
        m[0x13] = 14;
        m[0x14] = 0x4d; // 0x42 with the low nibble replaced
      });
      expect(() =>
        assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), new Set(), masks),
      ).not.toThrow();
    });

    it('throws on a collateral change in an unpatched byte of a patched block', () => {
      const fresh = freshSettings();
      const staging = stage(fresh, (m) => {
        m[0x13] = 14;
        m[0x15] = 0x00;
      });
      expect(() =>
        assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), new Set(), masks),
      ).toThrow(/0x3500015/);
    });

    it('throws on a change outside the mask of a partly patched byte', () => {
      const fresh = freshSettings();
      const staging = stage(fresh, (m) => {
        m[0x14] = 0x5d; // high nibble changed too
      });
      expect(() =>
        assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), new Set(), masks),
      ).toThrow(/0x3500014/);
    });

    it('still throws for an unpatched block when masks are given elsewhere', () => {
      const fresh = freshSettings();
      fresh.fill(0x42, 0x30, 0x40);
      const staging = stage(fresh, (m) => {
        m[0x30] = 0x00;
      });
      expect(() =>
        assertPreservedBytesMatchFreshRead(staging, new Map([[UNIT_350, fresh]]), new Set(), masks),
      ).toThrow(RadioProtocolError);
    });
  });
});

describe('modelledAddressSetFromChunks', () => {
  it('collects chunk addresses', () => {
    const chunks = [
      { address: 0x100, data: new Uint8Array(16) },
      { address: 0x110, data: new Uint8Array(16) },
    ];
    expect(modelledAddressSetFromChunks(chunks)).toEqual(new Set([0x100, 0x110]));
  });
});

describe('erase-only chunks for pending units (#1406)', () => {
  const chunk = (address: number) => ({ address, data: new Uint8Array(16).fill(0xff) });

  it('anchors are the lowest sendable modelled address per unit', () => {
    const anchors = eraseAnchorsFromModelled(
      [chunk(0x350_0030), chunk(0x350_0010), chunk(0x358_0000), chunk(0x350_0000 + 0x3fbf0)],
      (a) => a === 0x350_0010,
    );
    expect(anchors.get(0x350_0000)).toBe(0x350_0030);
    expect(anchors.get(0x358_0000)).toBe(0x358_0000);
  });

  it('a pending unit with no sent block gets one FF block; entered units get none', () => {
    const anchors = new Map([
      [0x350_0000, 0x350_0010],
      [0x358_0000, 0x358_0000],
    ]);
    const out = listEraseOnlyChunks([0x350_0000, 0x358_0000], [chunk(0x358_0040)], anchors);
    expect(out.map((c) => c.address)).toEqual([0x350_0010]);
    expect(out[0]!.data.every((b) => b === 0xff)).toBe(true);
    expect(out[0]!.data).toHaveLength(16);
  });

  it('refuses when a pending unit has no block it can send into', () => {
    expect(() => listEraseOnlyChunks([0x350_0000], [], new Map())).toThrow(RadioProtocolError);
  });
});
