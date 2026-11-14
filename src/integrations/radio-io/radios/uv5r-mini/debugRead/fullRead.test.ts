import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import type { BytePipe } from '../../../types.ts';
import { uv17ProCrypt } from '../../uv17pro-family/crypt.ts';
import { UV5R_MINI_LAYOUT } from '../../uv17pro-family/layout.ts';
import { FakeMiniRadio, bytesEqual } from '../__fixtures__/fakeMiniRadio.ts';
import { Uv5rMiniProtocol } from '../protocol.ts';
import {
  isUv5rMiniDebugFrameAllowed,
  Uv5rMiniDebugFrameRefusedError,
  Uv5rMiniReadOnlyPipe,
  UV5R_MINI_DEBUG_END_FRAME,
  UV5R_MINI_DEBUG_FIXED_FRAMES,
} from './frameAllowlist.ts';
import {
  decodeUv5rMiniFullRead,
  openUv5rMiniDebugSession,
  UV5R_MINI_FULL_READ_SIZE,
} from './fullRead.ts';
import { formatUv5rMiniSpanRange } from './spans.ts';

const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

/** Synthetic 64 KiB: a different byte pattern per 4 KiB sector, with the bytes the XOR leaves alone mixed in. */
function syntheticFlash(): Uint8Array {
  const flash = new Uint8Array(UV5R_MINI_FULL_READ_SIZE);
  for (let i = 0; i < flash.length; i++) {
    const sector = i >> 12;
    flash[i] = i % 97 === 0 ? 0xff : i % 89 === 0 ? 0x00 : (i * 7 + sector * 31) & 0xff;
  }
  return flash;
}

/** A Mini whose clone R sends 0xF000 and up plain, as the radio does. */
function radioWith(flash: Uint8Array): FakeMiniRadio {
  const radio = new FakeMiniRadio();
  radio.flash.set(flash);
  radio.plainFrom = 0xf000;
  return radio;
}

// The read-only frames, pinned as literals so a change to the shared layout can't widen the allowlist unnoticed.
const IDENT = new TextEncoder().encode('PROGRAMCOLORPROU');
const F = Uint8Array.of(0x46);
const M = Uint8Array.of(0x4d);
/** `SEND!` cipher-select frame for a read: 25 bytes, trailer 0x00. */
const READ_SEND = Uint8Array.of(
  0x53,
  0x45,
  0x4e,
  0x44,
  0x21,
  0x05,
  0x0d,
  0x01,
  0x01,
  0x01,
  0x04,
  0x11,
  0x08,
  0x05,
  0x0d,
  0x0d,
  0x01,
  0x11,
  0x0f,
  0x09,
  0x12,
  0x09,
  0x10,
  0x04,
  0x00,
);
const E = Uint8Array.of(0x45);
const UPLOAD_SEND = UV5R_MINI_LAYOUT.magics.upload[2]!.send;

describe('UV-5R Mini debug full read', () => {
  it('reads 0x0000-0xFFFF, decodes below 0xF000 only and hashes each span', async () => {
    const flash = syntheticFlash();
    const radio = radioWith(flash);
    const session = await openUv5rMiniDebugSession(radio, { settleScale: 0 });
    const progress: number[] = [];
    const read = await session.readAll({ onProgress: (p) => progress.push(p.cur) });
    await session.end();

    expect(read.raw.length).toBe(0x10000);
    expect(bytesEqual(read.decoded, flash)).toBe(true);
    // Below 0xF000 the wire carries the XOR; from 0xF000 the plain bytes.
    expect(bytesEqual(read.raw.subarray(0, 0xf000), uv17ProCrypt(flash.subarray(0, 0xf000)))).toBe(
      true,
    );
    expect(bytesEqual(read.raw.subarray(0xf000), flash.subarray(0xf000))).toBe(true);

    expect(read.spans.map((s) => formatUv5rMiniSpanRange(s.span))).toEqual([
      '0x0000–0x7FFF',
      '0xA000–0xAFFF',
      '0xC000–0xCFFF',
      '0xE000–0xEFFF',
      '0xF000–0xFFFF',
    ]);
    for (const { span, sha256: hash } of read.spans) {
      expect(hash).toBe(sha256(flash.subarray(span.start, span.end)));
    }
    expect(progress.length).toBe(1024);
    expect(progress.at(-1)).toBe(1024);
  });

  it('returns the F and M answers as received', async () => {
    const session = await openUv5rMiniDebugSession(radioWith(syntheticFlash()), {
      settleScale: 0,
    });
    expect(session.ident.f.length).toBe(16);
    expect(session.ident.m.length).toBe(15);
    expect(new TextDecoder().decode(session.ident.m.subarray(0, 6))).toBe('5RMINI');
  });

  it('sends exactly ident, F, M, the read cipher-select frame, 1024 R frames and E', async () => {
    const radio = radioWith(syntheticFlash());
    const session = await openUv5rMiniDebugSession(radio, { settleScale: 0 });
    await session.readAll();
    await session.end();

    const expected: Uint8Array[] = [IDENT, F, M, READ_SEND];
    for (let addr = 0; addr < 0x10000; addr += 0x40) {
      expected.push(Uint8Array.of(0x52, addr >> 8, addr & 0xff, 0x40));
    }
    expected.push(E);

    expect(radio.writes.length).toBe(expected.length);
    radio.writes.forEach((w, i) => expect(bytesEqual(w, expected[i]!)).toBe(true));
    expect(radio.wAddresses()).toEqual([]);
  });

  it('decodes as the radio sends: XOR below 0xF000, plain from 0xF000', () => {
    const plain = syntheticFlash();
    const wire = plain.slice();
    wire.set(uv17ProCrypt(plain.subarray(0, 0xf000)), 0);
    expect(bytesEqual(decodeUv5rMiniFullRead(wire), plain)).toBe(true);
  });
});

/** Records what reached the transport. */
class RecordingPipe implements BytePipe {
  readonly sent: Uint8Array[] = [];
  async write(data: Uint8Array): Promise<void> {
    this.sent.push(data.slice());
  }
  async readExact(n: number): Promise<Uint8Array> {
    return new Uint8Array(n);
  }
  async close(): Promise<void> {}
}

describe('UV-5R Mini debug frame allowlist', () => {
  const refused: [string, Uint8Array][] = [
    ['a W frame', Uint8Array.from([0x57, 0x00, 0x00, 0x40, ...new Uint8Array(0x40)])],
    [
      'a W frame at calibration',
      Uint8Array.from([0x57, 0xf0, 0x00, 0x40, ...new Uint8Array(0x40)]),
    ],
    ['D', Uint8Array.of(0x44)],
    ['UPDATE', new TextEncoder().encode('UPDATE')],
    ['an AA 55 update frame', Uint8Array.of(0xaa, 0x55, 0x01, 0x00, 0x00)],
    ['an A5 frame', Uint8Array.of(0xa5, 0x02, 0x00, 0x00, 0x00)],
    ['the upload cipher-select frame', UPLOAD_SEND],
    ['an R of another length', Uint8Array.of(0x52, 0x00, 0x00, 0x80)],
    ['an R with a payload', Uint8Array.of(0x52, 0x00, 0x00, 0x40, 0x00)],
    ['an empty frame', new Uint8Array(0)],
  ];

  it.each(refused)('refuses %s before the transport sees it', async (_name, frame) => {
    expect(isUv5rMiniDebugFrameAllowed(frame)).toBe(false);
    const inner = new RecordingPipe();
    const pipe = new Uv5rMiniReadOnlyPipe(inner);
    await expect(pipe.write(frame)).rejects.toBeInstanceOf(Uv5rMiniDebugFrameRefusedError);
    expect(inner.sent).toEqual([]);
  });

  it('allows only the handshake, R, and E', () => {
    for (const f of [IDENT, F, M, READ_SEND, Uint8Array.of(0x52, 0xff, 0xc0, 0x40), E]) {
      expect(isUv5rMiniDebugFrameAllowed(f)).toBe(true);
    }
  });

  it('takes from the layout exactly the pinned frames', () => {
    const hex = (frames: readonly Uint8Array[]) =>
      frames.map((f) => Array.from(f, (b) => b.toString(16).padStart(2, '0')).join(''));
    expect(READ_SEND.length).toBe(25);
    expect(hex([UV5R_MINI_LAYOUT.ident])).toEqual(hex([IDENT]));
    expect(hex(UV5R_MINI_LAYOUT.magics.read.map((m) => m.send))).toEqual(hex([F, M, READ_SEND]));
    expect(hex([UV5R_MINI_DEBUG_END_FRAME])).toEqual(hex([E]));
    expect(hex(UV5R_MINI_DEBUG_FIXED_FRAMES)).toEqual(hex([IDENT, F, M, READ_SEND, E]));
  });

  it('sends the bytes it checked, not the caller buffer', async () => {
    const held: Uint8Array[] = [];
    const inner: BytePipe = {
      write: async (data) => {
        held.push(data); // keeps the reference, as a writer holding the chunk would
      },
      readExact: async (n) => new Uint8Array(n),
      close: async () => {},
    };
    const frame = Uint8Array.of(0x52, 0x00, 0x00, 0x40);
    await new Uv5rMiniReadOnlyPipe(inner).write(frame);
    frame.set([0x57, 0xf0, 0x00, 0x40]); // the caller reuses its buffer for a W at calibration
    expect(held[0]).not.toBe(frame);
    expect(Array.from(held[0]!)).toEqual([0x52, 0x00, 0x00, 0x40]);
  });

  it('refuses a Write driven through it: no W reaches the radio', async () => {
    const radio = radioWith(syntheticFlash());
    const before = radio.flash.slice();
    const protocol = new Uv5rMiniProtocol();
    await protocol.connect(new Uv5rMiniReadOnlyPipe(radio), { settleScale: 0 });
    const image = await protocol.download();
    await expect(protocol.upload(image, {})).rejects.toBeInstanceOf(Uv5rMiniDebugFrameRefusedError);
    expect(radio.wAddresses()).toEqual([]);
    expect(bytesEqual(radio.flash, before)).toBe(true);
  });
});
