import { describe, expect, it } from 'vitest';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  assertUv5rMiniWriteAllowed,
  Uv5rMiniWriteRefusedError,
  type Uv5rMiniWriteContext,
} from './writeInterlock.ts';

const ctx: Uv5rMiniWriteContext = { profile: 'stock', operation: 'write' };

function refused(address: number, length = 0x40, c: Uv5rMiniWriteContext = ctx): void {
  expect(() => assertUv5rMiniWriteAllowed(address, length, c)).toThrow(Uv5rMiniWriteRefusedError);
}

describe('assertUv5rMiniWriteAllowed', () => {
  it('passes the edges of each allowed span', () => {
    for (const a of [0x0000, 0x8000, 0x9000, 0xa000, 0xa180]) {
      expect(() => assertUv5rMiniWriteAllowed(a, 0x40, ctx)).not.toThrow();
    }
  });

  it('is a RadioProtocolError', () => {
    expect(() => assertUv5rMiniWriteAllowed(0xf000, 0x40, ctx)).toThrow(RadioProtocolError);
  });

  it('refuses a wrong length', () => {
    refused(0x0000, 0x20);
    refused(0x0000, 0x80);
    refused(0x0000, 0);
  });

  it('refuses unaligned, negative and fractional addresses', () => {
    refused(0x0001);
    refused(0x0020);
    refused(-0x40);
    refused(0x40 + 0.5);
  });

  it('refuses at or above 0xE000 (calibration)', () => {
    refused(0xe000);
    refused(0xf000);
    refused(0xff80);
    refused(0x10000);
  });

  it('refuses the 0xB000 log sector', () => {
    refused(0xb000);
    refused(0xb040);
    refused(0xbfc0);
  });

  it('refuses the 0xD000 log sector', () => {
    refused(0xd000);
    refused(0xdfc0);
  });

  it('refuses the gap 0x8040-0x8FFF', () => {
    refused(0x8040);
    refused(0x8fc0);
  });

  it('refuses the gap 0x9040-0x9FFF', () => {
    refused(0x9040);
    refused(0x9fc0);
  });

  it('refuses the 0xA1C0-0xAFFF tail', () => {
    refused(0xa1c0);
    refused(0xaf80);
  });

  it('refuses 0xC000 on every profile until a later profile adds it', () => {
    refused(0xc000);
    refused(0xcfc0);
    refused(0xc000, 0x40, { profile: 'mm9pdy', operation: 'write' });
  });

  it('refuses the same ranges on the mm9pdy profile and for restore', () => {
    for (const c of [
      { profile: 'mm9pdy', operation: 'write' },
      { profile: 'stock', operation: 'restore' },
      { profile: 'mm9pdy', operation: 'restore' },
    ] as const) {
      refused(0xb000, 0x40, c);
      refused(0xd000, 0x40, c);
      refused(0xf000, 0x40, c);
      refused(0x8040, 0x40, c);
      refused(0x9040, 0x40, c);
      expect(() => assertUv5rMiniWriteAllowed(0x9000, 0x40, c)).not.toThrow();
    }
  });
});
