import { describe, expect, it } from 'vitest';
import { D890_MAP } from './constants.ts';
import { RadioProtocolError } from '../../kit/errors.ts';
import {
  LOCAL_INFO_SERIAL_LENGTH,
  LOCAL_INFO_SERIAL_OFFSET,
  assertAtD890LocalInfoPlausible,
  formatAtD890LocalInfoSerial,
} from './identityCheck.ts';

function localWithSerial(serial: string): Uint8Array {
  const out = new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff);
  const bytes = new TextEncoder().encode(serial);
  out.set(bytes.subarray(0, LOCAL_INFO_SERIAL_LENGTH), LOCAL_INFO_SERIAL_OFFSET);
  return out;
}

describe('formatAtD890LocalInfoSerial', () => {
  it('formats the serial slice', () => {
    expect(formatAtD890LocalInfoSerial(localWithSerial('SN123'))).toBe('SN123');
  });
});

describe('assertAtD890LocalInfoPlausible', () => {
  it('refuses erased serial bytes', () => {
    expect(() =>
      assertAtD890LocalInfoPlausible(new Uint8Array(D890_MAP.LocalInfoLength).fill(0xff)),
    ).toThrow(RadioProtocolError);
  });

  it('refuses when live buffer is too short', () => {
    expect(() => assertAtD890LocalInfoPlausible(new Uint8Array(0x20))).toThrow(
      /identity check needs/,
    );
  });
});
