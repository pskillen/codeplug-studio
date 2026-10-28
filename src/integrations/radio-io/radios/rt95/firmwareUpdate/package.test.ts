import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  RT95_GOLDEN_FRAMES,
  RT95_GOLDEN_SHA256,
  synthRt95HeadPackage,
} from './__fixtures__/syntheticPackage.ts';
import { makeRt95UpdateFrame, rt95FrameAddr, rt95FrameSum } from './frames.ts';
import { parseRt95HeadPackage, rt95HeadBlockCount, rt95HeadBlocks } from './package.ts';

const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join(' ');

describe('golden synthetic package', () => {
  it('has the hashes shared with the firmware project', () => {
    const f = synthRt95HeadPackage();
    expect(hex(f.spi)).toBe('01 00 00 55 01 00 00 00 00 00');
    expect(sha(f.cdd)).toBe(RT95_GOLDEN_SHA256.cdd);
    expect(sha(f.cdi)).toBe(RT95_GOLDEN_SHA256.cdi);
    expect(sha(f.spi)).toBe(RT95_GOLDEN_SHA256.spi);
  });

  it('makes 86 frames; frame 0 sum is ec fe; the last frame starts 01 00 74 01 08', () => {
    const pkg = parseRt95HeadPackage(synthRt95HeadPackage());
    expect(rt95HeadBlockCount(pkg)).toBe(RT95_GOLDEN_FRAMES);
    const frames = [...rt95HeadBlocks(pkg)].map((b) => makeRt95UpdateFrame(b.addr, b.data));
    expect(frames).toHaveLength(RT95_GOLDEN_FRAMES);
    expect(hex(frames[0]!.subarray(0x405, 0x407))).toBe('ec fe');
    expect(hex(frames.at(-1)!.subarray(0, 5))).toBe('01 00 74 01 08');
  });
});

describe('frames', () => {
  it('lays out a frame and sums bytes 1 to 0x404 only', () => {
    const data = Uint8Array.from({ length: 1024 }, (_, i) => i & 0xff);
    const f = makeRt95UpdateFrame(0x08002400, data);
    expect(f).toHaveLength(1032);
    expect(f[0]).toBe(0x01);
    expect(rt95FrameAddr(f)).toBe(0x08002400);
    expect(f.subarray(5, 0x405)).toEqual(data);
    expect(f[1031]).toBe(0x06);
    const sum =
      (f.subarray(1, 5).reduce((a, b) => a + b, 0) + data.reduce((a, b) => a + b, 0)) & 0xffff;
    expect(f[0x405]! | (f[0x406]! << 8)).toBe(sum);
    const g = f.slice();
    g[0] = 0xff;
    g[0x405] = 0xff;
    g[0x407] = 0xff;
    expect(rt95FrameSum(g)).toBe(rt95FrameSum(f));
  });

  it('needs exactly 1,024 data bytes', () => {
    for (const n of [0, 1023, 1025]) {
      expect(() => makeRt95UpdateFrame(0x08002000, new Uint8Array(n))).toThrow(RadioInterlockError);
    }
  });

  it('zero-pads the last block', () => {
    const pkg = parseRt95HeadPackage(synthRt95HeadPackage(0x15400 + 3));
    const blocks = [...rt95HeadBlocks(pkg)];
    expect(blocks).toHaveLength(0x56);
    const last = blocks.at(-1)!;
    expect(last.addr).toBe(0x08002000 + 0x15400);
    expect(last.data.subarray(0, 3)).toEqual(pkg.image.subarray(0x15400));
    expect(last.data.subarray(3).every((b) => b === 0)).toBe(true);
  });
});

describe('package refusals', () => {
  const refuses = (files: ReturnType<typeof synthRt95HeadPackage>, text: RegExp) =>
    expect(() => parseRt95HeadPackage(files)).toThrow(text);

  it('needs a 10-byte .spi', () => {
    const f = synthRt95HeadPackage();
    refuses({ ...f, spi: f.spi.subarray(0, 9) }, /exactly 10/);
    refuses({ ...f, spi: new Uint8Array(11) }, /exactly 10/);
  });

  it('needs count 1 and a zero tail', () => {
    refuses(synthRt95HeadPackage(undefined, { count: 2 }), /1/);
    const f = synthRt95HeadPackage();
    const spi = f.spi.slice();
    spi[6] = 1;
    refuses({ ...f, spi }, /tail/);
  });

  it('needs a 278-byte .CDI', () => {
    const f = synthRt95HeadPackage();
    refuses({ ...f, cdi: f.cdi.subarray(0, 277) }, /278/);
    refuses({ ...f, cdi: new Uint8Array(556) }, /278/);
  });

  it('needs dest 0x08002000, 1 KiB aligned', () => {
    refuses(synthRt95HeadPackage(undefined, { dest: 0x08001c00 }), /must load at/);
    refuses(synthRt95HeadPackage(undefined, { dest: 0x08002100 }), /must load at/);
  });

  it('needs the .spi total to equal the entry length', () => {
    refuses(synthRt95HeadPackage(undefined, { total: 1 }), /total length/);
  });

  it('refuses an entry that runs past the .CDD, allows a longer .CDD', () => {
    const f = synthRt95HeadPackage();
    refuses({ ...f, cdd: f.cdd.subarray(0, f.cdd.length - 1) }, /runs past/);
    const longer = parseRt95HeadPackage(synthRt95HeadPackage(undefined, { cddExtra: 40 }));
    expect(longer.image).toHaveLength(longer.entry.len);
    expect(rt95HeadBlockCount(longer)).toBe(RT95_GOLDEN_FRAMES);
  });
});
