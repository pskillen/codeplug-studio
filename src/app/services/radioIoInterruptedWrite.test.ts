import { describe, expect, it } from 'vitest';
import {
  AT_D890_UNKNOWN_RADIO,
  recordAtD890PendingUnits,
} from '@integrations/radio-io/radios/at-d890uv/pendingUnits.ts';
import { allowLeakedD890Marker } from '../../test/leakedD890Marker.ts';
import { interruptedWriteNotice } from './radioIoInterruptedWrite.ts';

const PROFILE = 'radio-io-at-d890uv';
const A = 'SN-A';
const B = 'SN-B';
const UNIT = 0x0348_0000;

describe('interruptedWriteNotice per radio (#1406)', () => {
  it("shows only the failed radio's record, never another radio's", () => {
    allowLeakedD890Marker();
    recordAtD890PendingUnits(A, [UNIT]);
    expect(interruptedWriteNotice(PROFILE, new Error('x'), B)).toBeNull();
    expect(interruptedWriteNotice(PROFILE, new Error('x'), A)?.block.radios).toEqual([A]);
  });

  it('with both radios recorded, each failure gets its own record and clear target', () => {
    allowLeakedD890Marker();
    recordAtD890PendingUnits(A, [UNIT]);
    recordAtD890PendingUnits(B, [UNIT + 0x10_000]);
    expect(interruptedWriteNotice(PROFILE, new Error('x'), A)?.block.radios).toEqual([A]);
    expect(interruptedWriteNotice(PROFILE, new Error('x'), B)?.block.radios).toEqual([B]);
  });

  it('the unknown-radio record shows only when the serial was unreadable', () => {
    allowLeakedD890Marker();
    recordAtD890PendingUnits(AT_D890_UNKNOWN_RADIO, [UNIT]);
    expect(interruptedWriteNotice(PROFILE, new Error('x'), A)).toBeNull();
    const n = interruptedWriteNotice(PROFILE, new Error('x'), '');
    expect(n?.block.radios).toEqual([AT_D890_UNKNOWN_RADIO]);
    expect(n?.block.hard).toBe(true);
  });

  it('an unreadable serial does not show a known radio record', () => {
    allowLeakedD890Marker();
    recordAtD890PendingUnits(A, [UNIT]);
    expect(interruptedWriteNotice(PROFILE, new Error('x'), '')).toBeNull();
  });

  it('is null for a non-D890 profile', () => {
    allowLeakedD890Marker();
    recordAtD890PendingUnits(A, [UNIT]);
    expect(interruptedWriteNotice('radio-io-dm32uv', new Error('x'), A)).toBeNull();
  });
});
