import { describe, expect, it } from 'vitest';
import {
  assertRt95WriteAllowed,
  Rt95WriteRefusedError,
  type Rt95WriteContext,
} from './writeInterlock.ts';

const mm: Rt95WriteContext = { profile: 'mm9pdy', chipGuardPassed: true, operation: 'write' };
const mmRestore: Rt95WriteContext = { ...mm, operation: 'restore' };
const stock: Rt95WriteContext = { profile: 'stock', chipGuardPassed: true, operation: 'write' };

function refused(address: number, ctx: Rt95WriteContext, length = 16) {
  expect(() => assertRt95WriteAllowed(address, length, ctx)).toThrow(Rt95WriteRefusedError);
}

describe('assertRt95WriteAllowed refusals', () => {
  it('refuses 0x32A0 (past the stock image)', () => refused(0x32a0, mm));
  it('refuses 0x3B00 (ident)', () => refused(0x3b00, mm));
  it('refuses 0x3CC0 (calibration)', () => refused(0x3cc0, mm));
  it('refuses 0x3FF0 (signature block)', () => refused(0x3ff0, mm));
  it('refuses 0x3FF8 (unaligned)', () => refused(0x3ff8, mm));
  it('refuses 0x4008 (unaligned)', () => refused(0x4008, mm));
  it('refuses 0x4010 on Write', () => refused(0x4010, mm));
  it('refuses 0x4000 on the stock profile', () => refused(0x4000, stock));
  it('refuses 0x5000 with a failed guard', () =>
    refused(0x5000, { ...mm, chipGuardPassed: false }));
  it('refuses 0x4000 restore on the stock profile', () =>
    refused(0x4000, { ...stock, operation: 'restore' }));
  it('refuses 0x6000', () => refused(0x6000, mmRestore));
  it('refuses 0x7B00', () => refused(0x7b00, mmRestore));
  it('refuses 0x7FF0', () => refused(0x7ff0, mmRestore));
  it('refuses 0xFFF0', () => refused(0xfff0, mmRestore));
  it('refuses a 32-byte write at 0x4000', () => refused(0x4000, mm, 32));
  it('refuses negative and out-of-range addresses', () => {
    refused(-16, mm);
    refused(0x10000, mm);
  });
  it('refuses non-integers', () => refused(16.5, mm));
  it('names the address in hex', () => {
    try {
      assertRt95WriteAllowed(0x7b00, 16, mmRestore);
      expect.unreachable();
    } catch (e) {
      expect((e as Rt95WriteRefusedError).address).toBe(0x7b00);
      expect((e as Error).message).toContain('0x7B00');
    }
  });
});

describe('assertRt95WriteAllowed allowed', () => {
  it('allows the stock image on both profiles with the guard false', () => {
    for (const profile of ['stock', 'mm9pdy'] as const) {
      for (const address of [0x0000, 0x3290]) {
        expect(() =>
          assertRt95WriteAllowed(address, 16, {
            profile,
            chipGuardPassed: false,
            operation: 'write',
          }),
        ).not.toThrow();
      }
    }
  });
  it('allows MMD1 addresses on mm9pdy with the guard ok', () => {
    for (const address of [0x4000, 0x4100, 0x4300, 0x5000, 0x5c70, 0x5ff0]) {
      expect(() => assertRt95WriteAllowed(address, 16, mm)).not.toThrow();
    }
  });
  it('allows 0x4010 on mm9pdy restore with the guard ok', () => {
    expect(() => assertRt95WriteAllowed(0x4010, 16, mmRestore)).not.toThrow();
  });
});

describe('assertRt95WriteAllowed exhaustive table', () => {
  const profiles = ['stock', 'mm9pdy'] as const;
  const guards = [false, true] as const;
  const operations = ['write', 'restore'] as const;

  function expected(address: number, ctx: Rt95WriteContext): boolean {
    if (address <= 0x3290) return true;
    if (
      address >= 0x4000 &&
      address <= 0x5ff0 &&
      ctx.profile === 'mm9pdy' &&
      ctx.chipGuardPassed &&
      (address !== 0x4010 || ctx.operation === 'restore')
    ) {
      return true;
    }
    return false;
  }

  for (const profile of profiles) {
    for (const chipGuardPassed of guards) {
      for (const operation of operations) {
        it(`pins the allowed set for ${profile} guard=${chipGuardPassed} ${operation}`, () => {
          const ctx: Rt95WriteContext = { profile, chipGuardPassed, operation };
          for (let address = 0; address <= 0xfff0; address += 16) {
            let allowed = true;
            try {
              assertRt95WriteAllowed(address, 16, ctx);
            } catch (e) {
              if (!(e instanceof Rt95WriteRefusedError)) throw e;
              allowed = false;
            }
            expect(allowed, `0x${address.toString(16)}`).toBe(expected(address, ctx));
          }
        });
      }
    }
  }
});
