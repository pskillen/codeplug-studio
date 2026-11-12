import { createHash } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import type { StockFirmwareDescriptor } from '@core/firmware/types.ts';
import { RT95_MAIN_STOCK_FIRMWARE } from '@core/radios/retevis/rt95/firmware.ts';

import { RadioInterlockError } from '../../../kit/errors.ts';
import {
  preparedRt95HeadImage,
  RT95_MAIN_GOLDEN_SHA256,
  synthRt95HeadPackage,
  synthRt95MainPackage,
} from './__fixtures__/syntheticPackage.ts';
import { RT95_MAIN_FW_RADIO_ID } from './constants.ts';
import { makeRt95UpdateFrame } from './frames.ts';
import { checkRt95FirmwareImage, checkRt95Outgoing } from './interlocks.ts';
import {
  createRt95MainTarget,
  RT95_HEAD_TARGET,
  RT95_MAIN_TARGET,
  type Rt95FirmwareTarget,
} from './targets.ts';

/** A test descriptor that pins the synthetic MAIN golden as "the stock". Never the real stock. */
const GOLDEN_STOCK: StockFirmwareDescriptor = {
  ...RT95_MAIN_STOCK_FIRMWARE,
  members: RT95_MAIN_STOCK_FIRMWARE.members.map((m) => ({
    ...m,
    sha256: RT95_MAIN_GOLDEN_SHA256[m.role as 'cdd' | 'cdi' | 'spi'],
  })),
};
const GOLDEN_TARGET: Rt95FirmwareTarget = createRt95MainTarget(GOLDEN_STOCK);

const prepared = (files = synthRt95MainPackage(), radioId: string = RT95_MAIN_FW_RADIO_ID) =>
  preparedRt95HeadImage(files, { radioId });
const refuse = (image: ReturnType<typeof prepared>, text: RegExp, target = GOLDEN_TARGET) =>
  expect(() => checkRt95FirmwareImage(image, target)).toThrow(text);
const sha = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');
const gate = { cloneEndAllowed: false };

describe('RT95_MAIN_TARGET', () => {
  it('holds the D35 numbers', () => {
    expect(RT95_MAIN_TARGET).toMatchObject({
      radioId: 'retevis-rt95-main',
      limit: 0x0800fc00,
      maxFrames: 55,
      sp: { kind: 'exact', value: 0x200013e8 },
      modelOffset: 0xd65c,
    });
    expect(RT95_MAIN_TARGET.copy.notInUpdateMode).toMatch(/UPDATE THE RF CPU/);
    expect(RT95_MAIN_TARGET.copy.normalMode).toMatch(/UPDATE THE RF CPU/);
  });

  it('the synthetic golden has the firmware project hashes', () => {
    const f = synthRt95MainPackage();
    expect([sha(f.cdd), sha(f.cdi), sha(f.spi)]).toEqual([
      RT95_MAIN_GOLDEN_SHA256.cdd,
      RT95_MAIN_GOLDEN_SHA256.cdi,
      RT95_MAIN_GOLDEN_SHA256.spi,
    ]);
  });
});

describe('RT95 MAIN image interlocks', () => {
  it('accepts the golden when it is the pinned stock (test descriptor)', () => {
    const pkg = checkRt95FirmwareImage(prepared(), GOLDEN_TARGET);
    expect(pkg.entry.len).toBe(0xd93c);
    expect(pkg.cdd.length).toBe(0xd93c + 40);
  });

  it('refuses the golden against the real pinned stock (stock-only rule)', () => {
    refuse(prepared(), /only the pinned stock main-board firmware/, RT95_MAIN_TARGET);
  });

  it('refuses a MAIN-shaped image that is not the stock', () => {
    refuse(
      prepared(synthRt95MainPackage(undefined, { flipAt: 0x1000 })),
      /only the pinned stock main-board firmware/,
    );
  });

  it('refuses a non-stock provenance with no verified stock behind it', () => {
    const image = { ...prepared(), provenance: 'patched' } as unknown as ReturnType<
      typeof prepared
    >;
    refuse(image, /changes more than D35 allows/);
  });

  it('refuses another radio id, including the head', () => {
    refuse(prepared(undefined, 'retevis-rt95-head'), /not for the RT95 main board/);
    refuse(prepared(undefined, 'anytone-at-d890uv'), /not for the RT95 main board/);
  });

  it('refuses a head image', () => {
    // The real head image is 86 frames: the window refuses it first.
    refuse(prepared(synthRt95HeadPackage()), /outside the firmware window/);
    // A head-shaped image that fits the MAIN window gets the plain-words refusal.
    refuse(
      prepared(synthRt95HeadPackage(0xd93c)),
      /front-panel image\. The main board takes only main-board firmware/,
    );
  });

  it('refuses a MAIN image on the head target', () => {
    expect(() =>
      checkRt95FirmwareImage(prepared(undefined, 'retevis-rt95-head'), RT95_HEAD_TARGET),
    ).toThrow(/main-board image\. Studio only flashes the RT95 front panel/);
  });

  it('refuses 56 frames (the 56th would sit at 0x0800FC00)', () => {
    refuse(prepared(synthRt95MainPackage(56 * 1024)), /outside the firmware window/);
  });

  it('refuses an SP other than 0x200013E8, an even reset and a reset outside the image', () => {
    refuse(prepared(synthRt95MainPackage(undefined, { sp: 0x200013ec })), /vector table/);
    refuse(prepared(synthRt95MainPackage(undefined, { reset: 0x08002868 })), /vector table/);
    refuse(prepared(synthRt95MainPackage(undefined, { reset: 0x0800ff01 })), /vector table/);
  });

  it('refuses a missing model string at 0xD65C', () => {
    refuse(prepared(synthRt95MainPackage(undefined, { model: false })), /RT95-P model string/);
  });
});

describe('RT95 MAIN outgoing gate', () => {
  const frameAt = (addr: number) => makeRt95UpdateFrame(addr, new Uint8Array(1024));

  it('allows the first and last window frames', () => {
    expect(() => checkRt95Outgoing(frameAt(0x08002000), gate, RT95_MAIN_TARGET)).not.toThrow();
    expect(() => checkRt95Outgoing(frameAt(0x0800f800), gate, RT95_MAIN_TARGET)).not.toThrow();
  });

  it('refuses a frame at 0x0800FC00, past it, and below the bootloader', () => {
    for (const addr of [0x0800fc00, 0x08010000, 0x08001c00]) {
      expect(() => checkRt95Outgoing(frameAt(addr), gate, RT95_MAIN_TARGET)).toThrow(
        RadioInterlockError,
      );
    }
  });

  it('still allows a head-window frame on the head target only', () => {
    expect(() => checkRt95Outgoing(frameAt(0x08010000), gate, RT95_HEAD_TARGET)).not.toThrow();
  });
});
