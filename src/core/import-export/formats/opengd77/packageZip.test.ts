import { describe, expect, it } from 'vitest';
import { buildOpenGd77Zip } from './packageZip.ts';

describe('buildOpenGd77Zip', () => {
  it('packages CSV files into a non-empty zip', () => {
    const zip = buildOpenGd77Zip({
      'Channels.csv': 'Channel Name\nTest\n',
      'Zones.csv': 'Zone Name\nZ1\n',
    });
    expect(zip.byteLength).toBeGreaterThan(0);
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
  });
});
