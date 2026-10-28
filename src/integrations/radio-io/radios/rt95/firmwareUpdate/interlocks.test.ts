import { describe, expect, it } from 'vitest';

import { RadioInterlockError } from '../../../kit/errors.ts';
import { preparedRt95HeadImage, synthRt95HeadPackage } from './__fixtures__/syntheticPackage.ts';
import { RT95_HEAD_FW_CLONE_END, RT95_HEAD_FW_PROGRAM, RT95_HEAD_FW_FRAME } from './constants.ts';
import { makeRt95UpdateFrame } from './frames.ts';
import { checkRt95HeadFirmwareImage, checkRt95HeadOutgoing } from './interlocks.ts';

const refuse = (image: ReturnType<typeof preparedRt95HeadImage>, text: RegExp) =>
  expect(() => checkRt95HeadFirmwareImage(image)).toThrow(text);

describe('RT95 head image interlocks', () => {
  it('accepts the golden package', () => {
    const pkg = checkRt95HeadFirmwareImage(preparedRt95HeadImage(synthRt95HeadPackage()));
    expect(pkg.entry.len).toBe(0x15500);
  });

  it('1. refuses another radio id', () => {
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(), { radioId: 'anytone-at-d890uv' }),
      /not for the RT95 front panel/,
    );
  });

  it('1. refuses extra or missing roles', () => {
    const f = synthRt95HeadPackage();
    refuse(preparedRt95HeadImage(f, { files: { cdd: f.cdd, cdi: f.cdi } }), /exactly the \.CDD/);
    refuse(
      preparedRt95HeadImage(f, { files: { cdd: f.cdd, cdi: f.cdi, spi: f.spi, bin: f.cdd } }),
      /exactly the \.CDD/,
    );
  });

  it('2. refuses a malformed package', () => {
    refuse(preparedRt95HeadImage(synthRt95HeadPackage(undefined, { count: 2 })), /1/);
  });

  it('3. refuses a block below the bootloader or at the end of the part', () => {
    // Package-level: dest is pinned to 0x08002000, so an image too long runs past 0x08020000.
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(0x1e000 + 1024)),
      /outside the firmware window/,
    );
  });

  it('4. refuses the main-board vector table with a clear message', () => {
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { sp: 0x200013e8 })),
      /main-board image\. Studio only flashes the RT95 front panel/,
    );
  });

  it('4. refuses an SP above the head SRAM, an even reset, and a reset outside the image', () => {
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { sp: 0x20005001 })),
      /vector table/,
    );
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { reset: 0x08002228 })),
      /vector table/,
    );
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { reset: 0x08001001 })),
      /vector table/,
    );
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { reset: 0x08030001 })),
      /vector table/,
    );
  });

  it('5. refuses an image without the RT95-P model string', () => {
    refuse(
      preparedRt95HeadImage(synthRt95HeadPackage(undefined, { model: false })),
      /model string/,
    );
    refuse(preparedRt95HeadImage(synthRt95HeadPackage(0x15000)), /model string/);
  });
});

describe('RT95 head outgoing gate', () => {
  const state = { cloneEndAllowed: false };
  const frame = (addr = 0x08002000) => makeRt95UpdateFrame(addr, new Uint8Array(1024).fill(7));
  const refuseOut = (f: Uint8Array, s = state) =>
    expect(() => checkRt95HeadOutgoing(f, s)).toThrow(RadioInterlockError);

  it('allows PROGRAM, 18 and a good frame', () => {
    expect(() => checkRt95HeadOutgoing(RT95_HEAD_FW_PROGRAM, state)).not.toThrow();
    expect(() => checkRt95HeadOutgoing(Uint8Array.of(0x18), state)).not.toThrow();
    expect(() => checkRt95HeadOutgoing(frame(), state)).not.toThrow();
  });

  it('allows END only on the normal-mode exit path', () => {
    refuseOut(RT95_HEAD_FW_CLONE_END);
    expect(() =>
      checkRt95HeadOutgoing(RT95_HEAD_FW_CLONE_END, { cloneEndAllowed: true }),
    ).not.toThrow();
  });

  it('refuses the ident request, codeplug R/W frames and an empty frame', () => {
    refuseOut(Uint8Array.of(0x02));
    refuseOut(Uint8Array.of(0x52, 0x00, 0x10, 0x10));
    refuseOut(Uint8Array.of(0x57, 0x00, 0x10, 0x10, ...new Uint8Array(16), 0x00, 0x06));
    refuseOut(new Uint8Array(0));
  });

  it('refuses a frame with a wrong sum, wrong length, or a bad first/last byte', () => {
    const bad = frame();
    bad[0x405] ^= 0xff;
    refuseOut(bad);
    refuseOut(frame().subarray(0, RT95_HEAD_FW_FRAME - 1));
    const noStart = frame();
    noStart[0] = 0x02;
    refuseOut(noStart);
    const noEnd = frame();
    noEnd[RT95_HEAD_FW_FRAME - 1] = 0x00;
    refuseOut(noEnd);
  });

  it('refuses a block below 0x08002000 and one at 0x08020000', () => {
    refuseOut(frame(0x08001c00));
    refuseOut(frame(0x08020000));
    expect(() => checkRt95HeadOutgoing(frame(0x0801fc00), state)).not.toThrow();
  });
});
