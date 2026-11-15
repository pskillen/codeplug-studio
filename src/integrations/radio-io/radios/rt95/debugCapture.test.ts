import { describe, expect, it, vi } from 'vitest';
import { readRt95Calibration } from './debugCapture.ts';

describe('RT95 calibration read', () => {
  it('requests exactly the 76 aligned blocks and preserves their bytes', async () => {
    const readBlocks = vi.fn(
      async (addresses: readonly number[]) =>
        new Map(addresses.map((a) => [a, new Uint8Array(16).fill((a / 16) & 255)])),
    );
    const result = await readRt95Calibration({ readBlocks });
    const addresses = readBlocks.mock.calls[0]![0];
    expect(addresses).toEqual(Array.from({ length: 76 }, (_, i) => 0x3b00 + 16 * i));
    expect(result).toHaveLength(0x4c0);
    expect(result[0x4b0]).toBe(0xfb);
  });
  it('propagates errors and rejects incomplete blocks', async () => {
    await expect(
      readRt95Calibration({
        readBlocks: async () => {
          throw new Error('cancelled');
        },
      }),
    ).rejects.toThrow('cancelled');
    await expect(readRt95Calibration({ readBlocks: async () => new Map() })).rejects.toThrow(
      'Invalid',
    );
  });
});
