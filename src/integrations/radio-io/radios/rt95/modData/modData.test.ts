import { describe, expect, it } from 'vitest';
import type { RadioChannelDto } from '../../../radioChannelDto.ts';
import { RT95_LIMITS } from '@core/radios/retevis/rt95/limits.ts';
import { encodeChannelsIntoImage } from '../channelCodec.ts';
import { RT95_IMAGE_SIZE } from '../constants.ts';
import {
  MMD1_SLOT_EDGES,
  MMD1_STATE_A_HEX,
  MMD1_VECTORS,
  MMD1_VECTOR_CHANNELS,
} from '../__fixtures__/mmd1Vectors.ts';
import {
  decodeRt95Description,
  decodeRt95ModData,
  decodeRt95ZoneState,
  encodeRt95ModData,
  encodeRt95ZoneStateForTest,
  Rt95ModDataError,
  assertRt95WriteAllowed,
  type Rt95ModDataInput,
  type Rt95ModDataValid,
} from './index.ts';

function hex(b: Uint8Array): string {
  return [...b]
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}
function fromHex(h: string): Uint8Array {
  return Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
}

function vectorImage(): Uint8Array {
  const image = new Uint8Array(RT95_IMAGE_SIZE).fill(0xff);
  const channels: RadioChannelDto[] = MMD1_VECTOR_CHANNELS.map((c) => ({
    slotIndex: c.slotIndex,
    empty: false,
    wireName: c.wireName,
    rxHz: c.rxHz,
    txHz: c.rxHz,
    rxTone: { kind: 'none' },
    txTone: { kind: 'none' },
    powerPercent: 100,
    bandwidth: 'FM',
  }));
  encodeChannelsIntoImage(image, channels);
  return image;
}

function record(image: Uint8Array, index: number): Uint8Array {
  return image.slice(index * 32, index * 32 + 32);
}

function toBuffer(blocks: readonly { address: number; bytes: Uint8Array }[]): Uint8Array {
  const buf = new Uint8Array(0x6000).fill(0xff);
  for (const b of blocks) buf.set(b.bytes, b.address);
  return buf;
}
function reader(buf: Uint8Array) {
  return (address: number) =>
    address + 16 <= buf.length ? buf.slice(address, address + 16) : undefined;
}

const image = vectorImage();

describe('MMD1 golden vectors', () => {
  it('synthetic channels fingerprint as listed', () => {
    for (const c of MMD1_VECTOR_CHANNELS) {
      const rec = record(image, c.index);
      const enc = encodeRt95ModData(
        { zones: [], descriptions: [{ channelIndex: c.index, text: 'x' }] },
        image,
      );
      expect(enc.blocks[0]!.bytes[12]).toBe(c.fingerprint);
      expect(hex(rec.subarray(0x18, 0x1e))).toBe(hex(new TextEncoder().encode(c.wireName)));
    }
  });

  for (const v of MMD1_VECTORS) {
    it(`vector ${v.id} encodes byte-exactly in write order`, () => {
      const enc = encodeRt95ModData({ zones: v.zones, descriptions: v.descriptions }, image);
      expect(enc.blocks.map((b) => b.address)).toEqual(v.blocks.map((b) => b.address));
      expect(enc.blocks.map((b) => hex(b.bytes))).toEqual(v.blocks.map((b) => b.hex));
      expect(enc.zoneGeneration).toBe(v.zoneGeneration);
      expect(enc.descriptionGeneration).toBe(v.descriptionGeneration);
      expect(enc.zoneCount).toBe(v.zones.length);
      expect(enc.descriptionCount).toBe(v.descriptions.length);
      expect(enc.blocks[enc.blocks.length - 1]!.address).toBe(0x4000);
    });
  }

  it('slot edge cases: channel 200 only and all 200 channels', () => {
    const one = encodeRt95ModData(
      {
        zones: [{ name: 'Z', channelIndexes: [...MMD1_SLOT_EDGES.channel200.channelIndexes] }],
        descriptions: [],
      },
      image,
    );
    const slot1 = one.blocks[0]!.bytes;
    expect(slot1.every((v) => v === 0)).toBe(true);
    expect(one.blocks[1]!.bytes[8]).toBe(0x80); // slot byte 24
    const name1 = one.blocks[2]!.bytes;
    expect(name1[14]! | (name1[15]! << 8)).toBe(MMD1_SLOT_EDGES.channel200.slotCrc);

    const all = encodeRt95ModData(
      {
        zones: [{ name: 'Z', channelIndexes: [...MMD1_SLOT_EDGES.all.channelIndexes] }],
        descriptions: [],
      },
      image,
    );
    const slot = new Uint8Array([...all.blocks[0]!.bytes, ...all.blocks[1]!.bytes]);
    expect([...slot.subarray(0, 25)].every((v) => v === 0xff)).toBe(true);
    expect([...slot.subarray(25)].every((v) => v === 0)).toBe(true);
    const nameAll = all.blocks[2]!.bytes;
    expect(nameAll[12]).toBe(200);
    expect(nameAll[14]! | (nameAll[15]! << 8)).toBe(MMD1_SLOT_EDGES.all.slotCrc);
  });

  it('state block for vector A', () => {
    expect(hex(encodeRt95ZoneStateForTest(0x0fcb, 1, 0))).toBe(MMD1_STATE_A_HEX);
  });
});

describe('MMD1 encoder behaviour', () => {
  const a = MMD1_VECTORS[0]!;
  const base: Rt95ModDataInput = { zones: a.zones, descriptions: a.descriptions };

  it('identical input encodes identically', () => {
    const x = encodeRt95ModData(base, image);
    const y = encodeRt95ModData(base, image);
    expect(x.blocks.map((b) => hex(b.bytes))).toEqual(y.blocks.map((b) => hex(b.bytes)));
  });

  it('member order and duplicates do not matter', () => {
    const x = encodeRt95ModData(
      { ...base, zones: [{ name: 'LOCAL', channelIndexes: [2, 0, 2] }] },
      image,
    );
    expect(x.zoneGeneration).toBe(a.zoneGeneration);
  });

  it('changing one description changes only the description generation and block CRCs', () => {
    const x = encodeRt95ModData(base, image);
    const y = encodeRt95ModData(
      { ...base, descriptions: [base.descriptions[0]!, { channelIndex: 2, text: 'Other' }] },
      image,
    );
    expect(y.zoneGeneration).toBe(x.zoneGeneration);
    expect(y.descriptionGeneration).not.toBe(x.descriptionGeneration);
    // The untouched description block (n=0) differs only in its CRC (bytes 14-15).
    const bx = x.blocks[0]!.bytes;
    const by = y.blocks[0]!.bytes;
    expect(hex(bx.subarray(0, 14))).toBe(hex(by.subarray(0, 14)));
    expect(hex(bx.subarray(14))).not.toBe(hex(by.subarray(14)));
  });

  it('changing a member changes the zone generation', () => {
    const y = encodeRt95ModData(
      { ...base, zones: [{ name: 'LOCAL', channelIndexes: [0] }] },
      image,
    );
    expect(y.zoneGeneration).not.toBe(a.zoneGeneration);
  });

  it('encodes 32 zones x 200 members and 200 descriptions as 297 allowed blocks', () => {
    const all = Array.from({ length: 200 }, (_, i) => i);
    const input: Rt95ModDataInput = {
      zones: Array.from({ length: 32 }, (_, i) => ({ name: `Z${i}`, channelIndexes: all })),
      descriptions: all.map((i) => ({ channelIndex: i, text: `D${i}` })),
    };
    const big = new Uint8Array(RT95_IMAGE_SIZE).fill(0);
    const enc = encodeRt95ModData(input, big);
    expect(enc.blocks.length).toBe(200 + 3 * 32 + 1);
    for (const b of enc.blocks) {
      expect(() =>
        assertRt95WriteAllowed(b.address, 16, {
          profile: 'mm9pdy',
          chipGuardPassed: true,
          operation: 'write',
        }),
      ).not.toThrow();
      expect(b.address).not.toBe(0x4010);
      expect(b.address).toBeLessThan(0x6000);
    }
  });

  it('uses limits from RT95_LIMITS', () => {
    expect(RT95_LIMITS.ZONE_MAX).toBe(32);
  });

  const bad: [string, Rt95ModDataInput][] = [
    [
      '33 zones',
      {
        zones: Array.from({ length: 33 }, () => ({ name: 'Z', channelIndexes: [0] })),
        descriptions: [],
      },
    ],
    ['empty zone', { zones: [{ name: 'Z', channelIndexes: [] }], descriptions: [] }],
    ['9-char name', { zones: [{ name: 'ABCDEFGHI', channelIndexes: [0] }], descriptions: [] }],
    ['non-ASCII name', { zones: [{ name: 'café', channelIndexes: [0] }], descriptions: [] }],
    ['empty name', { zones: [{ name: '', channelIndexes: [0] }], descriptions: [] }],
    [
      '13-char description',
      { zones: [], descriptions: [{ channelIndex: 0, text: 'ABCDEFGHIJKLM' }] },
    ],
    ['underscore description', { zones: [], descriptions: [{ channelIndex: 0, text: 'a_b' }] }],
    ['index 200', { zones: [{ name: 'Z', channelIndexes: [200] }], descriptions: [] }],
    ['description index 200', { zones: [], descriptions: [{ channelIndex: 200, text: 'x' }] }],
    [
      'duplicate description index',
      {
        zones: [],
        descriptions: [
          { channelIndex: 1, text: 'a' },
          { channelIndex: 1, text: 'b' },
        ],
      },
    ],
  ];
  for (const [label, input] of bad) {
    it(`rejects ${label}`, () => {
      expect(() => encodeRt95ModData(input, image)).toThrow(Rt95ModDataError);
    });
  }

  it('does not write empty descriptions', () => {
    const enc = encodeRt95ModData(
      { zones: [], descriptions: [{ channelIndex: 0, text: '' }] },
      image,
    );
    expect(enc.descriptionCount).toBe(0);
    expect(enc.blocks.length).toBe(1);
  });
});

describe('MMD1 decoder', () => {
  const a = MMD1_VECTORS[0]!;
  const enc = encodeRt95ModData({ zones: a.zones, descriptions: a.descriptions }, image);

  function valid(buf: Uint8Array): Rt95ModDataValid {
    const d = decodeRt95ModData(reader(buf));
    if (d.status !== 'valid') throw new Error(`expected valid, got ${d.status}: ${d.reason}`);
    return d;
  }

  it('round trips zones and descriptions', () => {
    const buf = toBuffer(enc.blocks);
    const d = valid(buf);
    expect(d.zones).toEqual([{ index: 0, name: 'LOCAL', memberIndexes: [0, 2], valid: true }]);
    expect(d.descriptionsPresent).toBe(true);
    expect(d.zoneGeneration).toBe(a.zoneGeneration);
    expect(decodeRt95Description(reader(buf), d, 0, record(image, 0))).toEqual({
      text: 'Calling ch',
    });
    expect(decodeRt95Description(reader(buf), d, 2, record(image, 2))).toEqual({
      text: 'Demo three',
    });
  });

  it('round trips the no-mod-data header', () => {
    const b = MMD1_VECTORS[1]!;
    const buf = toBuffer(encodeRt95ModData({ zones: [], descriptions: [] }, image).blocks);
    const d = valid(buf);
    expect(d.zones).toEqual([]);
    expect(d.descriptionsPresent).toBe(false);
    expect(d.zoneGeneration).toBe(b.zoneGeneration);
  });

  describe('no-data cases', () => {
    function patched(mutate: (buf: Uint8Array) => void): Rt95ModDataDecodedLike {
      const buf = toBuffer(enc.blocks);
      mutate(buf);
      return decodeRt95ModData(reader(buf));
    }
    type Rt95ModDataDecodedLike = ReturnType<typeof decodeRt95ModData>;

    it('all FF is absent', () => {
      expect(decodeRt95ModData(reader(new Uint8Array(0x6000).fill(0xff))).status).toBe('absent');
    });
    it('bad magic', () => {
      expect(patched((b) => (b[0x4000] = 0x4e)).status).toBe('invalid');
    });
    it('version 2', () => {
      expect(patched((b) => (b[0x4004] = 2))).toMatchObject({
        status: 'invalid',
        reason: 'version',
      });
    });
    it('flag bit 1 set', () => {
      expect(patched((b) => (b[0x4006] |= 2))).toMatchObject({
        status: 'invalid',
        reason: 'flags',
      });
    });
    it('N = 33', () => {
      expect(patched((b) => (b[0x4005] = 33))).toMatchObject({
        status: 'invalid',
        reason: 'zone-count',
      });
    });
    it('header CRC off by one bit', () => {
      expect(patched((b) => (b[0x400e] ^= 1))).toMatchObject({ status: 'invalid', reason: 'crc' });
    });
    it('a changed name block invalidates the header CRC', () => {
      expect(patched((b) => (b[0x4100] ^= 1))).toMatchObject({ status: 'invalid', reason: 'crc' });
    });
    it('a corrupted slot skips only that zone', () => {
      const two = encodeRt95ModData(
        {
          zones: [
            { name: 'LOCAL', channelIndexes: [0, 2] },
            { name: 'UHF', channelIndexes: [2] },
          ],
          descriptions: [],
        },
        image,
      );
      const buf = toBuffer(two.blocks);
      buf[0x4300] ^= 1;
      const d = valid(buf);
      expect(d.zones.map((z) => z.valid)).toEqual([false, true]);
      expect(d.zones[1]!.memberIndexes).toEqual([2]);
    });
  });

  describe('description hidden cases', () => {
    const buf = toBuffer(enc.blocks);
    const d = valid(buf);

    it('renamed channel hides on fingerprint', () => {
      const rec = record(image, 0);
      rec[0x18] = 0x58;
      expect(decodeRt95Description(reader(buf), d, 0, rec)).toEqual({ hidden: 'fingerprint' });
    });
    it('retuned channel hides on fingerprint', () => {
      const rec = record(image, 0);
      rec[2] = 0x25;
      expect(decodeRt95Description(reader(buf), d, 0, rec)).toEqual({ hidden: 'fingerprint' });
    });
    it('missing live record hides on fingerprint', () => {
      expect(decodeRt95Description(reader(buf), d, 0, undefined)).toEqual({
        hidden: 'fingerprint',
      });
    });
    it('block copied to another slot hides on crc', () => {
      const copy = buf.slice();
      copy.set(buf.slice(0x5000, 0x5010), 0x5010);
      const dd = valid(copy);
      expect(decodeRt95Description(reader(copy), dd, 1, record(image, 0))).toEqual({
        hidden: 'crc',
      });
    });
    it('changed description generation hides on crc', () => {
      expect(
        decodeRt95Description(
          reader(buf),
          { ...d, descriptionGeneration: d.descriptionGeneration ^ 1 },
          0,
          record(image, 0),
        ),
      ).toEqual({ hidden: 'crc' });
    });
    it('flag bit 0 clear', () => {
      expect(
        decodeRt95Description(
          reader(buf),
          { ...d, descriptionsPresent: false },
          0,
          record(image, 0),
        ),
      ).toEqual({ hidden: 'flag-clear' });
    });
    it('FF block', () => {
      expect(decodeRt95Description(reader(buf), d, 1, record(image, 0))).toEqual({
        hidden: 'no-block',
      });
    });
    it('text with an early 00 decodes the prefix', () => {
      const e = encodeRt95ModData(
        { zones: [], descriptions: [{ channelIndex: 0, text: 'Hi' }] },
        image,
      );
      const b2 = toBuffer(e.blocks);
      const d2 = valid(b2);
      expect(decodeRt95Description(reader(b2), d2, 0, record(image, 0))).toEqual({ text: 'Hi' });
    });
  });

  describe('state block', () => {
    const buf = toBuffer(enc.blocks);
    const d = valid(buf);

    it('valid', () => {
      expect(decodeRt95ZoneState(fromHex(MMD1_STATE_A_HEX), d)).toEqual({
        valid: true,
        sideA: 1,
        sideB: 0,
      });
    });
    it('stale generation', () => {
      expect(decodeRt95ZoneState(encodeRt95ZoneStateForTest(0x1234, 1, 0), d)).toEqual({
        valid: false,
        reason: 'stale-generation',
      });
    });
    it('zone byte above N', () => {
      expect(decodeRt95ZoneState(encodeRt95ZoneStateForTest(d.zoneGeneration, 2, 0), d)).toEqual({
        valid: false,
        reason: 'zone-range',
      });
    });
    it('bad check', () => {
      const s = fromHex(MMD1_STATE_A_HEX);
      s[14]! ^= 1;
      expect(decodeRt95ZoneState(s, d)).toEqual({ valid: false, reason: 'check' });
    });
    it('blank and bad magic', () => {
      expect(decodeRt95ZoneState(new Uint8Array(16).fill(0xff), d)).toEqual({
        valid: false,
        reason: 'blank',
      });
      const s = fromHex(MMD1_STATE_A_HEX);
      s[0] = 0;
      expect(decodeRt95ZoneState(s, d)).toEqual({ valid: false, reason: 'magic' });
    });
  });
});
