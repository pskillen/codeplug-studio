import { describe, expect, it, vi } from 'vitest';
import { readRt95Calibration, readRt95Mmd1 } from './debugCapture.ts';

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

describe('RT95 MMD1 guarded read', () => {
  const ident = Uint8Array.from([82, 84, 57, 53, 45, 80, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  it('reads exactly the table after successful probes', async () => {
    const readBlocks = vi.fn(
      async (addresses: readonly number[]) =>
        new Map(addresses.map((a) => [a, a === 0x3b00 ? ident : new Uint8Array(16).fill(0xff)])),
    );
    const result = await readRt95Mmd1({ readBlocks });
    expect(result.outcome).toEqual({ ok: true });
    expect(readBlocks.mock.calls[0]![0]).toEqual([0x3b00, 0x7b00]);
    expect(readBlocks.mock.calls[1]![0]).toEqual(
      Array.from({ length: 512 }, (_, i) => 0x4000 + i * 16),
    );
    expect(result.bytes).toHaveLength(8192);
  });
  it.each([
    ['alias', ident],
    ['zero', new Uint8Array(16)],
  ])('refuses %s without table reads', async (_, alias) => {
    const readBlocks = vi.fn(
      async () =>
        new Map([
          [0x3b00, ident],
          [0x7b00, alias],
        ]),
    );
    const result = await readRt95Mmd1({ readBlocks });
    expect(result.outcome.ok).toBe(false);
    expect(result.bytes).toBeUndefined();
    expect(readBlocks).toHaveBeenCalledOnce();
  });
  it.each(['guard refusal', 'final table read'])(
    'rejects cancellation during %s',
    async (stage) => {
      const controller = new AbortController();
      const readBlocks = vi.fn(async (addresses: readonly number[]) => {
        const guard = addresses[0] === 0x3b00;
        if ((stage === 'guard refusal' && guard) || (stage === 'final table read' && !guard)) {
          controller.abort();
        }
        return new Map(
          addresses.map((address) => [
            address,
            address === 0x3b00 || (address === 0x7b00 && stage === 'guard refusal')
              ? ident
              : new Uint8Array(16).fill(0xff),
          ]),
        );
      });
      await expect(readRt95Mmd1({ readBlocks }, controller.signal)).rejects.toThrow();
      expect(readBlocks).toHaveBeenCalledTimes(stage === 'guard refusal' ? 1 : 2);
    },
  );
});
