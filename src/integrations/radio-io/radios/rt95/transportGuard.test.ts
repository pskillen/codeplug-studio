import { describe, expect, it, vi } from 'vitest';
import {
  assertRt95EepromRangeAllowed,
  Rt95WriteRefusedError,
  type Rt95WriteContext,
} from './modData/writeInterlock.ts';
import { guardRt95ClonePipe } from './transportGuard.ts';
import { makeProgramQxWriteFrame } from '../../kit/codecs/programQx.ts';
import type { BytePipe } from '../../types.ts';

const mm: Rt95WriteContext = { profile: 'mm9pdy', chipGuardPassed: true, operation: 'write' };
function fixture(ctx?: Rt95WriteContext) {
  const write = vi.fn<BytePipe['write']>(async () => {});
  const pipe: BytePipe = { write, readExact: async () => new Uint8Array(), close: async () => {} };
  return { write, guarded: guardRt95ClonePipe(pipe, () => ctx) };
}

describe('RT95 EEPROM boundary', () => {
  it('allows adjacent bytes and rejects protected, straddling, aliased and overflowing ranges', () => {
    for (const address of [0x3aff, 0x4000, 0x5000])
      expect(() => assertRt95EepromRangeAllowed(address, 1)).not.toThrow();
    for (const [address, length] of [
      [0x3b00, 1],
      [0x3fff, 1],
      [0x3af0, 32],
      [0x7b00, 1],
      [0xbb00, 1],
      [0xfb00, 1],
      [0xffff, 2],
      [0x10000, 1],
    ]) {
      expect(() => assertRt95EepromRangeAllowed(address!, length!)).toThrow(Rt95WriteRefusedError);
    }
  });
  it.each([0x9e, 0x9f, 0xa7, 0xa8, 0xa9, 0xaa, 0xab, 0x00, 0xff])(
    'refuses command 0x%s without sending',
    async (command) => {
      const { write, guarded } = fixture(mm);
      await expect(guarded.write(Uint8Array.of(command, 0, 0, 16))).rejects.toBeInstanceOf(
        Rt95WriteRefusedError,
      );
      expect(write).not.toHaveBeenCalled();
    },
  );
  it.each([0x3af0, 0x3b00, 0x3ff0, 0x7b00, 0xbb00, 0xfff0])(
    'refuses forbidden blocks at %i without sending',
    async (address) => {
      const { write, guarded } = fixture(mm);
      await expect(
        guarded.write(makeProgramQxWriteFrame(address, 16, new Uint8Array(16))),
      ).rejects.toBeInstanceOf(Rt95WriteRefusedError);
      expect(write).not.toHaveBeenCalled();
    },
  );
  it('refuses a 32-byte frame straddling the protected boundary without sending', async () => {
    const { write, guarded } = fixture(mm);
    const frame = makeProgramQxWriteFrame(0x3af0, 32, new Uint8Array(32));
    await expect(guarded.write(frame)).rejects.toBeInstanceOf(Rt95WriteRefusedError);
    expect(write).not.toHaveBeenCalled();
  });
  it.each([
    { ...mm, chipGuardPassed: false },
    { ...mm, profile: 'stock' as const },
  ])('refuses MMD1 without authorisation', async (ctx) => {
    const { write, guarded } = fixture(ctx);
    await expect(
      guarded.write(makeProgramQxWriteFrame(0x5000, 16, new Uint8Array(16))),
    ).rejects.toBeInstanceOf(Rt95WriteRefusedError);
    expect(write).not.toHaveBeenCalled();
  });
  it('sends a chip-guarded MMD1 block at 0x5000', async () => {
    const { write, guarded } = fixture(mm);
    const frame = makeProgramQxWriteFrame(0x5000, 16, new Uint8Array(16));
    await guarded.write(frame);
    expect(write).toHaveBeenCalledOnce();
    expect(write).toHaveBeenCalledWith(frame);
  });
  it('refuses a write without a write context', async () => {
    const { write, guarded } = fixture();
    await expect(
      guarded.write(makeProgramQxWriteFrame(0x100, 16, new Uint8Array(16))),
    ).rejects.toBeInstanceOf(Rt95WriteRefusedError);
    expect(write).not.toHaveBeenCalled();
  });
});

describe('RT95 debug read boundary', () => {
  it('accepts each aligned read but rejects every protected write including mirrors', async () => {
    const { write, guarded } = fixture(mm);
    for (const mirror of [0, 0x4000, 0x8000, 0xc000]) {
      for (let addr = 0x3b00; addr <= 0x3fb0; addr += 16) {
        const address = addr + mirror;
        await guarded.write(Uint8Array.of(0x52, address >> 8, address & 255, 16));
        const before = write.mock.calls.length;
        await expect(
          guarded.write(makeProgramQxWriteFrame(address, 16, new Uint8Array(16))),
        ).rejects.toThrow();
        expect(write).toHaveBeenCalledTimes(before);
      }
    }
  });
  it('rejects malformed reads without sending', async () => {
    const { write, guarded } = fixture();
    for (const frame of [
      Uint8Array.of(0x52),
      Uint8Array.of(0x52, 0, 0, 15),
      Uint8Array.of(0x52, 0, 0, 16, 0),
    ])
      await expect(guarded.write(frame)).rejects.toThrow();
    expect(write).not.toHaveBeenCalled();
  });
});
