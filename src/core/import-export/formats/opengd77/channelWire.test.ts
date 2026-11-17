import { describe, expect, it } from 'vitest';
import { formatOpenGd77ToneWire } from './channelWire.ts';

describe('formatOpenGd77ToneWire', () => {
  it('emits canonical inverted DCS and leaves CTCSS', () => {
    expect(formatOpenGd77ToneWire('fm', 'D047P')).toBe('D047I');
    expect(formatOpenGd77ToneWire('fm', 'D023I')).toBe('D023I');
    expect(formatOpenGd77ToneWire('fm', '88.5')).toBe('88.5');
    expect(formatOpenGd77ToneWire('fm', 'none')).toBe('None');
    expect(formatOpenGd77ToneWire('dmr', 'D023I')).toBe('');
  });
});
