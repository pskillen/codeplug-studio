import { describe, expect, it } from 'vitest';
import { formatUkDateTime, parseUkDateTime } from './hfPropagationDateTime.ts';

describe('formatUkDateTime', () => {
  it('formats day-first with 24-hour clock', () => {
    expect(formatUkDateTime(new Date(2026, 7, 14, 13, 5))).toBe('14/08/2026 13:05');
  });

  it('pads midnight hours instead of using AM/PM', () => {
    expect(formatUkDateTime(new Date(2026, 0, 2, 0, 0))).toBe('02/01/2026 00:00');
  });
});

describe('parseUkDateTime', () => {
  it('parses padded and unpadded day/month/hour', () => {
    const parsed = parseUkDateTime('4/8/2026 9:07');
    expect(parsed).toEqual(new Date(2026, 7, 4, 9, 7));
  });

  it('rejects 12-hour AM/PM strings', () => {
    expect(parseUkDateTime('14/08/2026 01:00 PM')).toBeNull();
    expect(parseUkDateTime('14/08/2026 1:00pm')).toBeNull();
  });

  it('rejects calendar overflow', () => {
    expect(parseUkDateTime('31/02/2026 12:00')).toBeNull();
  });

  it('rejects incomplete text', () => {
    expect(parseUkDateTime('14/08/2026')).toBeNull();
  });
});
