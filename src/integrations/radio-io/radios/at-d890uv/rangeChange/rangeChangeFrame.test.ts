import { describe, expect, it } from 'vitest';
import { syntheticLocalInfo } from '../__fixtures__/rangeChangeFixtures.ts';
import {
  AT_D890_RANGE_CHANGE_EXTENT,
  AtD890RangeChangeRefusedError,
  buildAtD890RangeChangeFrame,
} from './rangeChangeFrame.ts';

function refusal(fn: () => unknown): string {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AtD890RangeChangeRefusedError);
    return (e as AtD890RangeChangeRefusedError).reason;
  }
  throw new Error('expected a refusal');
}

describe('buildAtD890RangeChangeFrame', () => {
  it('targets 0x04F80000, 16 bytes', () => {
    expect(AT_D890_RANGE_CHANGE_EXTENT).toEqual({ id: 'RangeCode', start: 0x04f80000, length: 16 });
  });

  it('returns +0x00..+0x0F with only +0x03 changed', () => {
    const li = syntheticLocalInfo(3);
    const before = li.slice();
    const frame = buildAtD890RangeChangeFrame(li, 7);
    expect(frame).toHaveLength(16);
    const diffs = [...frame].flatMap((b, i) => (b !== li[i] ? [i] : []));
    expect(diffs).toEqual([3]);
    expect(frame[3]).toBe(7);
    expect(li).toEqual(before);
  });

  it('allows 14 when 890# is present', () => {
    const frame = buildAtD890RangeChangeFrame(syntheticLocalInfo(3, { unlocked: true }), 14);
    expect(frame[3]).toBe(14);
    expect([...frame.subarray(0x0b, 0x0f)]).toEqual([0x38, 0x39, 0x30, 0x23]);
  });

  it('refuses a non-zero stun flag', () => {
    const li = syntheticLocalInfo();
    li[0] = 1;
    expect(refusal(() => buildAtD890RangeChangeFrame(li, 7))).toBe('stun-kill-flag');
  });

  it('refuses a non-zero kill flag', () => {
    const li = syntheticLocalInfo();
    li[1] = 0xff;
    expect(refusal(() => buildAtD890RangeChangeFrame(li, 7))).toBe('stun-kill-flag');
  });

  it('refuses when +0x04 differs from +0x05', () => {
    const li = syntheticLocalInfo();
    li[5] = 0x02;
    expect(refusal(() => buildAtD890RangeChangeFrame(li, 7))).toBe('market-lock-mismatch');
  });

  it('refuses a wrong model string', () => {
    const li = syntheticLocalInfo();
    li[0x10] = 0x41;
    expect(refusal(() => buildAtD890RangeChangeFrame(li, 7))).toBe('model-mismatch');
  });

  it('refuses a short buffer', () => {
    expect(
      refusal(() => buildAtD890RangeChangeFrame(syntheticLocalInfo().subarray(0, 0xff), 7)),
    ).toBe('short-local-info');
  });

  it.each([19, -1, 255, 3.5, Number.NaN])('refuses target %s', (target) => {
    expect(refusal(() => buildAtD890RangeChangeFrame(syntheticLocalInfo(3), target))).toBe(
      'target-not-allowed',
    );
  });

  it.each([6, 9, 12, 15])('allows unlisted code %s as a target', (code) => {
    expect(buildAtD890RangeChangeFrame(syntheticLocalInfo(3), code)[3]).toBe(code);
  });

  it('does not refuse a radio that is already on an unlisted code', () => {
    const frame = buildAtD890RangeChangeFrame(syntheticLocalInfo(9), 3);
    expect(frame[3]).toBe(3);
  });

  it('refuses 14 without 890#', () => {
    expect(refusal(() => buildAtD890RangeChangeFrame(syntheticLocalInfo(3), 14))).toBe(
      'maintenance-locked',
    );
  });

  it('refuses the raw current code', () => {
    expect(refusal(() => buildAtD890RangeChangeFrame(syntheticLocalInfo(3), 3))).toBe(
      'target-is-current',
    );
  });
});
