import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  LOCAL_INFO_SERIAL_LENGTH,
  LOCAL_INFO_SERIAL_OFFSET,
  assertAtD890LocalInfoIdentity,
} from './identityCheck.ts';

function localWithSerial(serial: string): Uint8Array {
  const out = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
  const bytes = new TextEncoder().encode(serial);
  out.set(bytes.subarray(0, LOCAL_INFO_SERIAL_LENGTH), LOCAL_INFO_SERIAL_OFFSET);
  return out;
}

describe('assertAtD890LocalInfoIdentity', () => {
  it('passes when serial slices match', () => {
    const serial = 'SN1234567890AB';
    expect(() =>
      assertAtD890LocalInfoIdentity(localWithSerial(serial), localWithSerial(serial)),
    ).not.toThrow();
  });

  it('refuses when serial slices differ', () => {
    expect(() =>
      assertAtD890LocalInfoIdentity(localWithSerial('RADIO-A'), localWithSerial('RADIO-B')),
    ).toThrow(RadioProtocolError);
  });

  it('refuses when buffer is too short', () => {
    expect(() =>
      assertAtD890LocalInfoIdentity(new Uint8Array(0x20), localWithSerial('X')),
    ).toThrow(/identity check needs/);
  });
});
